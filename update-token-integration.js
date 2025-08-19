// Script to update the application with proper test tokens and rewards

const updateConfig = {
  // Contract addresses after deployment
  contracts: {
    wheelGame: "0x4be6dd3897fd6fbc8a619c69fa6f4bd94531d90a",
    tokens: {
      IARB: "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4",    // Base reward token
      JUICE: "0x0E1CD6557D2BA59C61c75850E674C2AD73253952",   // Medium reward token  
      ABET: "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19"     // High reward token
    }
  },
  
  // Wheel segments and their corresponding rewards
  wheelSegments: [
    { segment: "IARB", token: "TOKEN1", baseReward: "1000000000000000000" },     // 1 IARB
    { segment: "BUST", token: null, baseReward: "0" },
    { segment: "JUICE", token: "TOKEN2", baseReward: "2000000000000000000" },    // 2 JUICE
    { segment: "BONUS", token: "random", multiplier: 2 },                        // 2x random token
    { segment: "ABET", token: "TOKEN3", baseReward: "500000000000000000" },      // 0.5 ABET
    { segment: "BUST", token: null, baseReward: "0" },
    { segment: "IARB", token: "TOKEN1", baseReward: "1000000000000000000" },     // 1 IARB
    { segment: "JACKPOT", token: "random", multiplier: 10 }                      // 10x random token
  ],
  
  // Token information for display
  tokenInfo: {
    TOKEN1: { symbol: "IARB", name: "IARB Token", decimals: 18, color: "#FF6B6B" },
    TOKEN2: { symbol: "JUICE", name: "JUICE Token", decimals: 18, color: "#4ECDC4" }, 
    TOKEN3: { symbol: "ABET", name: "ABET Token", decimals: 18, color: "#45B7D1" }
  },
  
  // Claim functionality
  claimRules: {
    minClaimAmount: "100000000000000000", // 0.1 tokens minimum
    claimCooldown: 0, // No cooldown for testnet
    autoClaimThreshold: "10000000000000000000" // Auto-suggest claim at 10 tokens
  }
};

console.log("🔧 Token integration configuration:");
console.log(JSON.stringify(updateConfig, null, 2));

module.exports = updateConfig;