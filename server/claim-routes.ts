import type { Express } from "express";
import { storage } from "./storage";
import { blockchainService } from "./blockchain";

export function registerClaimRoutes(app: Express) {
  // Get user's claimable token balances
  app.get("/api/user/:id/claimable", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Handle temporary users - return zero balances
      if (id.startsWith('temp_')) {
        return res.json({
          token1: "0",
          token2: "0", 
          token3: "0",
          totalValue: "0",
          isTemporary: true
        });
      }
      
      // Get user from database
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return accumulated token balances (pending claim)
      const claimableBalances = {
        token1: user.accumulatedToken1 || "0",
        token2: user.accumulatedToken2 || "0",
        token3: user.accumulatedToken3 || "0",
        totalValue: "0", // Could calculate USD value later
        isTemporary: false
      };
      
      res.json(claimableBalances);
    } catch (error) {
      console.error('Get claimable error:', error);
      res.status(500).json({ error: "Failed to get claimable balances" });
    }
  });

  // Get contract info for frontend
  app.get("/api/claim/contract-info", async (req, res) => {
    try {
      const config = {
        contractAddress: process.env.SPIN_AUTO_TRANSFER_CONTRACT_ADDRESS || process.env.SPIN_CLAIM_CONTRACT_ADDRESS || "",
        tokenAddresses: {
          TOKEN1: "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4",
          TOKEN2: "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19", 
          TOKEN3: "0x0E1CD6557D2BA59C61c75850E674C2AD73253952"
        },
        chainId: 421614,
        explorerUrl: "https://sepolia.arbiscan.io"
      };
      
      res.json({
        contractAddress: config.contractAddress,
        tokenAddresses: config.tokenAddresses,
        chainId: config.chainId,
        explorerUrl: config.explorerUrl
      });
    } catch (error) {
      console.error('Get contract info error:', error);
      res.status(500).json({ error: "Failed to get contract info" });
    }
  });

  // Test auto-transfer (for development/testing)
  app.post("/api/claim/test-transfer", async (req, res) => {
    try {
      const { userAddress, tokenId, amount } = req.body;
      
      if (!userAddress || tokenId === undefined || !amount) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      // This would trigger auto-transfer via the contract
      // For now, just return success for testing
      res.json({
        success: true,
        message: "Auto-transfer test endpoint - implement with contract integration",
        userAddress,
        tokenId,
        amount
      });
    } catch (error) {
      console.error('Test transfer error:', error);
      res.status(500).json({ error: "Failed to test transfer" });
    }
  });
}