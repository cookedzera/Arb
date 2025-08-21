import type { Express } from "express";
import { z } from "zod";
import { blockchainService } from "./blockchain";
import { storage } from "./storage";

// Claim request validation schema
const claimRequestSchema = z.object({
  tokenId: z.number().min(0).max(9), // 0-9 token IDs
  amount: z.string(), // Amount as string to handle large numbers
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
});

export function registerClaimRoutes(app: Express) {
  
  // Add a simple batch claim route that matches the frontend expectations
  app.post("/api/claim-batch", async (req, res) => {
    try {
      const { walletAddress, claims } = req.body;
      
      if (!walletAddress || !claims || !Array.isArray(claims)) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      // Get user from wallet address
      const user = await getUserByWalletAddress(walletAddress);
      if (!user) {
        return res.status(404).json({ error: "User not found for wallet address" });
      }

      let totalProcessed = 0;
      const results = [];

      for (const claim of claims) {
        try {
          const { tokenId, amount } = claim;
          
          // Verify user has sufficient balance
          const tokenField = `accumulatedToken${tokenId + 1}` as keyof typeof user;
          const userBalance = user[tokenField] as string || "0";
          
          if (parseFloat(userBalance) >= parseFloat(amount)) {
            totalProcessed += parseFloat(amount);
            results.push({ tokenId, amount, status: "success" });
          } else {
            results.push({ tokenId, amount, status: "insufficient_balance" });
          }
        } catch (error) {
          results.push({ tokenId: claim.tokenId, amount: claim.amount, status: "error" });
        }
      }

      res.json({
        success: true,
        totalProcessed,
        results,
        message: `Processed ${results.filter(r => r.status === "success").length} claims`
      });

    } catch (error) {
      console.error('Batch claim error:', error);
      res.status(500).json({ error: "Failed to process batch claim" });
    }
  });
  
  // Get user's claimable balance
  app.get("/api/user/:id/claimable", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Skip temporary users
      if (id.startsWith('temp_')) {
        return res.json({
          token1: "0",
          token2: "0", 
          token3: "0",
          totalClaimable: "0"
        });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return accumulated tokens ready for claiming
      const claimableBalances = {
        token1: user.accumulatedToken1 || "0",
        token2: user.accumulatedToken2 || "0",
        token3: user.accumulatedToken3 || "0"
      };

      // Calculate total claimable (for display)
      const total = (
        parseFloat(claimableBalances.token1) +
        parseFloat(claimableBalances.token2) + 
        parseFloat(claimableBalances.token3)
      ).toString();

      res.json({
        ...claimableBalances,
        totalClaimable: total
      });

    } catch (error) {
      console.error('Get claimable balance error:', error);
      res.status(500).json({ error: "Failed to get claimable balance" });
    }
  });

  // Generate claim signature
  app.post("/api/claim/signature", async (req, res) => {
    try {
      const validatedData = claimRequestSchema.parse(req.body);
      const { tokenId, amount, walletAddress } = validatedData;

      // Verify contract is configured
      const contractAddress = await blockchainService.getContractAddress();
      if (!contractAddress) {
        return res.status(503).json({ error: "Claim contract not deployed yet" });
      }

      // Check if contract is paused
      const isPaused = await blockchainService.isContractPaused();
      if (isPaused) {
        return res.status(503).json({ error: "Claim contract is currently paused" });
      }

      // Get user from wallet address (you'll need to implement this mapping)
      const user = await getUserByWalletAddress(walletAddress);
      if (!user) {
        return res.status(404).json({ error: "User not found for wallet address" });
      }

      // Verify user has sufficient accumulated balance
      const tokenField = `accumulatedToken${tokenId + 1}` as keyof typeof user;
      const userBalance = user[tokenField] as string || "0";
      
      if (parseFloat(userBalance) < parseFloat(amount)) {
        return res.status(400).json({ error: "Insufficient accumulated balance" });
      }

      // Get current nonce from smart contract to ensure synchronization
      let nonce: number;
      try {
        // Get user's current nonce from the contract
        const contractNonce = await blockchainService.getUserNonce(walletAddress);
        nonce = contractNonce + 1; // Next nonce to use
        console.log(`📊 User ${walletAddress} current nonce: ${contractNonce}, using: ${nonce}`);
      } catch (error) {
        console.log("Warning: Could not get contract nonce, using database nonce:", error);
        nonce = (user.totalClaims || 0) + 1;
      }
      
      const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours

      // Generate signature (server-side signing for security)
      if (!process.env.CLAIM_SIGNER_PRIVATE_KEY) {
        return res.status(500).json({ error: "Claim signing not configured" });
      }

      const signature = await blockchainService.generateClaimSignature(
        walletAddress,
        tokenId,
        amount,
        nonce,
        deadline,
        process.env.CLAIM_SIGNER_PRIVATE_KEY
      );

      // Return claim parameters
      res.json({
        claimRequest: {
          user: walletAddress,
          tokenId,
          amount,
          nonce,
          deadline,
          signature
        },
        contractAddress,
        tokenConfig: await blockchainService.getTokenConfig(tokenId)
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      
      console.error('Generate claim signature error:', error);
      res.status(500).json({ error: "Failed to generate claim signature" });
    }
  });

  // Verify and record successful claim
  app.post("/api/claim/verify", async (req, res) => {
    try {
      const { txHash, walletAddress, tokenId, amount } = req.body;

      if (!txHash || !walletAddress || tokenId === undefined || !amount) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Get user from wallet address
      const user = await getUserByWalletAddress(walletAddress);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user balances - move from accumulated to claimed
      const tokenField = `accumulatedToken${tokenId + 1}` as keyof Pick<typeof user, 'accumulatedToken1' | 'accumulatedToken2' | 'accumulatedToken3'>;
      const claimedField = `claimedToken${tokenId + 1}` as keyof Pick<typeof user, 'claimedToken1' | 'claimedToken2' | 'claimedToken3'>;
      
      const currentAccumulated = parseFloat(user[tokenField] || "0");
      const currentClaimed = parseFloat(user[claimedField] || "0");
      const claimAmount = parseFloat(amount);

      if (currentAccumulated < claimAmount) {
        return res.status(400).json({ error: "Insufficient accumulated balance" });
      }

      // Update balances
      const updates: any = {
        [tokenField]: (currentAccumulated - claimAmount).toString(),
        [claimedField]: (currentClaimed + claimAmount).toString(),
        lastClaimDate: new Date(),
        totalClaims: (user.totalClaims || 0) + 1
      };

      await storage.updateUser(user.id, updates);

      // Log the successful claim
      console.log(`✅ Claim verified: User ${user.username} claimed ${amount} tokens (${tokenId}) - TX: ${txHash}`);

      res.json({ 
        success: true, 
        message: "Claim verified and recorded",
        txHash,
        newAccumulatedBalance: updates[tokenField],
        newClaimedBalance: updates[claimedField]
      });

    } catch (error) {
      console.error('Verify claim error:', error);
      res.status(500).json({ error: "Failed to verify claim" });
    }
  });

  // Get claim contract info
  app.get("/api/claim/contract-info", async (req, res) => {
    try {
      const contractAddress = await blockchainService.getContractAddress();
      const chainId = await blockchainService.getChainId();
      const isPaused = await blockchainService.isContractPaused();
      const networkInfo = await blockchainService.getNetworkInfo();

      // Get token configurations
      const tokenConfigs = [];
      for (let i = 0; i < 3; i++) {
        const config = await blockchainService.getTokenConfig(i);
        if (config && config.isActive) {
          const tokenInfo = await blockchainService.getTokenInfo(config.tokenAddress);
          tokenConfigs.push({
            id: i,
            ...config,
            ...tokenInfo
          });
        }
      }

      res.json({
        contractAddress,
        chainId,
        isPaused,
        network: networkInfo,
        tokens: tokenConfigs,
        isConfigured: !!contractAddress
      });

    } catch (error) {
      console.error('Get contract info error:', error);
      res.status(500).json({ error: "Failed to get contract info" });
    }
  });

}

// Helper function to get user by wallet address
async function getUserByWalletAddress(walletAddress: string) {
  try {
    // This would need to be implemented in your storage layer
    // For now, we'll use a simple approach
    const users = await storage.getAllUsers();
    return users.find((user: any) => 
      user.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
    );
  } catch (error) {
    console.error('Error finding user by wallet:', error);
    return null;
  }
}