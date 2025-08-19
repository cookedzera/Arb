// Hardhat deployment script for Arbitrum Sepolia
// Run with: npx hardhat run scripts/deploy.js --network arbitrumSepolia

import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    console.log("🚀 Starting deployment to Arbitrum Sepolia...\n");
    
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("\n");
    
    // Configuration
    const USE_EXISTING_TOKENS = true; // Set to false to deploy new test tokens
    
    let aidogeAddress, boopAddress, bobotrumAddress;
    
    if (USE_EXISTING_TOKENS) {
        // Use existing token addresses on Arbitrum Sepolia
        console.log("📌 Using existing token addresses on Arbitrum Sepolia:");
        aidogeAddress = "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4";
        boopAddress = "0x0E1CD6557D2BA59C61c75850E674C2AD73253952";
        bobotrumAddress = "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19";
        
        console.log("AIDOGE:", aidogeAddress);
        console.log("BOOP:", boopAddress);
        console.log("BOBOTRUM:", bobotrumAddress);
        console.log("\n");
    } else {
        // Deploy new test tokens
        console.log("🪙 Deploying test tokens...\n");
        
        // Deploy AIDOGE Test Token
        const AIDOGETestToken = await hre.ethers.getContractFactory("AIDOGETestToken");
        const aidogeToken = await AIDOGETestToken.deploy();
        await aidogeToken.deployed();
        aidogeAddress = aidogeToken.address;
        console.log("✅ AIDOGE Test Token deployed to:", aidogeAddress);
        
        // Deploy BOOP Test Token
        const BOOPTestToken = await hre.ethers.getContractFactory("BOOPTestToken");
        const boopToken = await BOOPTestToken.deploy();
        await boopToken.deployed();
        boopAddress = boopToken.address;
        console.log("✅ BOOP Test Token deployed to:", boopAddress);
        
        // Deploy BOBOTRUM Test Token
        const BOBOTRUMTestToken = await hre.ethers.getContractFactory("BOBOTRUMTestToken");
        const bobotrumToken = await BOBOTRUMTestToken.deploy();
        await bobotrumToken.deployed();
        bobotrumAddress = bobotrumToken.address;
        console.log("✅ BOBOTRUM Test Token deployed to:", bobotrumAddress);
        console.log("\n");
    }
    
    // Deploy main game contract
    console.log("🎰 Deploying WheelGameArbitrumSepolia contract...\n");
    
    const WheelGame = await hre.ethers.getContractFactory("WheelGameArbitrumSepolia");
    const wheelGame = await WheelGame.deploy(
        aidogeAddress,
        boopAddress,
        bobotrumAddress
    );
    await wheelGame.deployed();
    
    console.log("✅ WheelGameArbitrumSepolia deployed to:", wheelGame.address);
    console.log("\n");
    
    // Transfer initial tokens to game contract (if using new tokens)
    if (!USE_EXISTING_TOKENS) {
        console.log("💰 Transferring initial tokens to game contract...\n");
        
        const initialGameBalance = hre.ethers.utils.parseEther("100000"); // 100k tokens each
        
        const aidoge = await hre.ethers.getContractAt("TestToken", aidogeAddress);
        const boop = await hre.ethers.getContractAt("TestToken", boopAddress);
        const bobotrum = await hre.ethers.getContractAt("TestToken", bobotrumAddress);
        
        // Approve and deposit tokens
        await aidoge.approve(wheelGame.address, initialGameBalance);
        await boop.approve(wheelGame.address, initialGameBalance);
        await bobotrum.approve(wheelGame.address, initialGameBalance);
        
        await wheelGame.depositTokens(aidogeAddress, initialGameBalance);
        console.log("✅ Deposited 100,000 AIDOGE to game contract");
        
        await wheelGame.depositTokens(boopAddress, initialGameBalance);
        console.log("✅ Deposited 100,000 BOOP to game contract");
        
        await wheelGame.depositTokens(bobotrumAddress, initialGameBalance);
        console.log("✅ Deposited 100,000 BOBOTRUM to game contract");
        console.log("\n");
    } else {
        console.log("⚠️  Remember to transfer tokens to the game contract:");
        console.log(`Game Contract Address: ${wheelGame.address}`);
        console.log("Required tokens: AIDOGE, BOOP, BOBOTRUM");
        console.log("\n");
    }
    
    // Verify contracts on Arbiscan
    console.log("📝 Contract verification instructions:\n");
    console.log("Run the following commands to verify on Arbiscan:\n");
    
    if (!USE_EXISTING_TOKENS) {
        console.log(`npx hardhat verify --network arbitrumSepolia ${aidogeAddress}`);
        console.log(`npx hardhat verify --network arbitrumSepolia ${boopAddress}`);
        console.log(`npx hardhat verify --network arbitrumSepolia ${bobotrumAddress}`);
    }
    
    console.log(`npx hardhat verify --network arbitrumSepolia ${wheelGame.address} ${aidogeAddress} ${boopAddress} ${bobotrumAddress}`);
    console.log("\n");
    
    // Save deployment info
    const deploymentInfo = {
        network: "Arbitrum Sepolia",
        chainId: 421614,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            WheelGameArbitrumSepolia: wheelGame.address,
            tokens: {
                AIDOGE: aidogeAddress,
                BOOP: boopAddress,
                BOBOTRUM: bobotrumAddress
            }
        }
    };
    
    console.log("📊 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Save to file
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const deploymentsDir = path.join(__dirname, "../deployments");
    
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }
    
    fs.writeFileSync(
        path.join(deploymentsDir, `arbitrum-sepolia-${Date.now()}.json`),
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n✅ Deployment complete! Info saved to deployments folder.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });