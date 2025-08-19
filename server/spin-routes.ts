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
  
  // Free server-side spinning (no blockchain)
  app.post("/api/spin-free", async (req, res) => {
    try {
      const { userId, userAddress } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      // Get user's current daily spin count
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
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
      
      // Perform the spin (server-side randomness)
      const spinResult = performSpin();
      
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
        
        await storage.updateUser(userId, updateData);
      }
      
      // Update user's spin count
      await storage.updateUser(userId, {
        spinsUsed: currentSpinsUsed + 1,
        totalSpins: (user.totalSpins || 0) + 1,
        lastSpinDate: new Date()
      });
      
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
  
  // Claim single token reward
  app.post("/api/claim-single", async (req, res) => {
    try {
      const { userId, userAddress, tokenType } = req.body;
      
      if (!userId || !userAddress || !tokenType) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get accumulated amount for the token
      let accumulatedAmount = "0";
      let tokenConfig;
      
      switch (tokenType) {
        case 'TOKEN1':
          accumulatedAmount = user.accumulatedToken1 || "0";
          tokenConfig = TOKEN_CONFIG.TOKEN1;
          break;
        case 'TOKEN2':
          accumulatedAmount = user.accumulatedToken2 || "0";
          tokenConfig = TOKEN_CONFIG.TOKEN2;
          break;
        case 'TOKEN3':
          accumulatedAmount = user.accumulatedToken3 || "0";
          tokenConfig = TOKEN_CONFIG.TOKEN3;
          break;
        default:
          return res.status(400).json({ error: "Invalid token type" });
      }
      
      if (BigInt(accumulatedAmount) <= 0) {
        return res.status(400).json({ error: "No tokens to claim for this type" });
      }
      
      // Send tokens to user (direct transfer from project wallet)
      const txHash = await sendTokensToUser(userAddress, tokenConfig.address, accumulatedAmount);
      
      // Reset accumulated amount and update claimed amount
      const updateData: any = {};
      switch (tokenType) {
        case 'AIDOGE':
          updateData.accumulatedToken1 = "0";
          updateData.claimedToken1 = (BigInt(user.claimedToken1 || "0") + BigInt(accumulatedAmount)).toString();
          break;
        case 'BOOP':
          updateData.accumulatedToken2 = "0";
          updateData.claimedToken2 = (BigInt(user.claimedToken2 || "0") + BigInt(accumulatedAmount)).toString();
          break;
        case 'BOBOTRUM':
          updateData.accumulatedToken3 = "0";
          updateData.claimedToken3 = (BigInt(user.claimedToken3 || "0") + BigInt(accumulatedAmount)).toString();
          break;
      }
      updateData.lastClaimDate = new Date();
      
      await storage.updateUser(userId, updateData);
      
      // Record the claim
      await storage.addTokenClaim({
        userId,
        token1Amount: tokenType === 'AIDOGE' ? accumulatedAmount : "0",
        token2Amount: tokenType === 'BOOP' ? accumulatedAmount : "0",
        token3Amount: tokenType === 'BOBOTRUM' ? accumulatedAmount : "0",
        totalValueUSD: "0", // Calculate later if needed
        transactionHash: txHash,
        status: "confirmed"
      });
      
      res.json({
        success: true,
        transactionHash: txHash,
        amount: accumulatedAmount,
        tokenType,
        remaining: await getUserAccumulatedRewards(userId)
      });
      
    } catch (error: any) {
      console.error("Single claim error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Claim all accumulated rewards in one transaction
  app.post("/api/claim-batch", async (req, res) => {
    try {
      const { userId, userAddress } = req.body;
      
      if (!userId || !userAddress) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const token1Amount = user.accumulatedToken1 || "0";
      const token2Amount = user.accumulatedToken2 || "0";
      const token3Amount = user.accumulatedToken3 || "0";
      
      // Check if there's anything to claim
      const totalToClaim = BigInt(token1Amount) + BigInt(token2Amount) + BigInt(token3Amount);
      if (totalToClaim <= 0) {
        return res.status(400).json({ error: "No tokens to claim" });
      }
      
      const txHashes: string[] = [];
      
      // Send each token type if amount > 0
      if (BigInt(token1Amount) > 0) {
        const txHash = await sendTokensToUser(userAddress, TOKEN_CONFIG.TOKEN1.address, token1Amount);
        txHashes.push(txHash);
      }
      
      if (BigInt(token2Amount) > 0) {
        const txHash = await sendTokensToUser(userAddress, TOKEN_CONFIG.TOKEN2.address, token2Amount);
        txHashes.push(txHash);
      }
      
      if (BigInt(token3Amount) > 0) {
        const txHash = await sendTokensToUser(userAddress, TOKEN_CONFIG.TOKEN3.address, token3Amount);
        txHashes.push(txHash);
      }
      
      // Reset all accumulated amounts and update claimed amounts
      await storage.updateUser(userId, {
        accumulatedToken1: "0",
        accumulatedToken2: "0", 
        accumulatedToken3: "0",
        claimedToken1: (BigInt(user.claimedToken1 || "0") + BigInt(token1Amount)).toString(),
        claimedToken2: (BigInt(user.claimedToken2 || "0") + BigInt(token2Amount)).toString(),
        claimedToken3: (BigInt(user.claimedToken3 || "0") + BigInt(token3Amount)).toString(),
        lastClaimDate: new Date()
      });
      
      // Record the batch claim
      await storage.addTokenClaim({
        userId,
        token1Amount,
        token2Amount,
        token3Amount,
        totalValueUSD: "0",
        transactionHash: txHashes[0] || "", // Primary transaction
        status: "confirmed"
      });
      
      res.json({
        success: true,
        transactionHashes: txHashes,
        amounts: {
          AIDOGE: token1Amount,
          BOOP: token2Amount,
          BOBOTRUM: token3Amount
        }
      });
      
    } catch (error: any) {
      console.error("Batch claim error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Helper function to send tokens to users
async function sendTokensToUser(recipientAddress: string, tokenAddress: string, amount: string): Promise<string> {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
  
  if (!PRIVATE_KEY) {
    throw new Error("Private key not configured");
  }
  
  let privateKey = PRIVATE_KEY.trim();
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey).connect(provider);
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  
  const tx = await tokenContract.transfer(recipientAddress, BigInt(amount));
  const receipt = await tx.wait();
  
  console.log(`✅ Sent ${amount} tokens to ${recipientAddress}, TX: ${tx.hash}`);
  
  return tx.hash;
}

// Helper function to get user's accumulated rewards
async function getUserAccumulatedRewards(userId: string) {
  const user = await storage.getUserById(userId);
  if (!user) return null;
  
  return {
    AIDOGE: user.accumulatedToken1 || "0",
    BOOP: user.accumulatedToken2 || "0", 
    BOBOTRUM: user.accumulatedToken3 || "0"
  };
}