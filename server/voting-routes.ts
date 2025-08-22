import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";

// Token vote validation schema
const tokenVoteSchema = z.object({
  tokenName: z.string().min(1).max(50),
  tokenSymbol: z.string().min(1).max(10),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address").optional(),
  description: z.string().max(200).optional()
});

export function registerVotingRoutes(app: Express) {
  
  // Get popular token suggestions
  app.get("/api/voting/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const popularTokens = await storage.getPopularTokens(limit);
      
      res.json({
        tokens: popularTokens,
        count: popularTokens.length
      });
    } catch (error) {
      console.error('Get popular tokens error:', error);
      res.status(500).json({ error: "Failed to get popular tokens" });
    }
  });

  // Submit a new token suggestion or vote for existing one
  app.post("/api/voting/vote", async (req, res) => {
    try {
      const { userId, ...voteData } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }

      // Skip temporary users
      if (userId.startsWith('temp_')) {
        return res.status(400).json({ 
          error: "Please connect with Farcaster to vote for tokens",
          requiresAuth: true
        });
      }

      // Validate vote data
      const validatedData = tokenVoteSchema.parse(voteData);
      
      // Check if user exists
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Vote for the token (this will increment existing or create new)
      const vote = await storage.voteForToken(userId, validatedData.tokenName);
      
      if (!vote) {
        // Create new vote if doesn't exist
        const newVote = await storage.createTokenVote({
          userId,
          ...validatedData
        });
        
        res.json({
          success: true,
          message: "Token suggestion submitted successfully!",
          vote: newVote
        });
      } else {
        res.json({
          success: true,
          message: "Vote recorded successfully!",
          vote
        });
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid vote data", 
          details: error.errors 
        });
      }
      
      console.error('Vote submission error:', error);
      res.status(500).json({ error: "Failed to submit vote" });
    }
  });

  // Get all token votes (for admin)
  app.get("/api/voting/all", async (req, res) => {
    try {
      const allVotes = await storage.getTokenVotes();
      
      res.json({
        votes: allVotes,
        count: allVotes.length
      });
    } catch (error) {
      console.error('Get all votes error:', error);
      res.status(500).json({ error: "Failed to get votes" });
    }
  });

  // Get user's voting history
  app.get("/api/voting/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (userId.startsWith('temp_')) {
        return res.json({ votes: [] });
      }
      
      // This would need a new storage method to get user's votes
      // For now return empty array
      res.json({ votes: [] });
      
    } catch (error) {
      console.error('Get user votes error:', error);
      res.status(500).json({ error: "Failed to get user votes" });
    }
  });
}