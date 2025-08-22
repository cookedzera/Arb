const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("🚀 Starting SpinAutoTransferContract deployment...");
  
  // Get deployment account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    throw new Error("❌ Deployer account has no ETH for deployment");
  }
  
  // Contract constructor parameters
  const TREASURY_ADDRESS = deployer.address; // You can change this later
  const EMERGENCY_OPERATOR = deployer.address; // You can change this later  
  const SERVER_WALLET = process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY).address : deployer.address;
  
  console.log("📋 Deployment parameters:");
  console.log("   Treasury:", TREASURY_ADDRESS);
  console.log("   Emergency Operator:", EMERGENCY_OPERATOR);
  console.log("   Server Wallet:", SERVER_WALLET);
  
  // Deploy contract
  console.log("\n🔨 Deploying SpinAutoTransferContract...");
  const SpinAutoTransferContract = await ethers.getContractFactory("SpinAutoTransferContract");
  
  const contract = await SpinAutoTransferContract.deploy(
    TREASURY_ADDRESS,
    EMERGENCY_OPERATOR, 
    SERVER_WALLET
  );
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log("✅ Contract deployed to:", contractAddress);
  
  // Wait for a few confirmations
  console.log("⏳ Waiting for confirmations...");
  await contract.deploymentTransaction().wait(2);
  
  // Configure tokens using your existing addresses
  const TOKEN_CONFIGS = {
    TOKEN1: {
      address: "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4", // AIDOGE
      minAmount: ethers.parseEther("0.1"),   // 0.1 tokens minimum
      maxAmount: ethers.parseEther("5"),     // 5 tokens maximum
      name: "AIDOGE"
    },
    TOKEN2: {
      address: "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19", // BOOP
      minAmount: ethers.parseEther("0.1"),   // 0.1 tokens minimum  
      maxAmount: ethers.parseEther("5"),     // 5 tokens maximum
      name: "BOOP"
    },
    TOKEN3: {
      address: "0x0E1CD6557D2BA59C61c75850E674C2AD73253952", // BOBOTRUM
      minAmount: ethers.parseEther("0.05"),  // 0.05 tokens minimum
      maxAmount: ethers.parseEther("2"),     // 2 tokens maximum  
      name: "BOBOTRUM"
    }
  };
  
  console.log("\n🔧 Configuring tokens...");
  
  // Configure each token
  for (let i = 0; i < 3; i++) {
    const tokenKey = `TOKEN${i + 1}`;
    const config = TOKEN_CONFIGS[tokenKey];
    
    console.log(`   Configuring ${config.name} (ID: ${i})...`);
    
    const tx = await contract.configureToken(
      i,                    // tokenId (0, 1, 2)
      config.address,       // token contract address
      true,                 // isActive
      config.minAmount,     // minAmount
      config.maxAmount      // maxAmount
    );
    
    await tx.wait();
    console.log(`   ✅ ${config.name} configured`);
  }
  
  // Set auto-transfer settings (conservative defaults)
  console.log("\n⚙️  Setting auto-transfer parameters...");
  const settingsTx = await contract.setAutoTransferSettings(
    true,                           // enabled
    ethers.parseEther("5"),         // maxPerCall (5 tokens)
    ethers.parseEther("50"),        // dailyLimit (50 tokens) 
    ethers.parseEther("1000")       // globalLimit (1000 tokens)
  );
  await settingsTx.wait();
  console.log("   ✅ Auto-transfer settings configured");
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "arbitrum-sepolia",
    chainId: 421614,
    deploymentDate: new Date().toISOString(),
    deployer: deployer.address,
    treasury: TREASURY_ADDRESS,
    emergencyOperator: EMERGENCY_OPERATOR,
    serverWallet: SERVER_WALLET,
    tokens: {
      TOKEN1: { ...TOKEN_CONFIGS.TOKEN1, tokenId: 0 },
      TOKEN2: { ...TOKEN_CONFIGS.TOKEN2, tokenId: 1 },
      TOKEN3: { ...TOKEN_CONFIGS.TOKEN3, tokenId: 2 }
    },
    settings: {
      maxPerCall: "5000000000000000000",     // 5 tokens
      dailyLimit: "50000000000000000000",    // 50 tokens
      globalLimit: "1000000000000000000000"  // 1000 tokens  
    }
  };
  
  // Write deployment info to file
  fs.writeFileSync(
    'auto-transfer-deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n📁 Deployment info saved to: auto-transfer-deployment.json");
  
  // Security reminder
  console.log("\n🔒 IMPORTANT SECURITY NOTES:");
  console.log("   ⚠️  Contract is PAUSED by default for safety");
  console.log("   ⚠️  Auto-transfer is DISABLED by default");
  console.log("   ⚠️  You need to fund the contract with tokens");
  console.log("   ⚠️  You need to unpause the contract when ready");
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("📋 Next steps:");
  console.log("   1. Fund contract with reward tokens");
  console.log("   2. Update backend to use new contract");
  console.log("   3. Test with small amounts");
  console.log("   4. Unpause contract when ready");
  
  return {
    contractAddress,
    deploymentInfo
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });