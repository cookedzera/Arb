const { ethers } = require("ethers");
require("dotenv").config();

async function testClaimFunctionality() {
  console.log("🧪 Testing claim functionality...");
  
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
  
  // Contract configuration
  const WHEEL_GAME_ADDRESS = "0x4be6dd3897fd6fbc8a619c69fa6f4bd94531d90a";
  const WHEEL_GAME_ABI = [
    "function getPendingRewards(address player) external view returns (uint256, uint256, uint256)",
    "function claimRewards(address tokenAddress) external",
    "function getContractBalances() external view returns (uint256, uint256, uint256)",
    "event RewardsClaimed(address indexed player, address indexed token, uint256 amount)"
  ];
  
  const contract = new ethers.Contract(WHEEL_GAME_ADDRESS, WHEEL_GAME_ABI, signer);
  
  console.log(`📝 Testing with account: ${signer.address}`);
  
  try {
    // Check pending rewards
    console.log("\n💰 Checking pending rewards...");
    const pendingRewards = await contract.getPendingRewards(signer.address);
    console.log("Pending rewards:", {
      token1: ethers.formatEther(pendingRewards[0]),
      token2: ethers.formatEther(pendingRewards[1]),
      token3: ethers.formatEther(pendingRewards[2])
    });
    
    // Check contract balances
    console.log("\n📊 Checking contract balances...");
    const contractBalances = await contract.getContractBalances();
    console.log("Contract balances:", {
      token1: ethers.formatEther(contractBalances[0]),
      token2: ethers.formatEther(contractBalances[1]),
      token3: ethers.formatEther(contractBalances[2])
    });
    
    // Test claim if there are pending rewards
    const totalPending = pendingRewards[0] + pendingRewards[1] + pendingRewards[2];
    if (totalPending > 0) {
      console.log("\n🚀 Testing claim functionality...");
      
      // Claim each token type that has pending rewards
      const tokenAddresses = [
        "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4", // TOKEN1
        "0x0E1CD6557D2BA59C61c75850E674C2AD73253952", // TOKEN2
        "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19"  // TOKEN3
      ];
      
      for (let i = 0; i < 3; i++) {
        if (pendingRewards[i] > 0) {
          console.log(`🎯 Claiming token ${i + 1} (${ethers.formatEther(pendingRewards[i])} tokens)...`);
          
          try {
            const tx = await contract.claimRewards(tokenAddresses[i]);
            console.log(`Transaction hash: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`✅ Claim successful! Gas used: ${receipt.gasUsed.toString()}`);
            
            // Parse events
            const events = receipt.logs.map(log => {
              try {
                return contract.interface.parseLog(log);
              } catch {
                return null;
              }
            }).filter(Boolean);
            
            const claimEvent = events.find(event => event.name === "RewardsClaimed");
            if (claimEvent) {
              console.log("Claim event:", {
                player: claimEvent.args.player,
                token: claimEvent.args.token,
                amount: ethers.formatEther(claimEvent.args.amount)
              });
            }
          } catch (error) {
            console.error(`❌ Claim failed for token ${i + 1}:`, error.message);
          }
        }
      }
    } else {
      console.log("⚠️  No pending rewards to claim");
    }
    
    // Check updated pending rewards
    console.log("\n💰 Checking pending rewards after claim...");
    const pendingAfter = await contract.getPendingRewards(signer.address);
    console.log("Updated pending rewards:", {
      token1: ethers.formatEther(pendingAfter[0]),
      token2: ethers.formatEther(pendingAfter[1]),
      token3: ethers.formatEther(pendingAfter[2])
    });
    
    console.log("\n✅ Claim functionality test completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

if (require.main === module) {
  testClaimFunctionality()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Claim test failed:", error);
      process.exit(1);
    });
}

module.exports = { testClaimFunctionality };