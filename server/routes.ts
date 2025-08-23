import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { leaderboardService } from "./leaderboard";
import { insertSpinResultSchema, insertTokenSchema } from "@shared/schema";
import { ethers } from "ethers";
import { z } from "zod";
import { createFarcasterAuthMiddleware, verifyFarcasterToken, getUserByAddress } from "./farcaster";
import { blockchainService } from "./blockchain";
import { handleSpinResult } from "./spin-result-route";
import { registerSpinRoutes } from "./spin-routes";
import { registerShareRoutes } from "./share-routes";

// Routes without blockchain dependencies - will be configured fresh

export async function registerRoutes(app: Express): Promise<Server> {
  // Register new spin routes (server-based, gas-free)
  registerSpinRoutes(app);
  
  // Register claim routes for balance checking and auto-transfer
  const { registerClaimRoutes } = await import('./claim-routes');
  registerClaimRoutes(app);
  
  // Register share routes for Farcaster
  registerShareRoutes(app);
  
  // Register voting routes for token suggestions
  const { registerVotingRoutes } = await import('./voting-routes');
  registerVotingRoutes(app);
  // Update user data (for fixing Farcaster information)
  app.patch("/api/user/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Validate that it's not a temporary user
      if (id.startsWith('temp_')) {
        return res.status(400).json({ error: "Cannot update temporary users" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update the user with new data
      await storage.updateUser(id, updates);
      const updatedUser = await storage.getUser(id);
      
      console.log(`✅ Updated user ${id} with:`, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Get current user stats - handle temporary users without database queries
  app.get("/api/user/:id", async (req, res) => {
    try {
      // Handle temporary users (fun-only mode) without database operations
      if (req.params.id.startsWith('temp_')) {
        console.log(`🎮 Returning fun-only user data for: ${req.params.id}`);
        return res.json({
          id: req.params.id,
          username: `Player${req.params.id.slice(-4)}`,
          walletAddress: null,
          farcasterFid: 0,
          farcasterUsername: null,
          farcasterDisplayName: null,
          farcasterPfpUrl: null,
          spinsUsed: 0, // Always show 0 for fun users
          totalWins: 0,
          totalSpins: 0,
          isTemporary: true
        });
      }
      
      // Run queries in parallel for real database users
      const [user, spinsToday] = await Promise.all([
        storage.getUser(req.params.id),
        storage.getUserSpinsToday(req.params.id)
      ]);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ ...user, spinsUsed: spinsToday });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Create or get user by username - DATABASE STORAGE ONLY FOR FARCASTER USERS
  app.post("/api/user", async (req, res) => {
    try {
      const { username, walletAddress, farcasterFid, farcasterUsername, farcasterDisplayName, farcasterPfpUrl } = req.body;
      
      // For testing: Allow all users to be saved to database
      // In production, only save Farcaster users  
      const isValidFarcasterUser = farcasterFid && farcasterFid > 0;
      const allowAllUsersForTesting = true; // Set to false in production
      
      if (!isValidFarcasterUser && !allowAllUsersForTesting) {
        console.log(`🎮 Fun-only user (no database): ${username} (FID: ${farcasterFid})`);
        // Return temporary user data for fun gameplay without database storage
        return res.json({
          id: `temp_${Date.now()}`,
          username,
          walletAddress,
          farcasterFid: 0,
          farcasterUsername: null,
          farcasterDisplayName: null,
          farcasterPfpUrl: null,
          spinsUsed: 0,
          totalWins: 0,
          totalSpins: 0,
          isTemporary: true // Flag to indicate this is not stored
        });
      }
      
      // Look up user by Farcaster FID first (permanent identifier), then fallback to username
      let user = await storage.getUserByFarcasterFid(farcasterFid);
      if (!user) {
        // Fallback to username lookup for users created before FID-based authentication
        user = await storage.getUserByUsername(username);
      }
      
      if (!user) {
        // Create new user with Farcaster data if provided (filter out invalid URLs)
        const validPfpUrl = farcasterPfpUrl && !farcasterPfpUrl.includes('309c4432-ce5e-4e2c-a2f4-50a0f8e21f00') ? farcasterPfpUrl : null;
        user = await storage.createUser({ 
          username, 
          walletAddress,
          farcasterFid,
          farcasterUsername,
          farcasterDisplayName, 
          farcasterPfpUrl: validPfpUrl
        });
        console.log(`✅ Created new Farcaster user: ${username} (FID: ${farcasterFid})`);
      } else {
        // Update user data for returning users (username/display name might have changed)
        const updates: any = {};
        if (username && user.username !== username) updates.username = username;
        if (farcasterUsername && user.farcasterUsername !== farcasterUsername) updates.farcasterUsername = farcasterUsername;
        if (farcasterDisplayName && user.farcasterDisplayName !== farcasterDisplayName) updates.farcasterDisplayName = farcasterDisplayName;
        if (walletAddress && user.walletAddress !== walletAddress) updates.walletAddress = walletAddress;
        
        // Update profile picture if provided and different
        const validPfpUrl = farcasterPfpUrl && !farcasterPfpUrl.includes('309c4432-ce5e-4e2c-a2f4-50a0f8e21f00') ? farcasterPfpUrl : null;
        if (validPfpUrl && user.farcasterPfpUrl !== validPfpUrl) updates.farcasterPfpUrl = validPfpUrl;
        
        if (Object.keys(updates).length > 0) {
          await storage.updateUser(user.id, updates);
          Object.assign(user, updates);
          console.log(`✅ Updated returning user ${user.id} (FID: ${farcasterFid}) with:`, updates);
        } else {
          console.log(`✅ Returning user: ${username} (FID: ${farcasterFid})`);
        }
      }
      
      // Try to enrich with Farcaster data if we have wallet address but missing Farcaster info
      if (walletAddress && (!user.farcasterUsername || !user.farcasterPfpUrl)) {
        try {
          const farcasterUser = await getUserByAddress(walletAddress);
          if (farcasterUser && (farcasterUser.username || farcasterUser.pfpUrl)) {
            const updates: any = {};
            if (farcasterUser.fid) updates.farcasterFid = farcasterUser.fid;
            if (farcasterUser.username) updates.farcasterUsername = farcasterUser.username;
            if (farcasterUser.displayName) updates.farcasterDisplayName = farcasterUser.displayName;
            if (farcasterUser.pfpUrl && !farcasterUser.pfpUrl.includes('309c4432-ce5e-4e2c-a2f4-50a0f8e21f00')) {
              updates.farcasterPfpUrl = farcasterUser.pfpUrl;
            }
            if (farcasterUser.bio) updates.farcasterBio = farcasterUser.bio;
            
            if (Object.keys(updates).length > 0) {
              await storage.updateUser(user.id, updates);
              Object.assign(user, updates);
              console.log(`✅ Enriched user ${username} with Farcaster data:`, updates);
            }
          }
        } catch (farcasterError) {
          // Silently handle Farcaster enrichment errors
          console.log(`ℹ️ Could not enrich user ${username} with Farcaster data:`, (farcasterError as Error).message);
        }
      }
      
      const spinsToday = await storage.getUserSpinsToday(user.id);
      res.json({ ...user, spinsUsed: spinsToday });
    } catch (error) {
      res.status(500).json({ error: "Failed to create/get user" });
    }
  });

  // Perform spin - FARCASTER DATABASE STORAGE ONLY
  app.post("/api/spin", async (req, res) => {
    try {
      const { userId, userAddress } = req.body;
      
      // Check if this is a temporary user (fun-only, no database)
      if (userId.startsWith('temp_')) {
        console.log(`🎮 Fun-only spin (no database storage): ${userId}`);
        return res.status(200).json({ 
          message: "Fun mode spin - results not saved",
          canSpin: true,
          isTemporary: true
        });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only Farcaster users with valid FID get database storage
      if (!user.farcasterFid || user.farcasterFid <= 0) {
        console.log(`🎮 Converting to fun-only mode for user: ${user.username}`);
        return res.status(200).json({ 
          message: "Fun mode - results not saved to database",
          canSpin: true,
          isTemporary: true
        });
      }

      const spinsToday = await storage.getUserSpinsToday(userId);
      if (spinsToday >= 3) {
        return res.status(400).json({ error: "Daily spin limit reached" });
      }

      // Blockchain integration will be implemented when contracts are ready
      console.log(`🎰 Spin request for user ${userId} - blockchain integration pending`);
      
      // For now, return a clear message until contracts are deployed
      res.status(503).json({ 
        error: "Blockchain integration not yet configured - contracts need to be deployed first",
        message: "Please deploy contracts first to enable spinning functionality"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to perform spin" });
    }
  });

  // Parse user's transaction for spin result (user pays gas fees)
  app.post("/api/spin-result", handleSpinResult);

  // Get game statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getGameStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Contract events-based leaderboard - optimized with caching
  const leaderboardCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 30 * 1000; // 30 seconds cache
  
  app.get("/api/leaderboard", async (req, res) => {
    const { category = 'wins', limit = 10 } = req.query;
    const cacheKey = `${category}-${limit}`;
    
    try {
      // Check cache first
      const cached = leaderboardCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }
      
      // Sync latest data from contract (non-blocking)
      leaderboardService.syncLeaderboardData().catch(console.error);
      
      const leaderboard = await leaderboardService.getLeaderboard(
        category as 'wins' | 'spins' | 'rewards',
        parseInt(limit as string) || 10
      );
      
      // Cache the result
      leaderboardCache.set(cacheKey, { data: leaderboard, timestamp: Date.now() });
      
      res.json(leaderboard);
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/weekly", async (req, res) => {
    const { limit = 10 } = req.query;
    
    try {
      const weeklyLeaderboard = await leaderboardService.getWeeklyLeaderboard(
        parseInt(limit as string) || 10
      );
      
      res.json(weeklyLeaderboard);
    } catch (error) {
      console.error("Weekly leaderboard error:", error);
      res.status(500).json({ error: "Failed to fetch weekly leaderboard" });
    }
  });

  app.get("/api/player/:address/rank", async (req, res) => {
    const { address } = req.params;
    const { category = 'wins' } = req.query;
    
    try {
      const playerRank = await leaderboardService.getPlayerRank(
        address,
        category as 'wins' | 'spins' | 'rewards'
      );
      
      if (!playerRank) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      res.json(playerRank);
    } catch (error) {
      console.error("Player rank error:", error);
      res.status(500).json({ error: "Failed to fetch player rank" });
    }
  });

  // Auto-transfer status - no accumulated balances anymore
  app.get("/api/user/:id/balances", async (req, res) => {
    try {
      // All users get the same response: auto-transfer enabled
      res.json({
        autoTransferEnabled: true,
        message: "Tokens are automatically transferred to your wallet when you win"
      });
    } catch (error) {
      console.error('Get auto-transfer status error:', error);
      res.status(500).json({ error: "Failed to get auto-transfer status" });
    }
  });

  // Claim endpoint removed - auto-transfer only now
  app.post("/api/claim", async (req, res) => {
    res.status(410).json({ 
      error: "Claiming is no longer available",
      message: "Tokens are now automatically transferred to your wallet when you win!"
    });
  });

  // Claim history endpoint removed - auto-transfer only now
  app.get("/api/user/:id/claims", async (req, res) => {
    res.status(410).json({ 
      error: "Claim history is no longer available",
      message: "Tokens are now automatically transferred to your wallet!"
    });
  });

  // Token management routes
  app.get("/api/tokens", async (req, res) => {
    try {
      const tokens = await storage.getTokens();
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tokens" });
    }
  });

  app.get("/api/tokens/active", async (req, res) => {
    try {
      const activeTokens = await storage.getActiveTokens();
      res.json(activeTokens);
    } catch (error) {
      res.status(500).json({ error: "Failed to get active tokens" });
    }
  });

  app.post("/api/tokens", async (req, res) => {
    try {
      const tokenData = insertTokenSchema.parse(req.body);
      const token = await storage.createToken(tokenData);
      res.json(token);
    } catch (error) {
      res.status(500).json({ error: "Failed to create token" });
    }
  });

  app.put("/api/tokens/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const token = await storage.updateToken(id, updates);
      if (!token) {
        return res.status(404).json({ error: "Token not found" });
      }
      res.json(token);
    } catch (error) {
      res.status(500).json({ error: "Failed to update token" });
    }
  });

  // Farcaster authentication endpoint
  app.get("/api/farcaster/me", async (req, res) => {
    try {
      const authorization = req.headers.authorization;
      
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authorization.split(' ')[1];
      const domain = req.headers.host || 'localhost';
      
      const farcasterUser = await verifyFarcasterToken(token, domain);
      
      res.json(farcasterUser);
    } catch (error) {
      console.error('Farcaster auth error:', error);
      res.status(401).json({ error: 'Invalid Farcaster authentication' });
    }
  });

  // Test endpoint to verify Hub API is working
  app.get("/api/farcaster/test/:fid", async (req, res) => {
    try {
      const fid = parseInt(req.params.fid);
      
      if (isNaN(fid)) {
        return res.status(400).json({ error: "Invalid FID" });
      }

      console.log(`🧪 Testing Hub API with FID: ${fid}`);
      
      const response = await fetch(`https://hub.pinata.cloud/v1/userDataByFid?fid=${fid}`);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Hub API returned ${response.status}` });
      }

      const data = await response.json();
      console.log(`📦 Raw Hub API response for FID ${fid}:`, JSON.stringify(data, null, 2));
      
      res.json(data);
    } catch (error) {
      console.error('Hub API test error:', error);
      res.status(500).json({ error: "Failed to test Hub API" });
    }
  });

  // Get Farcaster user by Ethereum address
  app.post("/api/farcaster/user-by-address", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: 'Address is required' });
      }

      const farcasterUser = await getUserByAddress(address);
      
      if (farcasterUser) {
        res.json(farcasterUser);
      } else {
        res.status(404).json({ error: 'No Farcaster profile found for this address' });
      }
    } catch (error) {
      console.error('Error fetching user by address:', error);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  // URGENT: Fix cooldown for gaming experience
  app.post("/api/fix-cooldown", async (req, res) => {
    try {
      console.log("🎮 Fixing cooldown for better gaming experience...");
      
      const currentCooldown = await blockchainService.getCooldownPeriod();
      console.log(`Current cooldown: ${currentCooldown} seconds`);
      
      if (currentCooldown > 5) {
        const result = await blockchainService.setCooldownPeriod(5);
        if (result.success) {
          res.json({ 
            success: true, 
            message: `Cooldown reduced from ${currentCooldown}s to 5s for better gaming!`,
            oldCooldown: currentCooldown,
            newCooldown: 5
          });
        } else {
          res.json({ 
            success: false, 
            error: result.error,
            currentCooldown 
          });
        }
      } else {
        res.json({ 
          success: true, 
          message: `Cooldown already optimized at ${currentCooldown}s`,
          currentCooldown 
        });
      }
    } catch (error: any) {
      console.error("Error fixing cooldown:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Configuration endpoint for frontend
  app.get("/api/config", async (req, res) => {
    try {
      const contractAddress = await blockchainService.getContractAddress();
      const tokenAddresses = await blockchainService.getTokenAddresses();
      const chainId = await blockchainService.getChainId();
      
      res.json({
        contractAddress,
        tokenAddresses,
        chainId
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get configuration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
