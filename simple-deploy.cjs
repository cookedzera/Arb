const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

async function compileAndDeploy() {
  console.log('🚀 Starting deployment to Arbitrum Sepolia...\n');
  
  const privateKey = process.env.PRIVATE_KEY;
  const claimSignerKey = process.env.CLAIM_SIGNER_PRIVATE_KEY;
  
  const provider = new ethers.JsonRpcProvider('https://421614.rpc.thirdweb.com');
  const wallet = new ethers.Wallet(privateKey, provider);
  const signerWallet = new ethers.Wallet(claimSignerKey);
  
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Claim Signer: ${signerWallet.address}\n`);
  
  // Simple contract source for testing
  const simpleContractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleSpinClaim {
    address public owner;
    address public claimSigner;
    bool public paused;
    
    mapping(address => uint256) public userBalances;
    
    event TokensClaimed(address user, uint256 amount);
    event ContractPaused(bool isPaused);
    
    constructor(address _claimSigner) {
        owner = msg.sender;
        claimSigner = _claimSigner;
        paused = true; // Start paused for safety
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit ContractPaused(_paused);
    }
    
    function setClaimSigner(address _claimSigner) external onlyOwner {
        claimSigner = _claimSigner;
    }
    
    function simulateClaim(address user, uint256 amount) external {
        require(!paused, "Contract paused");
        require(msg.sender == owner, "Not authorized");
        userBalances[user] += amount;
        emit TokensClaimed(user, amount);
    }
    
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }
    
    function getConfig() external view returns (address, address, bool) {
        return (owner, claimSigner, paused);
    }
}`;

  console.log('📝 Compiling simple contract...');
  
  // Compile contract
  const input = {
    language: 'Solidity',
    sources: {
      'SimpleSpinClaim.sol': {
        content: simpleContractSource
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };
  
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    console.log('Compilation warnings/errors:');
    output.errors.forEach(error => console.log(error.formattedMessage));
  }
  
  const contract = output.contracts['SimpleSpinClaim.sol']['SimpleSpinClaim'];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;
  
  if (!bytecode) {
    console.error('❌ Compilation failed - no bytecode generated');
    return;
  }
  
  console.log('✅ Compilation successful');
  console.log('📦 Deploying contract...');
  
  try {
    // Create contract factory
    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Deploy with constructor parameters
    const deployTransaction = await contractFactory.deploy(
      signerWallet.address, // claimSigner parameter
      {
        gasLimit: 500000,
        gasPrice: ethers.parseUnits('0.1', 'gwei')
      }
    );
    
    console.log(`Transaction hash: ${deployTransaction.deploymentTransaction().hash}`);
    
    // Wait for deployment
    console.log('⏳ Waiting for confirmation...');
    await deployTransaction.waitForDeployment();
    
    const contractAddress = await deployTransaction.getAddress();
    console.log(`\n✅ Contract deployed successfully!`);
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Arbiscan: https://sepolia.arbiscan.io/address/${contractAddress}`);
    
    // Update deployment file
    const deploymentInfo = {
      network: "arbitrum-sepolia",
      chainId: 421614,
      deployer: wallet.address,
      claimSigner: signerWallet.address,
      contractAddress: contractAddress,
      transactionHash: deployTransaction.deploymentTransaction().hash,
      timestamp: new Date().toISOString(),
      status: "deployed",
      abi: abi
    };
    
    fs.writeFileSync('deployed-contracts.json', JSON.stringify(deploymentInfo, null, 2));
    
    // Test the contract
    console.log('\n🧪 Testing contract...');
    const deployedContract = new ethers.Contract(contractAddress, abi, wallet);
    
    const [owner, claimSigner, isPaused] = await deployedContract.getConfig();
    console.log(`├─ Owner: ${owner}`);
    console.log(`├─ Claim Signer: ${claimSigner}`);
    console.log(`├─ Is Paused: ${isPaused}`);
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Contract is paused by default for security');
    console.log('2. Update your environment with contract address');
    console.log('3. Configure token rewards (when using full contract)');
    console.log('4. Unpause contract to enable claiming');
    
    return {
      contractAddress,
      deploymentInfo
    };
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('💰 Insufficient funds for deployment');
    }
    throw error;
  }
}

if (require.main === module) {
  compileAndDeploy()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { compileAndDeploy };