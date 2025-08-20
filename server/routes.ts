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

// Routes without blockchain dependencies - will be configured fresh

export async function registerRoutes(app: Express): Promise<Server> {
  // Register new spin and claim routes
  registerSpinRoutes(app);
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
      
      // Allow all users to access the app, but only save Farcaster users to database
      const isValidFarcasterUser = farcasterFid && farcasterFid > 0;
      
      if (!isValidFarcasterUser) {
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
      
      let user = await storage.getUserByUsername(username);
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
      } else if (walletAddress && user.walletAddress !== walletAddress) {
        // Update wallet address if different
        await storage.updateUser(user.id, { walletAddress });
        user.walletAddress = walletAddress;
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

  // Get user's accumulated token balances - handle temporary users
  app.get("/api/user/:id/balances", async (req, res) => {
    try {
      // Handle temporary users (fun-only mode) - return zero balances
      if (req.params.id.startsWith('temp_')) {
        console.log(`🎮 Returning fun-only balances for: ${req.params.id}`);
        return res.json({
          token1: "0",
          token2: "0", 
          token3: "0",
          canClaim: false,
          hasMinimumBalance: false
        });
      }
      
      // Run balance and claim queries in parallel for database users
      const [balances, claimInfo] = await Promise.all([
        storage.getUserAccumulatedBalances(req.params.id),
        storage.canUserClaim(req.params.id)
      ]);
      
      res.json({ ...balances, ...claimInfo });
    } catch (error) {
      console.error('Get balances error:', error);
      res.status(500).json({ error: "Failed to get user balances" });
    }
  });

  // Claim accumulated tokens
  app.post("/api/claim", async (req, res) => {
    try {
      const { userId } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.walletAddress) {
        return res.status(400).json({ error: "Wallet address required for claiming" });
      }

      const claimInfo = await storage.canUserClaim(userId);
      
      // For testing: allow claims even if threshold not met
      console.log("🧪 TESTING MODE - Force claim: Bypassing minimum threshold requirements");

      const balances = await storage.getUserAccumulatedBalances(userId);
      
      // Token addresses will be configured when contracts are deployed
      const tokenAddresses = await blockchainService.getTokenAddresses();

      let transactionHash = null;
      let claimStatus = "pending";

      try {
        // For now, we'll simulate the transfer and just record the claim
        // In production, you'd batch transfer all tokens in a single transaction
        console.log(`🚀 Claiming tokens for user ${userId}:`);
        console.log(`  TOKEN1: ${balances.token1}`);
        console.log(`  TOKEN2: ${balances.token2}`);
        console.log(`  TOKEN3: ${balances.token3}`);
        console.log(`  Total Value: $${claimInfo.totalValueUSD}`);

        // Create the claim record
        const tokenClaim = await storage.createTokenClaim({
          userId,
          token1Amount: balances.token1,
          token2Amount: balances.token2,
          token3Amount: balances.token3,
          totalValueUSD: claimInfo.totalValueUSD,
          transactionHash: null, // Will be updated when transaction is confirmed
          status: "pending"
        });

        // Reset user's accumulated balances and update claimed totals
        await storage.updateUser(userId, {
          accumulatedToken1: "0",
          accumulatedToken2: "0", 
          accumulatedToken3: "0",
          claimedToken1: (BigInt(user.claimedToken1 || '0') + BigInt(balances.token1)).toString(),
          claimedToken2: (BigInt(user.claimedToken2 || '0') + BigInt(balances.token2)).toString(),
          claimedToken3: (BigInt(user.claimedToken3 || '0') + BigInt(balances.token3)).toString(),
          lastClaimDate: new Date()
        });

        res.json({ 
          success: true, 
          claim: tokenClaim,
          message: "Tokens claimed successfully! They will be transferred to your wallet soon."
        });

      } catch (error) {
        console.error("❌ Claim failed:", error);
        res.status(500).json({ error: "Failed to process claim" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to claim tokens" });
    }
  });

  // Get user's claim history
  app.get("/api/user/:id/claims", async (req, res) => {
    try {
      const claims = await storage.getUserClaims(req.params.id);
      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user claims" });
    }
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
