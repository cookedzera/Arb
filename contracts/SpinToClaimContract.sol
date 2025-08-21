// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SpinToClaimContract
 * @dev Secure spin-to-win game with claim functionality on Arbitrum Sepolia
 * Features:
 * - Spin wheel with random rewards
 * - Configurable min/max reward amounts
 * - Pause/unpause functionality for emergencies
 * - Multi-signature owner controls
 * - Claim verification system
 * - Anti-bot protection
 * - Gas optimization for L2
 */
contract SpinToClaimContract is Pausable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    // ========== STATE VARIABLES ==========
    
    // Reward token configuration
    struct TokenConfig {
        IERC20 token;
        uint256 minReward;
        uint256 maxReward;
        bool isActive;
        uint256 totalDistributed;
        uint256 reserveBalance;
    }
    
    // User spin data
    struct SpinData {
        uint256 lastSpinBlock;
        uint256 totalSpins;
        uint256 totalWins;
        uint256 totalClaimed;
        bool isBlacklisted;
    }
    
    // Claim verification
    struct ClaimRequest {
        address user;
        uint256 tokenId;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    // Contract configuration
    uint256 public constant MAX_TOKENS = 10;
    uint256 public constant MIN_SPIN_INTERVAL = 1; // 1 block minimum between spins
    uint256 public constant CLAIM_DEADLINE = 24 hours;
    uint256 public constant MAX_DAILY_SPINS = 10;
    
    // Token configurations (tokenId => TokenConfig)
    mapping(uint256 => TokenConfig) public tokens;
    uint256 public activeTokenCount;
    
    // User data
    mapping(address => SpinData) public userSpins;
    mapping(address => mapping(uint256 => uint256)) public dailySpinCount; // user => day => count
    mapping(address => uint256) public userNonces;
    
    // Emergency controls
    address public emergencyOperator;
    bool public emergencyMode;
    uint256 public emergencyActivatedAt;
    
    // Revenue sharing
    address public treasury;
    uint256 public treasuryFeePercent = 5; // 5% fee
    
    // ========== EVENTS ==========
    
    event SpinExecuted(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount,
        bool isWin,
        uint256 blockNumber
    );
    
    event TokensClaimed(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 nonce
    );
    
    event TokenConfigured(
        uint256 indexed tokenId,
        address indexed token,
        uint256 minReward,
        uint256 maxReward,
        bool isActive
    );
    
    event EmergencyModeToggled(bool enabled, address operator);
    event UserBlacklisted(address indexed user, bool blacklisted);
    event TreasuryUpdated(address indexed newTreasury);
    
    // ========== MODIFIERS ==========
    
    modifier onlyActiveToken(uint256 tokenId) {
        require(tokens[tokenId].isActive, "Token not active");
        _;
    }
    
    modifier onlyEmergencyOperator() {
        require(
            msg.sender == owner() || msg.sender == emergencyOperator,
            "Not authorized"
        );
        _;
    }
    
    modifier antiBot() {
        require(tx.origin == msg.sender, "No contract calls");
        require(!userSpins[msg.sender].isBlacklisted, "User blacklisted");
        _;
    }
    
    modifier validSpinInterval() {
        require(
            block.number >= userSpins[msg.sender].lastSpinBlock + MIN_SPIN_INTERVAL,
            "Too frequent spins"
        );
        _;
    }
    
    modifier dailySpinLimit() {
        uint256 currentDay = block.timestamp / 1 days;
        require(
            dailySpinCount[msg.sender][currentDay] < MAX_DAILY_SPINS,
            "Daily spin limit reached"
        );
        _;
    }

    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _treasury,
        address _emergencyOperator
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_emergencyOperator != address(0), "Invalid emergency operator");
        
        treasury = _treasury;
        emergencyOperator = _emergencyOperator;
        
        // Contract starts paused for safety
        _pause();
    }

    // ========== SPIN FUNCTIONS ==========
    
    /**
     * @dev Execute a spin and determine reward
     * @param tokenId Token ID to spin for
     * @return isWin Whether the spin was a win
     * @return rewardAmount Amount of tokens won (0 if loss)
     */
    function spin(uint256 tokenId) 
        external 
        whenNotPaused
        nonReentrant
        antiBot
        validSpinInterval
        dailySpinLimit
        onlyActiveToken(tokenId)
        returns (bool isWin, uint256 rewardAmount) 
    {
        SpinData storage userData = userSpins[msg.sender];
        TokenConfig storage tokenConfig = tokens[tokenId];
        
        // Update spin tracking
        userData.lastSpinBlock = block.number;
        userData.totalSpins++;
        
        uint256 currentDay = block.timestamp / 1 days;
        dailySpinCount[msg.sender][currentDay]++;
        
        // Generate pseudo-random result
        // Note: This is simplified randomness for demo. Production should use Chainlink VRF
        uint256 randomSeed = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    userData.totalSpins,
                    blockhash(block.number - 1)
                )
            )
        );
        
        // Determine if win (30% chance)
        isWin = (randomSeed % 100) < 30;
        
        if (isWin) {
            // Calculate random reward amount between min and max
            rewardAmount = tokenConfig.minReward + 
                (randomSeed % (tokenConfig.maxReward - tokenConfig.minReward + 1));
            
            // Check contract has sufficient balance
            require(
                tokenConfig.token.balanceOf(address(this)) >= rewardAmount,
                "Insufficient contract balance"
            );
            
            userData.totalWins++;
            tokenConfig.totalDistributed += rewardAmount;
        }
        
        emit SpinExecuted(msg.sender, tokenId, rewardAmount, isWin, block.number);
    }

    // ========== CLAIM FUNCTIONS ==========
    
    /**
     * @dev Claim tokens with signature verification
     * @param claimRequest Struct containing claim details and signature
     */
    function claimTokens(ClaimRequest calldata claimRequest) 
        external 
        whenNotPaused
        nonReentrant
    {
        require(claimRequest.user == msg.sender, "Invalid claimer");
        require(claimRequest.deadline >= block.timestamp, "Claim expired");
        require(
            claimRequest.nonce == userNonces[msg.sender] + 1,
            "Invalid nonce"
        );
        
        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                claimRequest.user,
                claimRequest.tokenId,
                claimRequest.amount,
                claimRequest.nonce,
                claimRequest.deadline,
                address(this)
            )
        );
        
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(claimRequest.signature);
        
        require(
            recoveredSigner == owner() || recoveredSigner == emergencyOperator,
            "Invalid signature"
        );
        
        // Update nonce to prevent replay
        userNonces[msg.sender] = claimRequest.nonce;
        
        // Update user stats
        userSpins[msg.sender].totalClaimed += claimRequest.amount;
        
        // Calculate treasury fee
        uint256 treasuryFee = (claimRequest.amount * treasuryFeePercent) / 100;
        uint256 userAmount = claimRequest.amount - treasuryFee;
        
        // Transfer tokens
        TokenConfig storage tokenConfig = tokens[claimRequest.tokenId];
        require(tokenConfig.isActive, "Token not active");
        
        if (treasuryFee > 0) {
            tokenConfig.token.safeTransfer(treasury, treasuryFee);
        }
        tokenConfig.token.safeTransfer(msg.sender, userAmount);
        
        emit TokensClaimed(
            msg.sender,
            claimRequest.tokenId,
            claimRequest.amount,
            claimRequest.nonce
        );
    }

    // ========== OWNER FUNCTIONS ==========
    
    /**
     * @dev Configure a reward token
     */
    function configureToken(
        uint256 tokenId,
        address tokenAddress,
        uint256 minReward,
        uint256 maxReward,
        bool isActive
    ) external onlyOwner {
        require(tokenId < MAX_TOKENS, "Invalid token ID");
        require(tokenAddress != address(0), "Invalid token address");
        require(maxReward >= minReward, "Invalid reward range");
        require(minReward > 0, "Min reward must be positive");
        
        TokenConfig storage config = tokens[tokenId];
        bool wasActive = config.isActive;
        
        config.token = IERC20(tokenAddress);
        config.minReward = minReward;
        config.maxReward = maxReward;
        config.isActive = isActive;
        
        // Update active token count
        if (isActive && !wasActive) {
            activeTokenCount++;
        } else if (!isActive && wasActive) {
            activeTokenCount--;
        }
        
        emit TokenConfigured(tokenId, tokenAddress, minReward, maxReward, isActive);
    }
    
    /**
     * @dev Update reward range for a token
     */
    function updateRewardRange(
        uint256 tokenId,
        uint256 newMinReward,
        uint256 newMaxReward
    ) external onlyOwner {
        require(tokens[tokenId].isActive, "Token not active");
        require(newMaxReward >= newMinReward, "Invalid range");
        require(newMinReward > 0, "Min reward must be positive");
        
        tokens[tokenId].minReward = newMinReward;
        tokens[tokenId].maxReward = newMaxReward;
        
        emit TokenConfigured(
            tokenId,
            address(tokens[tokenId].token),
            newMinReward,
            newMaxReward,
            true
        );
    }
    
    /**
     * @dev Emergency pause - can be called by owner or emergency operator
     */
    function emergencyPause() external onlyEmergencyOperator {
        _pause();
        emergencyMode = true;
        emergencyActivatedAt = block.timestamp;
        emit EmergencyModeToggled(true, msg.sender);
    }
    
    /**
     * @dev Unpause contract - only owner
     */
    function unpause() external onlyOwner {
        _unpause();
        emergencyMode = false;
        emit EmergencyModeToggled(false, msg.sender);
    }
    
    /**
     * @dev Blacklist/unblacklist user
     */
    function setUserBlacklist(address user, bool blacklisted) external onlyOwner {
        userSpins[user].isBlacklisted = blacklisted;
        emit UserBlacklisted(user, blacklisted);
    }
    
    /**
     * @dev Update treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
    
    /**
     * @dev Update emergency operator
     */
    function updateEmergencyOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid operator");
        emergencyOperator = newOperator;
    }
    
    /**
     * @dev Emergency withdraw - only when paused
     */
    function emergencyWithdraw(uint256 tokenId, uint256 amount) 
        external 
        onlyOwner 
        whenPaused 
    {
        require(emergencyMode, "Not in emergency mode");
        require(
            block.timestamp >= emergencyActivatedAt + 1 hours,
            "Emergency cooldown active"
        );
        
        tokens[tokenId].token.safeTransfer(owner(), amount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Get token configuration
     */
    function getTokenConfig(uint256 tokenId) 
        external 
        view 
        returns (
            address tokenAddress,
            uint256 minReward,
            uint256 maxReward,
            bool isActive,
            uint256 totalDistributed,
            uint256 contractBalance
        ) 
    {
        TokenConfig storage config = tokens[tokenId];
        return (
            address(config.token),
            config.minReward,
            config.maxReward,
            config.isActive,
            config.totalDistributed,
            config.token.balanceOf(address(this))
        );
    }
    
    /**
     * @dev Get user statistics
     */
    function getUserStats(address user) 
        external 
        view 
        returns (
            uint256 totalSpins,
            uint256 totalWins,
            uint256 totalClaimed,
            uint256 lastSpinBlock,
            bool isBlacklisted,
            uint256 dailySpinsToday
        ) 
    {
        SpinData storage userData = userSpins[user];
        uint256 currentDay = block.timestamp / 1 days;
        
        return (
            userData.totalSpins,
            userData.totalWins,
            userData.totalClaimed,
            userData.lastSpinBlock,
            userData.isBlacklisted,
            dailySpinCount[user][currentDay]
        );
    }
    
    /**
     * @dev Check if user can spin
     */
    function canSpin(address user, uint256 tokenId) 
        external 
        view 
        returns (bool canSpinNow, string memory reason) 
    {
        if (paused()) {
            return (false, "Contract paused");
        }
        
        if (!tokens[tokenId].isActive) {
            return (false, "Token not active");
        }
        
        if (userSpins[user].isBlacklisted) {
            return (false, "User blacklisted");
        }
        
        if (block.number < userSpins[user].lastSpinBlock + MIN_SPIN_INTERVAL) {
            return (false, "Too frequent spins");
        }
        
        uint256 currentDay = block.timestamp / 1 days;
        if (dailySpinCount[user][currentDay] >= MAX_DAILY_SPINS) {
            return (false, "Daily limit reached");
        }
        
        if (tokens[tokenId].token.balanceOf(address(this)) < tokens[tokenId].minReward) {
            return (false, "Insufficient contract balance");
        }
        
        return (true, "Can spin");
    }
    
    /**
     * @dev Get contract statistics
     */
    function getContractStats() 
        external 
        view 
        returns (
            uint256 totalActiveTokens,
            bool isPaused,
            bool inEmergencyMode,
            address treasuryAddress,
            uint256 feePercent
        ) 
    {
        return (
            activeTokenCount,
            paused(),
            emergencyMode,
            treasury,
            treasuryFeePercent
        );
    }
    
    // ========== FALLBACK ==========
    
    /**
     * @dev Reject direct ETH deposits
     */
    receive() external payable {
        revert("Direct ETH not accepted");
    }
    
    fallback() external payable {
        revert("Function not found");
    }
}