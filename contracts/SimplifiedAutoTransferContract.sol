// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimplifiedAutoTransferContract
 * @dev Streamlined contract for automatic token transfers after server-side spins
 */
contract SimplifiedAutoTransferContract is Ownable, Pausable, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // ========== ROLES ==========
    bytes32 public constant SERVER_ROLE = keccak256("SERVER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // ========== STRUCTS ==========
    struct TokenConfig {
        IERC20 token;
        uint256 totalDistributed;
        bool isActive;
        uint256 minAmount;
        uint256 maxAmount;
    }

    // ========== CONSTANTS ==========
    uint256 public constant MAX_TOKENS = 3;
    uint256 public constant MIN_TRANSFER_AMOUNT = 1e15;
    uint256 public constant MAX_TREASURY_FEE = 10;

    // ========== STORAGE ==========
    mapping(uint256 => TokenConfig) public tokens;
    mapping(address => mapping(uint256 => uint256)) public userTransferred;
    mapping(address => uint256) public userDailyTransferred;
    mapping(address => uint256) public lastTransferDay;
    mapping(address => uint256) public lastTransferTime;

    address public treasury;
    uint256 public treasuryFeePercent;
    bool public autoTransferEnabled;
    uint256 public maxPerCall;
    uint256 public dailyLimit;
    uint256 public globalDailyLimit;
    uint256 public totalDailyTransferred;
    uint256 public lastGlobalDay;
    uint256 public cooldownPeriod;

    // ========== EVENTS ==========
    event AutoTransferCompleted(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount
    );
    
    event TokenConfigured(
        uint256 indexed tokenId,
        address indexed token,
        bool isActive
    );

    // ========== MODIFIERS ==========
    modifier validToken(uint256 tokenId) {
        require(tokenId < MAX_TOKENS && tokens[tokenId].isActive, "Invalid token");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount >= MIN_TRANSFER_AMOUNT && amount <= maxPerCall, "Invalid amount");
        _;
    }
    
    modifier rateLimited(address user) {
        require(block.timestamp >= lastTransferTime[user] + cooldownPeriod, "Rate limited");
        _;
    }

    // ========== CONSTRUCTOR ==========
    constructor(
        address _treasury,
        address _emergency,
        address _server
    ) Ownable(msg.sender) {
        require(_treasury != address(0) && _emergency != address(0) && _server != address(0), "Zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SERVER_ROLE, _server);
        _grantRole(EMERGENCY_ROLE, _emergency);
        
        treasury = _treasury;
        treasuryFeePercent = 5;
        autoTransferEnabled = false;
        maxPerCall = 5 ether;
        dailyLimit = 50 ether;
        globalDailyLimit = 1000 ether;
        cooldownPeriod = 1 minutes;
        
        _pause();
    }

    // ========== MAIN FUNCTION ==========
    function autoTransfer(
        address user,
        uint256 tokenId,
        uint256 amount
    ) 
        external 
        whenNotPaused
        nonReentrant
        onlyRole(SERVER_ROLE)
        validToken(tokenId)
        validAmount(amount)
        rateLimited(user)
    {
        require(autoTransferEnabled, "Disabled");
        require(user != address(0), "Zero address");
        
        TokenConfig storage config = tokens[tokenId];
        require(amount >= config.minAmount && amount <= config.maxAmount, "Amount limits");
        
        // Daily limit checks
        uint256 today = block.timestamp / 1 days;
        if (lastTransferDay[user] != today) {
            userDailyTransferred[user] = 0;
            lastTransferDay[user] = today;
        }
        
        require(userDailyTransferred[user] + amount <= dailyLimit, "User daily limit");
        
        if (lastGlobalDay != today) {
            totalDailyTransferred = 0;
            lastGlobalDay = today;
        }
        
        require(totalDailyTransferred + amount <= globalDailyLimit, "Global daily limit");
        require(config.token.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        // Calculate fees
        uint256 treasuryFee = (amount * treasuryFeePercent) / 100;
        uint256 userAmount = amount - treasuryFee;
        require(userAmount > 0, "No amount after fees");
        
        // Update state
        config.totalDistributed += amount;
        userTransferred[user][tokenId] += amount;
        userDailyTransferred[user] += amount;
        totalDailyTransferred += amount;
        lastTransferTime[user] = block.timestamp;
        
        // Execute transfers
        if (treasuryFee > 0) {
            config.token.safeTransfer(treasury, treasuryFee);
        }
        config.token.safeTransfer(user, userAmount);
        
        emit AutoTransferCompleted(user, tokenId, amount);
    }

    // ========== ADMIN FUNCTIONS ==========
    function configureToken(
        uint256 tokenId,
        address tokenAddress,
        bool isActive,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenId < MAX_TOKENS, "Invalid token ID");
        require(tokenAddress != address(0), "Zero address");
        require(minAmount >= MIN_TRANSFER_AMOUNT, "Min too small");
        require(maxAmount <= maxPerCall, "Max too large");
        require(minAmount <= maxAmount, "Min > Max");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.totalSupply() > 0, "Invalid token");
        
        tokens[tokenId] = TokenConfig({
            token: token,
            totalDistributed: 0,
            isActive: isActive,
            minAmount: minAmount,
            maxAmount: maxAmount
        });
        
        emit TokenConfigured(tokenId, tokenAddress, isActive);
    }
    
    function setAutoTransferSettings(
        bool enabled,
        uint256 _maxPerCall,
        uint256 _dailyLimit,
        uint256 _globalLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxPerCall >= MIN_TRANSFER_AMOUNT, "Max too small");
        require(_dailyLimit >= _maxPerCall, "Daily too small");
        require(_globalLimit >= _dailyLimit * 10, "Global too small");
        
        autoTransferEnabled = enabled;
        maxPerCall = _maxPerCall;
        dailyLimit = _dailyLimit;
        globalDailyLimit = _globalLimit;
    }
    
    function setTreasury(address newTreasury, uint256 newFeePercent) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newTreasury != address(0), "Zero address");
        require(newFeePercent <= MAX_TREASURY_FEE, "Fee too high");
        
        treasury = newTreasury;
        treasuryFeePercent = newFeePercent;
    }
    
    function setCooldown(uint256 newCooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCooldown <= 1 hours, "Too long");
        cooldownPeriod = newCooldown;
    }
    
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ========== VIEW FUNCTIONS ==========
    function getTokenConfig(uint256 tokenId) 
        external 
        view 
        returns (
            address tokenAddress,
            uint256 totalDistributed,
            bool isActive,
            uint256 minAmount,
            uint256 maxAmount
        ) 
    {
        require(tokenId < MAX_TOKENS, "Invalid token");
        TokenConfig storage config = tokens[tokenId];
        return (
            address(config.token),
            config.totalDistributed,
            config.isActive,
            config.minAmount,
            config.maxAmount
        );
    }
    
    function getUserStats(address user) 
        external 
        view 
        returns (
            uint256[] memory tokenAmounts,
            uint256 dailyTransferred,
            uint256 lastTransfer
        ) 
    {
        require(user != address(0), "Zero address");
        
        tokenAmounts = new uint256[](MAX_TOKENS);
        for (uint256 i = 0; i < MAX_TOKENS; i++) {
            tokenAmounts[i] = userTransferred[user][i];
        }
        
        return (
            tokenAmounts,
            userDailyTransferred[user],
            lastTransferTime[user]
        );
    }

    // ========== EMERGENCY FUNCTIONS ==========
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(paused(), "Not paused");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}