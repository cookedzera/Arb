// New game logic with server-side randomness and probability control
export interface SpinResult {
  segment: string;
  isWin: boolean;
  tokenType: string;
  tokenAddress: string;
  rewardAmount: string;
  randomSeed: string;
}

// Token configurations - reduced amounts for 80/20 distribution  
export const TOKEN_CONFIG = {
  TOKEN1: {
    address: "",
    symbol: "AIDOGE", 
    rewardAmount: "500000000000000000" // 0.5 AIDOGE
  },
  TOKEN2: {
    address: "",
    symbol: "BOOP",
    rewardAmount: "500000000000000000" // 0.5 BOOP
  },
  TOKEN3: {
    address: "",
    symbol: "ARB",
    rewardAmount: "250000000000000000" // 0.25 ARB
  }
} as const;

// Wheel segments with probabilities - 80% get max 2 tokens, 20% get 3+ tokens
const WHEEL_SEGMENTS = [
  { name: 'AIDOGE', weight: 15 }, // 15% - 0.5 tokens
  { name: 'BUST', weight: 35 },   // 35% - no win
  { name: 'BOOP', weight: 20 },   // 20% - 0.5 tokens  
  { name: 'BONUS', weight: 5 },   // 5% - 1 token (2x 0.5)
  { name: 'ARB', weight: 20 }, // 20% - 0.25 tokens
  { name: 'BUST', weight: 3 },   // 3% - no win
  { name: 'AIDOGE', weight: 1 },  // 1% - 0.5 tokens
  { name: 'JACKPOT', weight: 1 }, // 1% - 2 tokens (rare big win)
];

// Calculate winning probabilities based on user's daily spin count
export function calculateWinProbabilities(spinsUsedToday: number): {
  winAll3: number;
  win2: number;
  win1: number;
  winNone: number;
} {
  // Base probabilities for individual wins
  const baseWinRate = 0.35; // 35% base win rate per spin
  
  // Adjust based on spins used (slightly favor users who haven't won yet)
  const adjustedWinRate = spinsUsedToday === 0 ? baseWinRate * 1.1 : 
                         spinsUsedToday === 1 ? baseWinRate : 
                         baseWinRate * 0.9;

  // Calculate compound probabilities for 3 spins
  const winAll3 = Math.pow(adjustedWinRate, 3); // ~4.3%
  const win2 = 3 * Math.pow(adjustedWinRate, 2) * (1 - adjustedWinRate); // ~24%
  const win1 = 3 * adjustedWinRate * Math.pow(1 - adjustedWinRate, 2); // ~41%
  const winNone = Math.pow(1 - adjustedWinRate, 3); // ~27%

  return { winAll3, win2, win1, winNone };
}

// Generate weighted random segment
function getRandomSegment(): string {
  const totalWeight = WHEEL_SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const segment of WHEEL_SEGMENTS) {
    currentWeight += segment.weight;
    if (random <= currentWeight) {
      return segment.name;
    }
  }
  
  return 'BUST'; // Fallback
}

// Process a single spin
export function performSpin(): SpinResult {
  const segment = getRandomSegment();
  const randomSeed = Math.random().toString() + Date.now().toString();
  
  let isWin = false;
  let tokenType = "";
  let tokenAddress = "";
  let rewardAmount = "0";
  
  switch (segment) {
    case 'AIDOGE':
      isWin = true;
      tokenType = "TOKEN1";
      tokenAddress = TOKEN_CONFIG.TOKEN1.address || "";
      rewardAmount = TOKEN_CONFIG.TOKEN1.rewardAmount;
      break;
      
    case 'BOOP':
      isWin = true;
      tokenType = "TOKEN2";
      tokenAddress = TOKEN_CONFIG.TOKEN2.address || "";
      rewardAmount = TOKEN_CONFIG.TOKEN2.rewardAmount;
      break;
      
    case 'ARB':
      isWin = true;
      tokenType = "TOKEN3";
      tokenAddress = TOKEN_CONFIG.TOKEN3.address || "";
      rewardAmount = TOKEN_CONFIG.TOKEN3.rewardAmount;
      break;
      
    case 'BONUS':
      isWin = true;
      tokenType = "TOKEN2";
      tokenAddress = TOKEN_CONFIG.TOKEN2.address || "";
      rewardAmount = "1000000000000000000"; // 2x 0.5 BOOP = 1 token
      break;
      
    case 'JACKPOT':
      isWin = true;
      tokenType = "TOKEN1";
      tokenAddress = TOKEN_CONFIG.TOKEN1.address || "";
      rewardAmount = "2000000000000000000"; // 4x 0.5 AIDOGE = 2 tokens
      break;
      
    default: // BUST
      isWin = false;
      tokenType = "BUST";
      tokenAddress = "0x0000000000000000000000000000000000000000";
      rewardAmount = "0";
  }
  
  return {
    segment,
    isWin,
    tokenType,
    tokenAddress,
    rewardAmount,
    randomSeed
  };
}

// Process daily spins with probability adjustments
export function performDailySpins(userId: string, userSpinsUsed: number): SpinResult[] {
  const spinsRemaining = Math.max(0, 3 - userSpinsUsed);
  
  if (spinsRemaining === 0) {
    throw new Error("Daily spin limit reached");
  }
  
  const results: SpinResult[] = [];
  
  for (let i = 0; i < spinsRemaining; i++) {
    const result = performSpin();
    results.push(result);
  }
  
  return results;
}