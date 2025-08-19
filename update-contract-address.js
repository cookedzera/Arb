import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function updateContractAddress(contractAddress) {
  if (!contractAddress) {
    console.error("❌ Please provide the contract address:");
    console.log("Usage: node update-contract-address.js 0xYourContractAddressHere");
    process.exit(1);
  }
  
  console.log("📝 Updating contract address to:", contractAddress);
  
  try {
    // Update blockchain.ts
    const blockchainPath = path.join(__dirname, "server", "blockchain.ts");
    let blockchainContent = fs.readFileSync(blockchainPath, "utf8");
    
    // Replace the placeholder address
    blockchainContent = blockchainContent.replace(
      'const WHEEL_GAME_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE";',
      `const WHEEL_GAME_ADDRESS = "${contractAddress}";`
    );
    
    fs.writeFileSync(blockchainPath, blockchainContent);
    console.log("✅ Updated server/blockchain.ts");
    
    // Create deployment info file
    const deploymentInfo = {
      contractAddress,
      network: "Arbitrum One",
      chainId: 42161,
      deployedAt: new Date().toISOString(),
      tokenAddresses: {
        AIDOGE: "0x09e18590e8f76b6cf471b3cd75fe1a1a9d2b2c2b",
        BOOP: "0x13A7DeDb7169a17bE92B0E3C7C2315B46f4772B3",
        BOBOTRUM: "0x60460971a3D79ef265dfafA393ffBCe97d91E8B8"
      }
    };
    
    fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Created deployment-info.json");
    
    console.log("");
    console.log("🎉 Contract address updated successfully!");
    console.log("");
    console.log("📋 Next steps:");
    console.log("1. Fund the contract with tokens:");
    console.log(`   - Send AIDOGE to: ${contractAddress}`);
    console.log(`   - Send BOOP to: ${contractAddress}`);
    console.log(`   - Send BOBOTRUM to: ${contractAddress}`);
    console.log("");
    console.log("2. Restart your application to use the new contract");
    console.log("");
    console.log("3. Test the game to make sure everything works!");
    
  } catch (error) {
    console.error("❌ Failed to update contract address:", error.message);
    process.exit(1);
  }
}

// Get contract address from command line
const contractAddress = process.argv[2];
updateContractAddress(contractAddress);