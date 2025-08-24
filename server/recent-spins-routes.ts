import { Express } from "express";
import { storage } from "./storage";

export function registerRecentSpinsRoutes(app: Express) {
  
  // Get recent transactions with links to Arbiscan
  app.get("/api/recent-transactions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 15;
      const recentTransactions = await storage.getRecentTransactions(limit);
      
      res.json({
        transactions: recentTransactions,
        count: recentTransactions.length
      });
    } catch (error) {
      console.error('Get recent transactions error:', error);
      res.status(500).json({ error: "Failed to get recent transactions" });
    }
  });

  // Get recent spins with enhanced data
  app.get("/api/recent-spins", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const recentSpins = await storage.getRecentSpins(limit);
      
      // Enhance the spin data with user info and token symbols
      const enhancedSpins = await Promise.all(
        recentSpins.map(async (spin: any) => {
          let user = null;
          if (spin.userId && !spin.userId.startsWith('temp_')) {
            user = await storage.getUserById(spin.userId);
          }
          
          // Map token addresses to symbols
          const tokenSymbols: { [key: string]: string } = {
            '0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4': 'AIDOGE',
            '0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19': 'BOOP', 
            '0x0E1CD6557D2BA59C61c75850E674C2AD73253952': 'BOBOTRUM'
          };
          
          const tokenSymbol = spin.tokenAddress ? tokenSymbols[spin.tokenAddress] || 'UNKNOWN' : null;
          
          return {
            id: spin.id,
            playerName: user?.username || 'Anonymous Player',
            playerAvatar: user?.farcasterPfpUrl || null,
            isWin: spin.isWin,
            tokenSymbol,
            rewardAmount: spin.rewardAmount && spin.rewardAmount !== '0' 
              ? (parseFloat(spin.rewardAmount) / 1e18).toFixed(1) 
              : null,
            timestamp: spin.timestamp,
            isTemporary: spin.userId?.startsWith('temp_') || false
          };
        })
      );
      
      res.json({
        spins: enhancedSpins,
        count: enhancedSpins.length
      });
    } catch (error) {
      console.error('Get recent spins error:', error);
      res.status(500).json({ error: "Failed to get recent spins" });
    }
  });
}