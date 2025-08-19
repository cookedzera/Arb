const { ethers } = require("ethers");
require("dotenv").config();

// Contract configuration from deployment
const WHEEL_GAME_ADDRESS = "0x4be6dd3897fd6fbc8a619c69fa6f4bd94531d90a";
const TOKEN_ADDRESSES = {
  TOKEN1: "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4",
  TOKEN2: "0x0E1CD6557D2BA59C61c75850E674C2AD73253952", 
  TOKEN3: "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19"
};

const WHEEL_GAME_ABI = [
  "function spin() external returns (string memory, bool, address, uint256)",
  "function getPlayerStats(address playerAddress) external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function getPendingRewards(address playerAddress) external view returns (uint256, uint256, uint256)",
  "function getWheelSegments() external view returns (string[] memory)",
  "function claimRewards(address tokenAddress) external",
  "event SpinResult(address indexed player, string segment, bool isWin, address tokenAddress, uint256 rewardAmount, uint256 randomSeed)"
];

async function testContractInteraction() {
  console.log("🧪 Testing contract interaction...");
  
  // Setup provider and signer
  const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc";
  const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
  
  if (!PRIVATE_KEY) {
    throw new Error("❌ WALLET_PRIVATE_KEY not found");
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let privateKey = PRIVATE_KEY.trim();
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(WHEEL_GAME_ADDRESS, WHEEL_GAME_ABI, signer);
  
  console.log(`📝 Testing with account: ${signer.address}`);
  
  try {
    // Test 1: Get wheel segments
    console.log("\n🎯 Test 1: Getting wheel segments...");
    const segments = await contract.getWheelSegments();
    console.log("Wheel segments:", segments);
    
    // Test 2: Get player stats before spinning
    console.log("\n📊 Test 2: Getting player stats...");
    const statsBefore = await contract.getPlayerStats(signer.address);
    console.log("Stats before:", {
      totalSpins: statsBefore[0].toString(),
      totalWins: statsBefore[1].toString(),
      lastSpinDate: statsBefore[2].toString(),
      dailySpins: statsBefore[3].toString(),
      spinsRemaining: statsBefore[4].toString()
    });
    
    // Test 3: Get pending rewards before spinning
    console.log("\n💰 Test 3: Getting pending rewards...");
    const rewardsBefore = await contract.getPendingRewards(signer.address);
    console.log("Rewards before:", {
      token1: ethers.formatEther(rewardsBefore[0]),
      token2: ethers.formatEther(rewardsBefore[1]),
      token3: ethers.formatEther(rewardsBefore[2])
    });
    
    // Test 4: Perform a spin
    console.log("\n🎰 Test 4: Performing a spin...");
    const tx = await contract.spin();
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    
    // Parse events
    const events = receipt.logs.map(log => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    const spinEvent = events.find(event => event.name === "SpinResult");
    if (spinEvent) {
      console.log("Spin result:", {
        player: spinEvent.args.player,
        segment: spinEvent.args.segment,
        isWin: spinEvent.args.isWin,
        tokenAddress: spinEvent.args.tokenAddress,
        rewardAmount: ethers.formatEther(spinEvent.args.rewardAmount),
        randomSeed: spinEvent.args.randomSeed.toString()
      });
    }
    
    // Test 5: Get stats after spinning
    console.log("\n📊 Test 5: Getting stats after spin...");
    const statsAfter = await contract.getPlayerStats(signer.address);
    console.log("Stats after:", {
      totalSpins: statsAfter[0].toString(),
      totalWins: statsAfter[1].toString(),
      lastSpinDate: statsAfter[2].toString(),
      dailySpins: statsAfter[3].toString(),
      spinsRemaining: statsAfter[4].toString()
    });
    
    // Test 6: Get pending rewards after spinning
    console.log("\n💰 Test 6: Getting pending rewards after spin...");
    const rewardsAfter = await contract.getPendingRewards(signer.address);
    console.log("Rewards after:", {
      token1: ethers.formatEther(rewardsAfter[0]),
      token2: ethers.formatEther(rewardsAfter[1]),
      token3: ethers.formatEther(rewardsAfter[2])
    });
    
    console.log("\n✅ All tests completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

if (require.main === module) {
  testContractInteraction()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Contract test failed:", error);
      process.exit(1);
    });
}

module.exports = { testContractInteraction };