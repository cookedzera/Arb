const { ethers } = require("ethers");
require("dotenv").config();

async function testSimpleClaim() {
  console.log("🧪 Testing simple claim functionality...");
  
  const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc";
  const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let privateKey = PRIVATE_KEY.trim();
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  const signer = new ethers.Wallet(privateKey, provider);
  const WHEEL_GAME_ADDRESS = "0x4be6dd3897fd6fbc8a619c69fa6f4bd94531d90a";
  
  const contract = new ethers.Contract(WHEEL_GAME_ADDRESS, [
    "function getPendingRewards(address player) external view returns (uint256, uint256, uint256)",
    "function claimRewards(address tokenAddress) external"
  ], signer);
  
  console.log(`📝 Testing with account: ${signer.address}`);
  
  try {
    // Check pending rewards
    const pendingRewards = await contract.getPendingRewards(signer.address);
    console.log("Pending rewards:", {
      token1: ethers.formatEther(pendingRewards[0]),
      token2: ethers.formatEther(pendingRewards[1]), 
      token3: ethers.formatEther(pendingRewards[2])
    });
    
    // Claim token2 since it has rewards
    if (pendingRewards[1] > 0) {
      console.log("🎯 Claiming TOKEN2 (JUICE)...");
      
      const tokenAddress = "0x0E1CD6557D2BA59C61c75850E674C2AD73253952"; // TOKEN2
      const tx = await contract.claimRewards(tokenAddress);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Claim successful! Gas used: ${receipt.gasUsed.toString()}`);
      
      // Check updated rewards
      const pendingAfter = await contract.getPendingRewards(signer.address);
      console.log("Updated pending rewards:", {
        token1: ethers.formatEther(pendingAfter[0]),
        token2: ethers.formatEther(pendingAfter[1]),
        token3: ethers.formatEther(pendingAfter[2])
      });
    }
    
    console.log("✅ Claim test completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testSimpleClaim();