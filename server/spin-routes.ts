import type { Express } from "express";
import { storage } from "./storage";
import { performSpin, TOKEN_CONFIG } from "./game-logic";
import { ethers } from "ethers";

// ERC20 ABI for token claiming
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

// Simple claim contract ABI (we'll create this next)
const CLAIM_ABI = [
  "function claimSingle(address tokenAddress, uint256 amount, address recipient) external returns (bool)",
  "function claimBatch(address[] tokenAddresses, uint256[] amounts, address recipient) external returns (bool)",
  "function getClaimableAmount(address user, address token) external view returns (uint256)"
];

export function registerSpinRoutes(app: Express) {
  
  // Free server-side spinning - DATABASE STORAGE ONLY FOR FARCASTER USERS
  app.post("/api/spin-free", async (req, res) => {
    try {
      const { userId, userAddress } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      // Handle temporary users (fun-only mode) with consistent beginner luck
      if (userId.startsWith('temp_')) {
        console.log(`🎮 Fun-only spin: ${userId}`);
        // Temp users get consistent beginner luck (70% win rate)
        const isBeginnerWin = Math.random() < 0.7;
        const spinResult = isBeginnerWin ? 
          performSpin(true, 0) : // Use beginner logic for wins
          performSpin(false, 0); // Use normal logic for occasional busts
        return res.json({
          ...spinResult,
          spinsRemaining: 3, // Always show 3 for temp users
          isTemporary: true,
          message: "Fun mode with beginner luck! 🍀"
        });
      }
      
      // Get user's current daily spin count for database users
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only save to database for valid Farcaster users
      const isValidFarcasterUser = user.farcasterFid && user.farcasterFid > 0;
      if (!isValidFarcasterUser) {
        console.log(`🎮 Fun-only spin for non-Farcaster user: ${user.username}`);
        // Check if user is new (no spins recorded)
        const isNewPlayer = !user.lastSpinDate;
        const spinResult = performSpin(isNewPlayer, 0);
        return res.json({
          ...spinResult,
          spinsRemaining: 3, // Always show 3 for fun-only
          isTemporary: true,
          message: isNewPlayer ? "Fun mode with beginner luck! 🍀" : "Fun mode - results not saved"
        });
      }
      
      // Check daily limit (3 spins)
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const lastSpinDate = user.lastSpinDate ? new Date(user.lastSpinDate) : null;
      const lastSpinDay = lastSpinDate ? new Date(lastSpinDate.getFullYear(), lastSpinDate.getMonth(), lastSpinDate.getDate()) : null;
      
      const isNewDay = !lastSpinDay || lastSpinDay.getTime() !== todayStart.getTime();
      
      const currentSpinsUsed = isNewDay ? 0 : (typeof user.spinsUsed === 'string' ? parseInt(user.spinsUsed, 10) || 0 : user.spinsUsed || 0);
      
      if (currentSpinsUsed >= 3) {
        return res.status(400).json({ 
          error: "Daily spin limit reached",
          spinsRemaining: 0,
          currentSpinsUsed: currentSpinsUsed,
          isNewDay: isNewDay,
          nextSpinAvailable: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        });
      }
      
      // Check if user is new (less than 3 total spins ever)
      const totalSpinsEver = user.totalSpins || 0;
      const isNewPlayer = totalSpinsEver < 3;
      
      // Perform the spin with beginner logic for new players
      const spinResult = performSpin(isNewPlayer, currentSpinsUsed);
      
      // Save spin result to database
      const savedResult = await storage.addSpinResult({
        userId,
        symbols: [spinResult.segment, spinResult.segment, spinResult.segment],
        isWin: spinResult.isWin,
        rewardAmount: spinResult.rewardAmount,
        tokenType: spinResult.tokenType,
        tokenAddress: spinResult.isWin ? spinResult.tokenAddress : null,
        isAccumulated: spinResult.isWin, // Winners accumulate for claiming
        claimType: null, // Not claimed yet
        transactionHash: null // No transaction yet (server-side spin)
      });
      
      // Update user's accumulated rewards if they won
      if (spinResult.isWin) {
        const rewardAmountBigInt = BigInt(spinResult.rewardAmount);
        
        let updateData: any = {
          totalWins: (user.totalWins || 0) + 1
        };
        
        // Add to appropriate accumulated token balance
        switch (spinResult.tokenType) {
          case 'TOKEN1':
            const currentToken1 = BigInt(user.accumulatedToken1 || "0");
            updateData.accumulatedToken1 = (currentToken1 + rewardAmountBigInt).toString();
            break;
          case 'TOKEN2':
            const currentToken2 = BigInt(user.accumulatedToken2 || "0");
            updateData.accumulatedToken2 = (currentToken2 + rewardAmountBigInt).toString();
            break;
          case 'TOKEN3':
            const currentToken3 = BigInt(user.accumulatedToken3 || "0");
            updateData.accumulatedToken3 = (currentToken3 + rewardAmountBigInt).toString();
            break;
        }
        
        // Combine win data with spin count update
        const finalUpdateData = {
          ...updateData,
          spinsUsed: currentSpinsUsed + 1,
          totalSpins: (user.totalSpins || 0) + 1,
          lastSpinDate: new Date()
        };
        await storage.updateUser(userId, finalUpdateData);
      } else {
        // No win - just update spin count
        await storage.updateUser(userId, {
          spinsUsed: currentSpinsUsed + 1,
          totalSpins: (user.totalSpins || 0) + 1,
          lastSpinDate: new Date()
        });
      }
      
      res.json({
        ...spinResult,
        spinsRemaining: 3 - (currentSpinsUsed + 1),
        totalAccumulated: await getUserAccumulatedRewards(userId)
      });
      
    } catch (error: any) {
      console.error("Free spin error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // REMOVED: Direct token sending claim endpoint
  // Users must now claim through Farcaster wallet popup in ClaimModal
  
  // REMOVED: Direct batch claim endpoint
  // Users must now claim through Farcaster wallet popup in ClaimModal
}

// REMOVED: Direct token sending function
// All tokens must now be claimed through Farcaster wallet popup
// This ensures users pay their own gas and sign their own transactions

// Helper function to get user's accumulated rewards
async function getUserAccumulatedRewards(userId: string) {
  const user = await storage.getUserById(userId);
  if (!user) return null;
  
  return {
    AIDOGE: user.accumulatedToken1 || "0",
    BOOP: user.accumulatedToken2 || "0", 
    ARB: user.accumulatedToken3 || "0"
  };
}