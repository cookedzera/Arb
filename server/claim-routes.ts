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

  // Generate batch claim signatures for multiple tokens
  app.post("/api/claim/batch-signature", async (req, res) => {
    try {
      const { claims, walletAddress } = req.body;
      
      if (!claims || !Array.isArray(claims) || !walletAddress) {
        return res.status(400).json({ error: "Invalid request data" });
      }

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

      // Get user from wallet address
      const user = await getUserByWalletAddress(walletAddress);
      if (!user) {
        return res.status(404).json({ error: "User not found for wallet address" });
      }

      // Get current nonce from smart contract with retry mechanism
      let baseNonce: number;
      try {
        // Add small delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const contractNonce = await blockchainService.getUserNonce(walletAddress);
        baseNonce = contractNonce + 1; // Next nonce to use
        console.log(`📊 User ${walletAddress} current nonce: ${contractNonce}, starting batch at: ${baseNonce}`);
        
        // Double-check nonce hasn't changed (anti-race condition)
        const recheckNonce = await blockchainService.getUserNonce(walletAddress);
        if (recheckNonce !== contractNonce) {
          console.log(`⚠️ Nonce changed during generation, updating: ${contractNonce} -> ${recheckNonce}`);
          baseNonce = recheckNonce + 1;
        }
      } catch (error) {
        console.log("Warning: Could not get contract nonce, using database nonce:", error);
        baseNonce = (user.totalClaims || 0) + 1;
      }

      if (!process.env.CLAIM_SIGNER_PRIVATE_KEY) {
        return res.status(500).json({ error: "Claim signing not configured" });
      }

      const signedClaims = [];
      
      // Generate signatures for each claim with sequential nonces
      for (let i = 0; i < claims.length; i++) {
        const { tokenId, amount } = claims[i];
        
        // Verify user has sufficient accumulated balance
        const tokenField = `accumulatedToken${tokenId + 1}` as keyof typeof user;
        const userBalance = user[tokenField] as string || "0";
        
        // Check minimum amount requirements (contract requires >= 100 wei for fee calculation)
        const amountWei = parseFloat(amount);
        const balanceWei = parseFloat(userBalance);
        
        if (balanceWei <= 0) {
          return res.status(400).json({ 
            error: `No accumulated balance for token ${tokenId}`,
            tokenId,
            available: userBalance
          });
        }
        
        if (amountWei <= 0) {
          return res.status(400).json({ 
            error: `Invalid claim amount for token ${tokenId}`,
            tokenId,
            amount: amount
          });
        }
        
        if (balanceWei < amountWei) {
          return res.status(400).json({ 
            error: `Insufficient accumulated balance for token ${tokenId}`,
            tokenId,
            required: amount,
            available: userBalance
          });
        }
        
        // Contract requires minimum 100 wei for treasury fee calculation
        if (amountWei < 100) {
          return res.status(400).json({ 
            error: `Amount too small for claiming (minimum 100 wei required)`,
            tokenId,
            amount: amount,
            minimum: "100"
          });
        }

        const nonce = baseNonce + i; // Sequential nonce
        const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours

        const signature = await blockchainService.generateClaimSignature(
          walletAddress,
          tokenId,
          amount,
          nonce,
          deadline,
          process.env.CLAIM_SIGNER_PRIVATE_KEY
        );

        signedClaims.push({
          user: walletAddress,
          tokenId,
          amount,
          nonce,
          deadline,
          signature
        });
      }

      // Return batch claim parameters
      res.json({
        claimRequests: signedClaims,
        contractAddress
      });

    } catch (error) {
      console.error('Generate batch claim signature error:', error);
      res.status(500).json({ error: "Failed to generate batch claim signatures" });
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
      
      // Check minimum amount requirements
      const amountWei = parseFloat(amount);
      const balanceWei = parseFloat(userBalance);
      
      if (balanceWei <= 0) {
        return res.status(400).json({ 
          error: "No accumulated balance for this token",
          available: userBalance
        });
      }
      
      if (amountWei <= 0) {
        return res.status(400).json({ 
          error: "Invalid claim amount",
          amount: amount
        });
      }
      
      if (balanceWei < amountWei) {
        return res.status(400).json({ 
          error: "Insufficient accumulated balance",
          required: amount,
          available: userBalance
        });
      }
      
      // Contract requires minimum 100 wei for treasury fee calculation
      if (amountWei < 100) {
        return res.status(400).json({ 
          error: "Amount too small for claiming (minimum 100 wei required)",
          amount: amount,
          minimum: "100"
        });
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

  // Debug endpoint to check ALL token configurations
  app.get("/api/debug/all-tokens", async (req, res) => {
    try {
      const results = [];
      
      // Check all 10 possible token slots
      for (let i = 0; i < 10; i++) {
        try {
          const config = await blockchainService.getTokenConfig(i);
          if (config) {
            results.push({
              tokenId: i,
              tokenAddress: config.tokenAddress,
              isActive: config.isActive,
              totalDistributed: config.totalDistributed,
              status: "configured"
            });
          } else {
            results.push({
              tokenId: i,
              tokenAddress: "0x0000000000000000000000000000000000000000",
              isActive: false,
              status: "empty"
            });
          }
        } catch (error) {
          results.push({
            tokenId: i,
            status: "error",
            error: (error as Error).message
          });
        }
      }
      
      res.json({ results });
    } catch (error) {
      console.error('Debug all tokens error:', error);
      res.status(500).json({ error: "Failed to check all tokens" });
    }
  });

  // Debug endpoint to check token balances directly
  app.get("/api/debug/token-balances", async (req, res) => {
    try {
      const contractAddress = await blockchainService.getContractAddress();
      console.log("🧪 Debug: Checking token balances for contract:", contractAddress);
      
      const results = [];
      const tokenAddresses = [
        "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4", // Token 0 - User deployed test token
        "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19", // Token 1 - BOOP Test
        "0x0E1CD6557D2BA59C61c75850E674C2AD73253952"  // Token 2 - BOBOTRUM Test
      ];
      
      for (let i = 0; i < tokenAddresses.length; i++) {
        const tokenAddress = tokenAddresses[i];
        try {
          const balance = await blockchainService.getContractTokenBalance(tokenAddress);
          results.push({
            tokenId: i,
            tokenAddress,
            balance,
            status: "success"
          });
        } catch (error) {
          results.push({
            tokenId: i,
            tokenAddress,
            balance: "0",
            status: "error",
            error: (error as Error).message
          });
        }
      }
      
      res.json({ contractAddress, results });
    } catch (error) {
      console.error('Debug token balances error:', error);
      res.status(500).json({ error: "Failed to check token balances" });
    }
  });

  // Get claim contract info
  app.get("/api/claim/contract-info", async (req, res) => {
    try {
      const contractAddress = await blockchainService.getContractAddress();
      const chainId = await blockchainService.getChainId();
      const isPaused = await blockchainService.isContractPaused();
      const networkInfo = await blockchainService.getNetworkInfo();

      // Get token configurations with actual balances
      const tokenConfigs = [];
      for (let i = 0; i < 3; i++) {
        const config = await blockchainService.getTokenConfig(i);
        if (config && config.isActive) {
          // Get actual ERC20 balance of the contract
          let actualBalance = "0";
          try {
            actualBalance = await blockchainService.getContractTokenBalance(config.tokenAddress);
          } catch (error) {
            console.error(`Failed to get balance for token ${i} (${config.tokenAddress}):`, error);
          }
          const tokenInfo = await blockchainService.getTokenInfo(config.tokenAddress);
          
          tokenConfigs.push({
            id: i,
            tokenAddress: config.tokenAddress,
            totalDistributed: config.totalDistributed,
            reserveBalance: config.reserveBalance, // Contract's internal tracking
            actualBalance: actualBalance, // Real ERC20 balance
            isActive: config.isActive,
            // Only include token info if available (avoid errors from bad tokens)
            ...(tokenInfo && {
              name: tokenInfo.name,
              symbol: tokenInfo.symbol,
              decimals: tokenInfo.decimals?.toString(),
              totalSupply: tokenInfo.totalSupply
            })
          });
        }
      }

      res.json({
        contractAddress,
        chainId: typeof chainId === 'bigint' ? Number(chainId) : chainId,
        isPaused,
        network: {
          ...networkInfo,
          chainId: typeof networkInfo?.chainId === 'bigint' ? Number(networkInfo.chainId) : networkInfo?.chainId,
          blockNumber: typeof networkInfo?.blockNumber === 'bigint' ? Number(networkInfo.blockNumber) : networkInfo?.blockNumber
        },
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
    console.log(`🔍 Looking for user with wallet: ${walletAddress}`);
    
    // Get all users to check wallet mapping
    const users = await storage.getAllUsers();
    const foundUser = users.find((user: any) => 
      user.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (!foundUser) {
      console.log(`❌ No user found for wallet ${walletAddress}`);
      console.log('Available users with wallets:', users.filter(u => u.walletAddress).map(u => ({
        id: u.id,
        username: u.username,
        wallet: u.walletAddress
      })));
    } else {
      console.log(`✅ Found user: ${foundUser.username} (${foundUser.id})`);
    }
    
    return foundUser;
  } catch (error) {
    console.error('Error finding user by wallet:', error);
    return null;
  }
}