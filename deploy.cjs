const { ethers } = require('ethers');
const fs = require('fs');

async function deployPreparation() {
  console.log('🚀 Preparing deployment to Arbitrum Sepolia...\n');
  
  const privateKey = process.env.PRIVATE_KEY;
  const claimSignerKey = process.env.CLAIM_SIGNER_PRIVATE_KEY;
  
  if (!privateKey || !claimSignerKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }
  
  const provider = new ethers.JsonRpcProvider('https://421614.rpc.thirdweb.com');
  const deployerWallet = new ethers.Wallet(privateKey, provider);
  const signerWallet = new ethers.Wallet(claimSignerKey);
  
  console.log('📋 Configuration:');
  console.log(`├─ Network: Arbitrum Sepolia`);
  console.log(`├─ Deployer: ${deployerWallet.address}`);
  console.log(`├─ Claim Signer: ${signerWallet.address}`);
  
  try {
    const balance = await provider.getBalance(deployerWallet.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`├─ Balance: ${balanceEth} ETH\n`);
    
    if (parseFloat(balanceEth) < 0.001) {
      console.warn('⚠️  Low balance - need more ETH for deployment');
    }
  } catch (error) {
    console.error('❌ Network connection failed:', error.message);
    process.exit(1);
  }
  
  // Save deployment configuration
  const config = {
    network: "arbitrum-sepolia",
    chainId: 421614,
    deployer: deployerWallet.address,
    claimSigner: signerWallet.address,
    timestamp: new Date().toISOString(),
    status: "ready-for-deployment"
  };
  
  fs.writeFileSync('deployed-contracts.json', JSON.stringify(config, null, 2));
  
  console.log('✅ Deployment preparation complete!');
  console.log('\n📝 Contract files updated and ready for deployment');
  console.log('🔧 Use Remix IDE or continue with Hardhat for deployment');
  
  return config;
}

deployPreparation().catch(console.error);