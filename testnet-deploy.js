import { ethers } from "ethers";

async function checkTestnetBalance() {
  console.log("🧪 Checking Arbitrum Sepolia testnet setup...");
  
  if (!process.env.WALLET_PRIVATE_KEY) {
    console.error("❌ WALLET_PRIVATE_KEY not found");
    return;
  }
  
  try {
    // Clean up the private key
    let privateKey = process.env.WALLET_PRIVATE_KEY.trim();
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }
    
    // Connect to Arbitrum Sepolia testnet
    const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log("📍 Wallet address:", wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);
    
    console.log("💰 Balance on Arbitrum Sepolia:", balanceInEth, "ETH");
    
    if (parseFloat(balanceInEth) < 0.001) {
      console.log("💡 You need testnet ETH for Arbitrum Sepolia");
      console.log("🚰 Get free testnet ETH:");
      console.log("   1. Go to: https://faucet.quicknode.com/arbitrum/sepolia");
      console.log("   2. Enter your address:", wallet.address);
      console.log("   3. Get free testnet ETH");
      console.log("   4. Wait a few minutes and run this script again");
    } else {
      console.log("✅ You have enough testnet ETH!");
      console.log("");
      console.log("🚀 Ready to deploy on testnet!");
      console.log("📋 Deployment details:");
      console.log("   - Network: Arbitrum Sepolia");
      console.log("   - Chain ID: 421614");
      console.log("   - RPC: https://sepolia-rollup.arbitrum.io/rpc");
      console.log("   - Your address:", wallet.address);
      console.log("");
      console.log("🎯 Next step: Deploy using Remix IDE");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkTestnetBalance().catch(console.error);