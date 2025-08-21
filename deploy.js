const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract deployment script for Arbitrum Sepolia
async function deployContract() {
  console.log('🚀 Starting deployment to Arbitrum Sepolia...\n');
  
  // Environment setup
  const privateKey = process.env.PRIVATE_KEY;
  const claimSignerKey = process.env.CLAIM_SIGNER_PRIVATE_KEY;
  
  if (!privateKey || !claimSignerKey) {
    console.error('❌ Missing required environment variables:');
    console.error('PRIVATE_KEY and CLAIM_SIGNER_PRIVATE_KEY must be set');
    process.exit(1);
  }
  
  // Network configuration
  const provider = new ethers.JsonRpcProvider('https://421614.rpc.thirdweb.com');
  const deployerWallet = new ethers.Wallet(privateKey, provider);
  const signerWallet = new ethers.Wallet(claimSignerKey);
  
  console.log('📋 Deployment Configuration:');
  console.log(`├─ Network: Arbitrum Sepolia (Chain ID: 421614)`);
  console.log(`├─ Deployer: ${deployerWallet.address}`);
  console.log(`├─ Claim Signer: ${signerWallet.address}`);
  
  // Check balance
  try {
    const balance = await provider.getBalance(deployerWallet.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`├─ Balance: ${balanceEth} ETH\n`);
    
    if (parseFloat(balanceEth) < 0.001) {
      console.warn('⚠️  Warning: Low ETH balance. You may need more for deployment.');
    }
  } catch (error) {
    console.error('❌ Failed to check balance:', error.message);
    process.exit(1);
  }
  
  // Contract source code
  const contractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SpinToClaimContract is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 public constant MAX_TOKENS = 10;
    uint256 public constant MIN_SPIN_INTERVAL = 1;
    uint256 public constant CLAIM_DEADLINE = 24 hours;
    uint256 public constant MAX_DAILY_SPINS = 10;

    struct TokenConfig {
        address tokenAddress;
        uint256 minReward;
        uint256 maxReward;
        bool isActive;
    }

    struct UserStats {
        uint256 totalSpins;
        uint256 totalClaims;
        uint256 lastSpinBlock;
        uint256 dailySpins;
        uint256 lastSpinDay;
        bool isBlacklisted;
    }

    struct ClaimRequest {
        address user;
        uint256 tokenId;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    mapping(uint256 => TokenConfig) public tokens;
    mapping(address => UserStats) public userStats;
    mapping(address => mapping(uint256 => uint256)) public userNonces;
    mapping(address => bool) public operators;

    address public treasury;
    address public claimSigner;
    uint256 public treasuryFeePercent = 5;

    event SpinExecuted(address indexed user, uint256 indexed tokenId, uint256 amount, bool isWin);
    event TokensClaimed(address indexed user, uint256 indexed tokenId, uint256 amount, uint256 fee);
    event TokenConfigured(uint256 indexed tokenId, address indexed tokenAddress, uint256 minReward, uint256 maxReward, bool isActive);
    event ClaimSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event UserBlacklisted(address indexed user, bool isBlacklisted);
    event EmergencyModeToggled(bool isPaused);

    constructor(address _treasury, address _claimSigner) Ownable(msg.sender) {
        treasury = _treasury;
        claimSigner = _claimSigner;
        operators[msg.sender] = true;
        _pause();
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }

    function emergencyPause() external onlyOperator {
        _pause();
        emit EmergencyModeToggled(true);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyModeToggled(false);
    }

    function configureToken(
        uint256 tokenId,
        address tokenAddress,
        uint256 minReward,
        uint256 maxReward,
        bool isActive
    ) external onlyOwner {
        require(tokenId < MAX_TOKENS, "Invalid token ID");
        require(tokenAddress != address(0), "Invalid token address");
        require(maxReward >= minReward, "Max must be >= min");

        tokens[tokenId] = TokenConfig({
            tokenAddress: tokenAddress,
            minReward: minReward,
            maxReward: maxReward,
            isActive: isActive
        });

        emit TokenConfigured(tokenId, tokenAddress, minReward, maxReward, isActive);
    }

    function claimTokens(ClaimRequest calldata request) external nonReentrant whenNotPaused {
        require(tx.origin == msg.sender, "No contract calls");
        require(!userStats[msg.sender].isBlacklisted, "User blacklisted");
        require(request.user == msg.sender, "Invalid user");
        require(request.tokenId < MAX_TOKENS, "Invalid token ID");
        require(tokens[request.tokenId].isActive, "Token not active");
        require(request.deadline > block.timestamp, "Claim expired");
        require(request.amount > 0, "Invalid amount");

        uint256 expectedNonce = userNonces[msg.sender][request.tokenId] + 1;
        require(request.nonce == expectedNonce, "Invalid nonce");

        bytes32 messageHash = keccak256(abi.encodePacked(
            request.user,
            request.tokenId,
            request.amount,
            request.nonce,
            request.deadline
        )).toEthSignedMessageHash();

        address recoveredSigner = messageHash.recover(request.signature);
        require(recoveredSigner == claimSigner, "Invalid signature");

        TokenConfig memory tokenConfig = tokens[request.tokenId];
        require(request.amount >= tokenConfig.minReward && request.amount <= tokenConfig.maxReward, "Amount out of range");

        userNonces[msg.sender][request.tokenId] = request.nonce;
        userStats[msg.sender].totalClaims++;

        IERC20 token = IERC20(tokenConfig.tokenAddress);
        uint256 fee = (request.amount * treasuryFeePercent) / 100;
        uint256 userAmount = request.amount - fee;

        require(token.balanceOf(address(this)) >= request.amount, "Insufficient contract balance");

        if (fee > 0) {
            token.safeTransfer(treasury, fee);
        }
        token.safeTransfer(msg.sender, userAmount);

        emit TokensClaimed(msg.sender, request.tokenId, userAmount, fee);
    }

    function setClaimSigner(address _claimSigner) external onlyOwner {
        address oldSigner = claimSigner;
        claimSigner = _claimSigner;
        emit ClaimSignerUpdated(oldSigner, _claimSigner);
    }

    function setTreasury(address _treasury) external onlyOwner {
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    function setTreasuryFee(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 20, "Fee too high");
        treasuryFeePercent = _feePercent;
    }

    function setOperator(address operator, bool isOperator) external onlyOwner {
        operators[operator] = isOperator;
    }

    function blacklistUser(address user, bool isBlacklisted) external onlyOperator {
        userStats[user].isBlacklisted = isBlacklisted;
        emit UserBlacklisted(user, isBlacklisted);
    }

    function withdrawToken(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(owner(), amount);
    }

    function getContractStats() external view returns (uint256 totalUsers, uint256 totalClaims, bool isPaused) {
        return (0, 0, paused());
    }

    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }

    function getTokenConfig(uint256 tokenId) external view returns (TokenConfig memory) {
        return tokens[tokenId];
    }
}`;

  console.log('📝 Compiling contract...');
  
  // Simple compilation (in production, use proper Solidity compiler)
  console.log('⚠️  Using simplified deployment. In production, use Hardhat compilation.');
  
  // For now, let's create a simple ERC20 test token for demonstration
  const testTokenSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestERC20 is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply * 10**decimals_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}`;

  // Save deployment info
  const deploymentInfo = {
    network: "arbitrum-sepolia",
    chainId: 421614,
    deployer: deployerWallet.address,
    claimSigner: signerWallet.address,
    timestamp: new Date().toISOString(),
    status: "ready-for-manual-deployment",
    contracts: {
      SpinToClaimContract: "pending",
      TestTokens: "pending"
    },
    configuration: {
      treasury: deployerWallet.address,
      claimSigner: signerWallet.address,
      treasuryFee: "5%"
    }
  };

  console.log('💾 Saving deployment configuration...');
  fs.writeFileSync('deployed-contracts.json', JSON.stringify(deploymentInfo, null, 2));
  fs.writeFileSync('contracts/SpinToClaimContract.sol', contractSource);
  fs.writeFileSync('contracts/TestERC20.sol', testTokenSource);
  
  console.log('\n✅ Deployment preparation complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Contracts saved to contracts/ directory');
  console.log('2. Use Remix IDE or Hardhat to deploy manually');
  console.log('3. Update SPIN_CLAIM_CONTRACT_ADDRESS environment variable');
  console.log('4. Configure token rewards and unpause contract');
  
  console.log('\n🔧 Manual Deployment Instructions:');
  console.log('1. Go to https://remix.ethereum.org');
  console.log('2. Copy SpinToClaimContract.sol source code');
  console.log('3. Compile with Solidity 0.8.20');
  console.log('4. Deploy to Arbitrum Sepolia network');
  console.log(`5. Constructor parameters:`);
  console.log(`   - Treasury: ${deployerWallet.address}`);
  console.log(`   - Claim Signer: ${signerWallet.address}`);
  
  return deploymentInfo;
}

// Run deployment
if (require.main === module) {
  deployContract()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployContract };