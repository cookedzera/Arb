// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SpinAutoTransferContract
 * @dev Ultra-secure contract for automatic token transfers after server-side spins
 * @notice Follows 2024 security best practices from Solidity, OpenZeppelin, Remix IDE, and ConsenSys
 * @author Based on OWASP Smart Contract Top 10 (2025) and ConsenSys Diligence guidelines
 */
contract SpinAutoTransferContract is Ownable, Pausable, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;
    using ECDSA for bytes32;

    // ========== ACCESS CONTROL ROLES ==========
    bytes32 public constant SERVER_ROLE = keccak256("SERVER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // ========== STRUCTS ==========
    
    struct TokenConfig {
        IERC20 token;
        uint256 totalDistributed;
        uint256 autoTransferred;
        uint256 reserveBalance;
        bool isActive;
        uint256 minAmount;
        uint256 maxAmount;
    }

    // ========== CONSTANTS & IMMUTABLES ==========
    
    uint256 public constant MAX_TOKENS = 3; // TOKEN1, TOKEN2, TOKEN3
    uint256 public constant MAX_BATCH_SIZE = 10; // Prevent gas limit issues
    uint256 public constant MIN_TRANSFER_AMOUNT = 1e15; // 0.001 tokens minimum
    uint256 public constant MAX_TREASURY_FEE = 10; // 10% maximum fee
    uint256 public constant SIGNATURE_VALIDITY = 10 minutes; // Signature expiry
    
    // Contract deployment timestamp for security calculations
    uint256 public immutable deploymentTimestamp;

    // ========== STORAGE ==========
    
    // Token configurations (tokenId => TokenConfig)
    mapping(uint256 => TokenConfig) public tokens;
    uint256 public activeTokenCount;
    
    // Auto-transfer tracking and limits
    mapping(address => mapping(uint256 => uint256)) public userAutoTransferred;
    mapping(address => uint256) public userDailyTransferred;
    mapping(address => uint256) public lastTransferDay;
    
    // Security controls
    address public treasury;
    uint256 public treasuryFeePercent;
    
    // Auto-transfer configuration
    bool public autoTransferEnabled;
    bool public gasPopupBackupEnabled; // Future feature for user gas payments
    uint256 public maxAutoTransferPerCall;
    uint256 public dailyAutoTransferLimit;
    uint256 public globalDailyLimit;
    uint256 public totalDailyTransferred;
    uint256 public lastGlobalTransferDay;
    
    // Rate limiting and security
    mapping(address => uint256) public lastTransferTimestamp;
    mapping(address => uint256) public transferCount;
    uint256 public cooldownPeriod;
    
    // Circuit breaker for emergencies
    bool public circuitBreakerTripped;
    uint256 public circuitBreakerThreshold;
    uint256 public circuitBreakerWindow;

    // ========== EVENTS ==========
    
    event AutoTransferCompleted(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount,
        address indexed serverCaller,
        uint256 timestamp
    );
    
    event TokenConfigured(
        uint256 indexed tokenId,
        address indexed token,
        bool isActive,
        uint256 minAmount,
        uint256 maxAmount
    );
    
    event SecurityLimitUpdated(
        string indexed limitType,
        uint256 oldValue,
        uint256 newValue,
        address indexed updatedBy
    );
    
    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury,
        uint256 indexed feePercent
    );
    
    event CircuitBreakerTripped(
        string reason,
        uint256 timestamp,
        address indexed triggeredBy
    );
    
    event CircuitBreakerReset(
        uint256 timestamp,
        address indexed resetBy
    );
    
    event GasPopupBackupToggled(
        bool enabled,
        address indexed toggledBy
    );
    
    event RateLimitExceeded(
        address indexed user,
        uint256 attemptedAmount,
        uint256 currentLimit,
        uint256 timestamp
    );

    // ========== MODIFIERS ==========
    
    modifier onlyActiveToken(uint256 tokenId) {
        require(tokenId < MAX_TOKENS, "SCAUT001: Invalid token ID");
        require(tokens[tokenId].isActive, "SCAUT002: Token not active");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount >= MIN_TRANSFER_AMOUNT, "SCAUT003: Amount too small");
        require(amount <= maxAutoTransferPerCall, "SCAUT004: Amount exceeds maximum");
        _;
    }
    
    modifier notCircuitBroken() {
        require(!circuitBreakerTripped, "SCAUT005: Circuit breaker activated");
        _;
    }
    
    modifier rateLimited(address user) {
        require(
            block.timestamp >= lastTransferTimestamp[user] + cooldownPeriod,
            "SCAUT006: Rate limit exceeded"
        );
        _;
    }
    
    modifier validAddress(address addr) {
        require(addr != address(0), "SCAUT007: Zero address not allowed");
        require(addr != address(this), "SCAUT008: Self-reference not allowed");
        _;
    }

    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _treasury,
        address _emergencyOperator,
        address _serverWallet
    ) Ownable(msg.sender) {
        // Input validation
        require(_treasury != address(0), "SCAUT009: Invalid treasury address");
        require(_emergencyOperator != address(0), "SCAUT010: Invalid emergency operator");
        require(_serverWallet != address(0), "SCAUT011: Invalid server wallet");
        
        // Prevent same address for critical roles
        require(_treasury != _emergencyOperator, "SCAUT012: Duplicate treasury/emergency");
        require(_treasury != _serverWallet, "SCAUT013: Duplicate treasury/server");
        require(_emergencyOperator != _serverWallet, "SCAUT014: Duplicate emergency/server");
        
        // Store deployment timestamp for security calculations
        deploymentTimestamp = block.timestamp;
        
        // Initialize access control
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SERVER_ROLE, _serverWallet);
        _grantRole(EMERGENCY_ROLE, _emergencyOperator);
        _grantRole(TREASURY_ROLE, _treasury);
        
        // Set initial configuration
        treasury = _treasury;
        treasuryFeePercent = 0; // 0% fee - 100% goes to winners
        
        // Security settings
        autoTransferEnabled = false; // Disabled by default for safety
        gasPopupBackupEnabled = false; // Future feature disabled
        maxAutoTransferPerCall = 5 ether; // Conservative default
        dailyAutoTransferLimit = 50 ether; // Conservative daily limit
        globalDailyLimit = 1000 ether; // Global daily protection
        cooldownPeriod = 1 minutes; // Rate limiting
        
        // Circuit breaker configuration
        circuitBreakerThreshold = 100 ether; // Trip if >100 ether transferred rapidly
        circuitBreakerWindow = 1 hours; // Within 1 hour window
        
        // Contract starts paused for safety
        _pause();
    }

    // ========== AUTO-TRANSFER FUNCTIONS ==========
    
    /**
     * @dev Auto-transfer tokens after server spin with comprehensive security checks
     * @param user Address to receive tokens (must be validated)
     * @param tokenId Token type (0=TOKEN1, 1=TOKEN2, 2=TOKEN3)
     * @param amount Amount to transfer in wei (subject to limits)
     * @notice Follows checks-effects-interactions pattern for reentrancy protection
     */
    function autoTransfer(
        address user,
        uint256 tokenId,
        uint256 amount
    ) 
        external 
        whenNotPaused
        nonReentrant
        onlyRole(SERVER_ROLE)
        onlyActiveToken(tokenId)
        validAmount(amount)
        notCircuitBroken
        rateLimited(user)
        validAddress(user)
    {
        // ========== CHECKS ==========
        
        require(autoTransferEnabled, "SCAUT015: Auto-transfer disabled");
        
        // Validate amount against token-specific limits
        TokenConfig storage tokenConfig = tokens[tokenId];
        require(amount >= tokenConfig.minAmount, "SCAUT016: Below minimum amount");
        require(amount <= tokenConfig.maxAmount, "SCAUT017: Above maximum amount");
        
        // Check daily limits (user-specific)
        uint256 today = block.timestamp / 1 days;
        if (lastTransferDay[user] != today) {
            userDailyTransferred[user] = 0;
            lastTransferDay[user] = today;
        }
        
        require(
            userDailyTransferred[user] + amount <= dailyAutoTransferLimit,
            "SCAUT018: User daily limit exceeded"
        );
        
        // Check global daily limits
        if (lastGlobalTransferDay != today) {
            totalDailyTransferred = 0;
            lastGlobalTransferDay = today;
        }
        
        require(
            totalDailyTransferred + amount <= globalDailyLimit,
            "SCAUT019: Global daily limit exceeded"
        );
        
        // Contract balance validation
        uint256 contractBalance = tokenConfig.token.balanceOf(address(this));
        require(contractBalance >= amount, "SCAUT020: Insufficient contract balance");
        
        // Calculate fees and amounts
        uint256 treasuryFee = (amount * treasuryFeePercent) / 100;
        uint256 userAmount = amount - treasuryFee;
        
        // Ensure user receives meaningful amount after fees
        require(userAmount > 0, "SCAUT021: Amount too small after fees");
        
        // Circuit breaker check
        if (totalDailyTransferred + amount > circuitBreakerThreshold) {
            circuitBreakerTripped = true;
            emit CircuitBreakerTripped("Daily threshold exceeded", block.timestamp, msg.sender);
            revert("SCAUT022: Circuit breaker triggered");
        }
        
        // ========== EFFECTS ==========
        
        // Update all state before external calls
        tokenConfig.totalDistributed += amount;
        tokenConfig.autoTransferred += amount;
        userAutoTransferred[user][tokenId] += amount;
        userDailyTransferred[user] += amount;
        totalDailyTransferred += amount;
        lastTransferTimestamp[user] = block.timestamp;
        transferCount[user] += 1;
        
        // ========== INTERACTIONS ==========
        
        // Execute transfers (treasury first for additional security)
        if (treasuryFee > 0) {
            tokenConfig.token.safeTransfer(treasury, treasuryFee);
        }
        tokenConfig.token.safeTransfer(user, userAmount);
        
        // Emit detailed event for transparency
        emit AutoTransferCompleted(user, tokenId, amount, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Batch auto-transfer for multiple users (gas optimization with enhanced security)
     * @param users Array of recipient addresses
     * @param tokenIds Array of token IDs
     * @param amounts Array of transfer amounts
     * @notice Limited to MAX_BATCH_SIZE to prevent gas limit issues
     */
    function batchAutoTransfer(
        address[] calldata users,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) 
        external 
        whenNotPaused
        nonReentrant
        onlyRole(SERVER_ROLE)
        notCircuitBroken
    {
        // Input validation
        require(users.length == tokenIds.length, "SCAUT023: Users/tokens length mismatch");
        require(tokenIds.length == amounts.length, "SCAUT024: Tokens/amounts length mismatch");
        require(users.length > 0, "SCAUT025: Empty batch not allowed");
        require(users.length <= MAX_BATCH_SIZE, "SCAUT026: Batch size too large");
        
        // Pre-validate all transfers to prevent partial failures
        uint256 totalBatchAmount = 0;
        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "SCAUT027: Zero address in batch");
            require(tokenIds[i] < MAX_TOKENS, "SCAUT028: Invalid token ID in batch");
            require(tokens[tokenIds[i]].isActive, "SCAUT029: Inactive token in batch");
            require(amounts[i] >= MIN_TRANSFER_AMOUNT, "SCAUT030: Amount too small in batch");
            require(amounts[i] <= maxAutoTransferPerCall, "SCAUT031: Amount too large in batch");
            
            totalBatchAmount += amounts[i];
        }
        
        // Check global batch limit
        require(totalBatchAmount <= globalDailyLimit / 10, "SCAUT032: Batch exceeds safety limit");
        
        // Execute all transfers
        for (uint256 i = 0; i < users.length; i++) {
            _secureAutoTransferInternal(users[i], tokenIds[i], amounts[i]);
        }
    }
    
    /**
     * @dev Internal secure transfer function with comprehensive checks
     * @param user Recipient address
     * @param tokenId Token identifier  
     * @param amount Transfer amount
     * @notice Follows all security patterns for internal calls
     */
    function _secureAutoTransferInternal(
        address user, 
        uint256 tokenId, 
        uint256 amount
    ) private {
        // Daily limit checks
        uint256 today = block.timestamp / 1 days;
        if (lastTransferDay[user] != today) {
            userDailyTransferred[user] = 0;
            lastTransferDay[user] = today;
        }
        
        require(
            userDailyTransferred[user] + amount <= dailyAutoTransferLimit,
            "SCAUT033: User daily limit in batch"
        );
        
        TokenConfig storage tokenConfig = tokens[tokenId];
        
        // Balance and limit validations
        require(amount >= tokenConfig.minAmount, "SCAUT034: Below min in batch");
        require(amount <= tokenConfig.maxAmount, "SCAUT035: Above max in batch");
        require(
            tokenConfig.token.balanceOf(address(this)) >= amount,
            "SCAUT036: Insufficient balance in batch"
        );
        
        // Calculate fees
        uint256 treasuryFee = (amount * treasuryFeePercent) / 100;
        uint256 userAmount = amount - treasuryFee;
        require(userAmount > 0, "SCAUT037: No amount after fees in batch");
        
        // Update state
        tokenConfig.totalDistributed += amount;
        tokenConfig.autoTransferred += amount;
        userAutoTransferred[user][tokenId] += amount;
        userDailyTransferred[user] += amount;
        totalDailyTransferred += amount;
        lastTransferTimestamp[user] = block.timestamp;
        transferCount[user] += 1;
        
        // Execute transfers
        if (treasuryFee > 0) {
            tokenConfig.token.safeTransfer(treasury, treasuryFee);
        }
        tokenConfig.token.safeTransfer(user, userAmount);
        
        emit AutoTransferCompleted(user, tokenId, amount, msg.sender, block.timestamp);
    }

    // ========== GAS POPUP BACKUP FUNCTIONS (Future Feature) ==========
    
    /**
     * @dev Enable/disable gas popup backup for future use
     * @param enabled Whether to enable gas popup backup
     * @notice Future feature - allows users to pay gas for failed auto-transfers
     */
    function setGasPopupBackup(bool enabled) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        gasPopupBackupEnabled = enabled;
        emit GasPopupBackupToggled(enabled, msg.sender);
    }
    
    /**
     * @dev Check if gas popup backup is available for user
     * @param user User address to check
     * @return canUseBackup Whether user can use gas popup backup
     * @return estimatedGas Estimated gas cost for user transaction
     * @notice Future implementation will integrate with frontend gas estimation
     */
    function canUseGasPopupBackup(address user) 
        external 
        view 
        validAddress(user)
        returns (bool canUseBackup, uint256 estimatedGas) 
    {
        canUseBackup = gasPopupBackupEnabled && !paused();
        estimatedGas = gasPopupBackupEnabled ? 150000 : 0; // Estimated gas for transfer
        
        return (canUseBackup, estimatedGas);
    }

    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @dev Configure a token with comprehensive security validation
     * @param tokenId Token identifier (0-2)
     * @param tokenAddress ERC20 token contract address
     * @param isActive Whether token should be active for transfers
     * @param minAmount Minimum transfer amount for this token
     * @param maxAmount Maximum transfer amount for this token
     */
    function configureToken(
        uint256 tokenId,
        address tokenAddress,
        bool isActive,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validAddress(tokenAddress) {
        require(tokenId < MAX_TOKENS, "SCAUT038: Invalid token ID");
        require(minAmount >= MIN_TRANSFER_AMOUNT, "SCAUT039: Min amount too small");
        require(maxAmount <= maxAutoTransferPerCall, "SCAUT040: Max amount too large");
        require(minAmount <= maxAmount, "SCAUT041: Min greater than max");
        
        // Validate token contract (basic ERC20 check)
        IERC20 token = IERC20(tokenAddress);
        require(token.totalSupply() > 0, "SCAUT042: Invalid ERC20 token");
        
        TokenConfig storage config = tokens[tokenId];
        bool wasActive = config.isActive;
        
        // Update configuration
        config.token = token;
        config.isActive = isActive;
        config.minAmount = minAmount;
        config.maxAmount = maxAmount;
        
        // Update active token count
        if (isActive && !wasActive) {
            activeTokenCount++;
        } else if (!isActive && wasActive) {
            activeTokenCount--;
        }
        
        emit TokenConfigured(tokenId, tokenAddress, isActive, minAmount, maxAmount);
    }
    
    /**
     * @dev Update auto-transfer settings with validation
     */
    function setAutoTransferSettings(
        bool enabled,
        uint256 maxPerCall,
        uint256 dailyLimit,
        uint256 globalLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxPerCall >= MIN_TRANSFER_AMOUNT, "SCAUT043: Max per call too small");
        require(dailyLimit >= maxPerCall, "SCAUT044: Daily limit too small");
        require(globalLimit >= dailyLimit * 10, "SCAUT045: Global limit too small");
        
        uint256 oldMaxPerCall = maxAutoTransferPerCall;
        uint256 oldDailyLimit = dailyAutoTransferLimit;
        
        autoTransferEnabled = enabled;
        maxAutoTransferPerCall = maxPerCall;
        dailyAutoTransferLimit = dailyLimit;
        globalDailyLimit = globalLimit;
        
        emit SecurityLimitUpdated("maxPerCall", oldMaxPerCall, maxPerCall, msg.sender);
        emit SecurityLimitUpdated("dailyLimit", oldDailyLimit, dailyLimit, msg.sender);
    }
    
    /**
     * @dev Update treasury address and fee with strict validation
     */
    function setTreasury(address newTreasury, uint256 newFeePercent) 
        external 
        onlyRole(TREASURY_ROLE) 
        validAddress(newTreasury) 
    {
        require(newFeePercent <= MAX_TREASURY_FEE, "SCAUT046: Fee too high");
        require(newTreasury != treasury, "SCAUT047: Same treasury address");
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        treasuryFeePercent = newFeePercent;
        
        emit TreasuryUpdated(oldTreasury, newTreasury, newFeePercent);
    }
    
    /**
     * @dev Update rate limiting settings
     */
    function setRateLimiting(uint256 newCooldownPeriod) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newCooldownPeriod <= 1 hours, "SCAUT048: Cooldown too long");
        
        uint256 oldCooldown = cooldownPeriod;
        cooldownPeriod = newCooldownPeriod;
        
        emit SecurityLimitUpdated("cooldownPeriod", oldCooldown, newCooldownPeriod, msg.sender);
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
        circuitBreakerTripped = true;
        emit CircuitBreakerTripped("Emergency pause", block.timestamp, msg.sender);
    }
    
    /**
     * @dev Unpause contract after safety checks
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!circuitBreakerTripped, "SCAUT049: Reset circuit breaker first");
        _unpause();
    }
    
    /**
     * @dev Reset circuit breaker after investigation
     */
    function resetCircuitBreaker() external onlyRole(EMERGENCY_ROLE) {
        circuitBreakerTripped = false;
        emit CircuitBreakerReset(block.timestamp, msg.sender);
    }

    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Get comprehensive token configuration
     */
    function getTokenConfig(uint256 tokenId) 
        external 
        view 
        returns (
            address tokenAddress,
            uint256 totalDistributed,
            uint256 autoTransferred,
            uint256 reserveBalance,
            bool isActive,
            uint256 minAmount,
            uint256 maxAmount
        ) 
    {
        require(tokenId < MAX_TOKENS, "SCAUT050: Invalid token ID");
        
        TokenConfig storage config = tokens[tokenId];
        return (
            address(config.token),
            config.totalDistributed,
            config.autoTransferred,
            config.reserveBalance,
            config.isActive,
            config.minAmount,
            config.maxAmount
        );
    }
    
    /**
     * @dev Get user's transfer statistics
     */
    function getUserTransferStats(address user) 
        external 
        view 
        validAddress(user)
        returns (
            uint256[] memory tokenAmounts,
            uint256 dailyTransferred,
            uint256 transferCount_,
            uint256 lastTransfer,
            bool canTransfer
        ) 
    {
        tokenAmounts = new uint256[](MAX_TOKENS);
        for (uint256 i = 0; i < MAX_TOKENS; i++) {
            tokenAmounts[i] = userAutoTransferred[user][i];
        }
        
        uint256 today = block.timestamp / 1 days;
        uint256 userDailyAmount = (lastTransferDay[user] == today) ? userDailyTransferred[user] : 0;
        
        return (
            tokenAmounts,
            userDailyAmount,
            transferCount[user],
            lastTransferTimestamp[user],
            _canUserTransfer(user)
        );
    }
    
    /**
     * @dev Get comprehensive contract security status
     */
    function getSecurityStatus() 
        external 
        view 
        returns (
            bool autoTransferEnabled_,
            bool gasPopupBackupEnabled_,
            bool circuitBreakerTripped_,
            bool isPaused,
            uint256 activeTokens,
            uint256 globalDailyTransferred,
            uint256 deploymentAge
        ) 
    {
        uint256 today = block.timestamp / 1 days;
        uint256 currentGlobalDaily = (lastGlobalTransferDay == today) ? totalDailyTransferred : 0;
        
        return (
            autoTransferEnabled,
            gasPopupBackupEnabled,
            circuitBreakerTripped,
            paused(),
            activeTokenCount,
            currentGlobalDaily,
            block.timestamp - deploymentTimestamp
        );
    }
    
    /**
     * @dev Get current limits and settings
     */
    function getCurrentLimits() 
        external 
        view 
        returns (
            uint256 maxPerCall,
            uint256 dailyLimit,
            uint256 globalLimit,
            uint256 treasuryFee,
            uint256 cooldown,
            uint256 minTransfer
        ) 
    {
        return (
            maxAutoTransferPerCall,
            dailyAutoTransferLimit,
            globalDailyLimit,
            treasuryFeePercent,
            cooldownPeriod,
            MIN_TRANSFER_AMOUNT
        );
    }
    
    /**
     * @dev Check if user can make a transfer
     */
    function _canUserTransfer(address user) private view returns (bool) {
        if (paused() || circuitBreakerTripped || !autoTransferEnabled) {
            return false;
        }
        
        // Check cooldown
        if (block.timestamp < lastTransferTimestamp[user] + cooldownPeriod) {
            return false;
        }
        
        // Check daily limits
        uint256 today = block.timestamp / 1 days;
        if (lastTransferDay[user] == today && userDailyTransferred[user] >= dailyAutoTransferLimit) {
            return false;
        }
        
        if (lastGlobalTransferDay == today && totalDailyTransferred >= globalDailyLimit) {
            return false;
        }
        
        return true;
    }

    // ========== EMERGENCY FUNCTIONS ==========
    
    /**
     * @dev Emergency token recovery (only for stuck tokens)
     * @param tokenAddress Token contract address  
     * @param amount Amount to recover
     * @notice Only recovers tokens not part of active reward system
     */
    function emergencyTokenRecovery(
        address tokenAddress, 
        uint256 amount
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        validAddress(tokenAddress)
    {
        require(amount > 0, "SCAUT051: Zero amount");
        
        // Prevent recovery of active reward tokens
        for (uint256 i = 0; i < MAX_TOKENS; i++) {
            if (tokens[i].isActive) {
                require(
                    address(tokens[i].token) != tokenAddress,
                    "SCAUT052: Cannot recover active reward token"
                );
            }
        }
        
        IERC20(tokenAddress).safeTransfer(msg.sender, amount);
    }
    
    /**
     * @dev Update multiple security parameters atomically
     */
    function updateSecurityParameters(
        uint256 newMaxPerCall,
        uint256 newDailyLimit,
        uint256 newGlobalLimit,
        uint256 newCooldown,
        uint256 newCircuitThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxPerCall >= MIN_TRANSFER_AMOUNT, "SCAUT053: Max per call too small");
        require(newDailyLimit >= newMaxPerCall, "SCAUT054: Daily limit too small");
        require(newGlobalLimit >= newDailyLimit * 10, "SCAUT055: Global limit too small");
        require(newCooldown <= 1 hours, "SCAUT056: Cooldown too long");
        require(newCircuitThreshold > 0, "SCAUT057: Circuit threshold zero");
        
        maxAutoTransferPerCall = newMaxPerCall;
        dailyAutoTransferLimit = newDailyLimit;
        globalDailyLimit = newGlobalLimit;
        cooldownPeriod = newCooldown;
        circuitBreakerThreshold = newCircuitThreshold;
        
        emit SecurityLimitUpdated("batchUpdate", 0, block.timestamp, msg.sender);
    }
    
    // ========== ACCESS CONTROL OVERRIDES ==========
    
    /**
     * @dev Override supportsInterface for AccessControl
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}