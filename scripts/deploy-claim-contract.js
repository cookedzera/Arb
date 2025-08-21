const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Arbitrum Sepolia configuration
const ARBITRUM_SEPOLIA_RPC = "https://421614.rpc.thirdweb.com";
const CHAIN_ID = 421614;
const BLOCK_EXPLORER = "https://sepolia.arbiscan.io";

// Contract configuration
const TREASURY_ADDRESS = "0x742d35Cc6634C0532925a3b8D72CdaBE735e1CD2"; // Replace with actual treasury
const EMERGENCY_OPERATOR = "0x742d35Cc6634C0532925a3b8D72CdaBE735e1CD2"; // Replace with actual operator

// Sample test tokens for Arbitrum Sepolia (these are example addresses)
const TEST_TOKENS = {
  USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia USDC
  DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // Arbitrum Sepolia DAI
  ARB: "0x0000000000000000000000000000000000000000" // Will need actual ARB testnet token
};

async function main() {
  console.log("🚀 Deploying SpinToClaimContract to Arbitrum Sepolia...\n");
  
  // Check environment
  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY environment variable not set");
    console.log("Please set your private key: export PRIVATE_KEY=your_private_key_here");
    process.exit(1);
  }

  // Initialize provider and wallet
  const provider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("📋 Deployment Configuration:");
  console.log(`  Network: Arbitrum Sepolia (Chain ID: ${CHAIN_ID})`);
  console.log(`  RPC: ${ARBITRUM_SEPOLIA_RPC}`);
  console.log(`  Deployer: ${wallet.address}`);
  console.log(`  Treasury: ${TREASURY_ADDRESS}`);
  console.log(`  Emergency Operator: ${EMERGENCY_OPERATOR}\n`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const balanceETH = ethers.formatEther(balance);
  console.log(`💰 Deployer Balance: ${balanceETH} ETH`);
  
  if (parseFloat(balanceETH) < 0.01) {
    console.error("❌ Insufficient balance for deployment. Need at least 0.01 ETH");
    console.log("Get Arbitrum Sepolia ETH from: https://bridge.arbitrum.io");
    process.exit(1);
  }

  try {
    // Read and compile contract
    console.log("📜 Reading contract source code...");
    const contractPath = path.join(__dirname, "../contracts/SpinToClaimContract.sol");
    
    if (!fs.existsSync(contractPath)) {
      console.error("❌ Contract file not found:", contractPath);
      process.exit(1);
    }

    // For production deployment, you would use Hardhat or Foundry
    // This is a simplified deployment script
    console.log("⚠️  Note: This script requires contract compilation.");
    console.log("Please use Hardhat or Foundry for production deployment.\n");
    
    // Mock deployment for demonstration
    console.log("🔨 Deploying contract...");
    
    // Simulate deployment
    const deploymentData = {
      contractName: "SpinToClaimContract",
      network: "arbitrum-sepolia",
      chainId: CHAIN_ID,
      deployer: wallet.address,
      treasury: TREASURY_ADDRESS,
      emergencyOperator: EMERGENCY_OPERATOR,
      deploymentTime: new Date().toISOString(),
      rpcUrl: ARBITRUM_SEPOLIA_RPC,
      explorerUrl: BLOCK_EXPLORER
    };

    // Save deployment configuration
    const configPath = path.join(__dirname, "../deployed-contracts.json");
    fs.writeFileSync(configPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("✅ Deployment configuration saved to deployed-contracts.json");
    console.log("\n📋 Next Steps:");
    console.log("1. Compile the contract using Hardhat:");
    console.log("   npx hardhat compile");
    console.log("\n2. Deploy using Hardhat:");
    console.log(`   npx hardhat run scripts/deploy-claim-contract.js --network arbitrum-sepolia`);
    console.log("\n3. Verify on Arbiscan:");
    console.log(`   npx hardhat verify <CONTRACT_ADDRESS> "${TREASURY_ADDRESS}" "${EMERGENCY_OPERATOR}" --network arbitrum-sepolia`);
    console.log("\n4. Configure test tokens:");
    console.log("   Call configureToken() for each test token");
    console.log("\n5. Unpause contract when ready:");
    console.log("   Call unpause() to enable spinning");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

// Token setup helper
async function setupTestTokens(contractAddress) {
  console.log("\n🪙 Setting up test tokens...");
  
  const tokenConfigs = [
    {
      id: 0,
      address: TEST_TOKENS.USDC,
      name: "USDC",
      minReward: ethers.parseUnits("1", 6), // 1 USDC
      maxReward: ethers.parseUnits("100", 6) // 100 USDC
    },
    {
      id: 1, 
      address: TEST_TOKENS.DAI,
      name: "DAI",
      minReward: ethers.parseEther("1"), // 1 DAI
      maxReward: ethers.parseEther("50") // 50 DAI
    }
  ];

  console.log("Token configurations to set:");
  tokenConfigs.forEach(config => {
    console.log(`  ${config.name}: ${config.minReward} - ${config.maxReward} tokens`);
  });
  
  console.log("\nCall configureToken() for each token after deployment.");
}

// Hardhat configuration template
function generateHardhatConfig() {
  const hardhatConfig = `
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    arbitrumSepolia: {
      url: "${ARBITRUM_SEPOLIA_RPC}",
      chainId: ${CHAIN_ID},
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      arbitrumSepolia: process.env.ARBISCAN_API_KEY
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: ${CHAIN_ID},
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "${BLOCK_EXPLORER}"
        }
      }
    ]
  }
};
`;

  fs.writeFileSync("hardhat.config.js", hardhatConfig);
  console.log("✅ Hardhat config generated");
}

if (require.main === module) {
  main()
    .then(() => {
      setupTestTokens();
      generateHardhatConfig();
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main, setupTestTokens };