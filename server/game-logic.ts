// New game logic with server-side randomness and probability control
export interface SpinResult {
  segment: string;
  isWin: boolean;
  tokenType: string;
  tokenAddress: string;
  rewardAmount: string;
  randomSeed: string;
}

// Token configurations - MUST match the deployed contract addresses!
export const TOKEN_CONFIG = {
  TOKEN1: {
    address: "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4", // AIDOGE Test Token in Contract
    symbol: "AIDOGE"
  },
  TOKEN2: {
    address: "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19", // BOOP Test Token in Contract
    symbol: "BOOP"
  },
  TOKEN3: {
    address: "0x0E1CD6557D2BA59C61c75850E674C2AD73253952", // BOBOTRUM Test Token in Contract
    symbol: "BOBOTRUM"
  }
} as const;

// Generate random reward amount between 20-50 tokens
function generateRandomReward(): string {
  const minTokens = 20;
  const maxTokens = 50;
  const randomTokens = Math.floor(Math.random() * (maxTokens - minTokens + 1)) + minTokens;
  // Convert to Wei (multiply by 10^18)
  return (BigInt(randomTokens) * BigInt("1000000000000000000")).toString();
}

// Wheel segments with probabilities - 30% win rate for true 80/20 distribution
const WHEEL_SEGMENTS = [
  { name: 'AIDOGE', weight: 10 }, // 10% - random 20-50 tokens
  { name: 'BUST', weight: 66 },   // 66% - no win (reduced to make room for jackpot)
  { name: 'BOOP', weight: 8 },    // 8% - random 20-50 tokens  
  { name: 'BONUS', weight: 2 },   // 2% - random 20-50 tokens (rare)
  { name: 'ARB', weight: 6 },     // 6% - random 20-50 tokens
  { name: 'BUST', weight: 1 },    // 1% - no win
  { name: 'AIDOGE', weight: 0 },  // 0% - removed
  { name: 'JACKPOT', weight: 7 }, // 7% - random 20-50 tokens (better jackpot odds!)
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

// Generate beginner-friendly winning segment  
function getBeginnerWinSegment(): string {
  const beginnerSegments = [
    { name: 'AIDOGE', weight: 40 }, // random 20-50 tokens
    { name: 'BOOP', weight: 30 },   // random 20-50 tokens  
    { name: 'ARB', weight: 25 },    // random 20-50 tokens
    { name: 'BONUS', weight: 5 },   // random 20-50 tokens (rare treat)
  ];
  
  const totalWeight = beginnerSegments.reduce((sum, segment) => sum + segment.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const segment of beginnerSegments) {
    currentWeight += segment.weight;
    if (random <= currentWeight) {
      return segment.name;
    }
  }
  
  return 'AIDOGE'; // Fallback to win
}

// Process a single spin with optional beginner boost
export function performSpin(isNewPlayer: boolean = false, spinsUsed: number = 0): SpinResult {
  let segment: string;
  
  // Beginner's luck: new players get much better odds 
  if (isNewPlayer) {
    if (spinsUsed === 2) {
      // On 3rd spin, guarantee a win to hook them
      segment = getBeginnerWinSegment();
    } else if (spinsUsed === 1) {
      // On 2nd spin, 70% win chance 
      segment = Math.random() < 0.7 ? getBeginnerWinSegment() : getRandomSegment();
    } else {
      // On 1st spin, 90% win chance to start strong
      segment = Math.random() < 0.9 ? getBeginnerWinSegment() : getRandomSegment();
    }
  } else {
    segment = getRandomSegment();
  }
  
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
      rewardAmount = generateRandomReward(); // Random 20-50 tokens
      break;
      
    case 'BOOP':
      isWin = true;
      tokenType = "TOKEN2";
      tokenAddress = TOKEN_CONFIG.TOKEN2.address || "";
      rewardAmount = generateRandomReward(); // Random 20-50 tokens
      break;
      
    case 'ARB':
      isWin = true;
      tokenType = "TOKEN3";
      tokenAddress = TOKEN_CONFIG.TOKEN3.address || "";
      rewardAmount = generateRandomReward(); // Random 20-50 tokens
      break;
      
    case 'BONUS':
      isWin = true;
      tokenType = "TOKEN2";
      tokenAddress = TOKEN_CONFIG.TOKEN2.address || "";
      rewardAmount = generateRandomReward(); // Random 20-50 tokens
      break;
      
    case 'JACKPOT':
      isWin = true;
      tokenType = "TOKEN1";
      tokenAddress = TOKEN_CONFIG.TOKEN1.address || "";
      rewardAmount = generateRandomReward(); // Random 20-50 tokens
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