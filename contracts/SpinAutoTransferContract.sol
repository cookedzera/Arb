// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SpinAutoTransferContract
 * @dev Hybrid contract supporting both auto-transfer (server-initiated) and manual claims
 * Server spins determine results, contract handles secure token distribution
 */
contract SpinAutoTransferContract is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    // ========== STRUCTS ==========
    
    struct TokenConfig {
        IERC20 token;
        uint256 totalDistributed;
        uint256 autoTransferred;
        uint256 manuallyClaimed;
        bool isActive;
    }
    
    struct ClaimRequest {
        address user;
        uint256 tokenId;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    // ========== STORAGE ==========
    
    // Contract configuration
    uint256 public constant MAX_TOKENS = 10;
    uint256 public constant CLAIM_DEADLINE = 24 hours;
    
    // Token configurations (tokenId => TokenConfig)
    mapping(uint256 => TokenConfig) public tokens;
    uint256 public activeTokenCount;
    
    // User nonces for manual claims (replay protection)
    mapping(address => uint256) public userNonces;
    
    // Auto-transfer tracking
    mapping(address => mapping(uint256 => uint256)) public userAutoTransferred;
    
    // Emergency controls
    address public emergencyOperator;
    bool public emergencyMode;
    
    // Revenue sharing
    address public treasury;
    uint256 public treasuryFeePercent = 5; // 5% fee
    
    // Server wallet (authorized to call autoTransfer)
    address public serverWallet;
    
    // Claim signer (for manual claims)
    address public claimSigner;
    
    // Auto-transfer settings
    bool public autoTransferEnabled = true;
    uint256 public maxAutoTransferPerCall = 10 ether; // Prevent huge single transfers
    uint256 public dailyAutoTransferLimit = 100 ether; // Daily limit per user
    mapping(address => uint256) public userDailyTransferred;
    mapping(address => uint256) public lastTransferDay;

    // ========== EVENTS ==========
    
    event AutoTransferCompleted(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount,
        address indexed serverWallet
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
        bool isActive
    );
    
    event ServerWalletUpdated(address indexed newServerWallet);
    event AutoTransferSettingsUpdated(bool enabled, uint256 maxPerCall, uint256 dailyLimit);
    event EmergencyModeToggled(bool enabled, address operator);

    // ========== MODIFIERS ==========
    
    modifier onlyActiveToken(uint256 tokenId) {
        require(tokens[tokenId].isActive, "Token not active");
        _;
    }
    
    modifier onlyServerWallet() {
        require(msg.sender == serverWallet, "Only server wallet");
        _;
    }
    
    modifier onlyEmergencyOperator() {
        require(
            msg.sender == owner() || msg.sender == emergencyOperator,
            "Not authorized"
        );
        _;
    }

    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _treasury,
        address _emergencyOperator,
        address _serverWallet,
        address _claimSigner
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_emergencyOperator != address(0), "Invalid emergency operator");
        require(_serverWallet != address(0), "Invalid server wallet");
        require(_claimSigner != address(0), "Invalid claim signer");
        
        treasury = _treasury;
        emergencyOperator = _emergencyOperator;
        serverWallet = _serverWallet;
        claimSigner = _claimSigner;
        
        // Contract starts paused for safety
        _pause();
    }

    // ========== AUTO-TRANSFER FUNCTIONS ==========
    
    /**
     * @dev Auto-transfer tokens after server spin (called by server wallet)
     * @param user Address to receive tokens
     * @param tokenId Token type (0=TOKEN1, 1=TOKEN2, 2=TOKEN3)
     * @param amount Amount to transfer (in wei)
     */
    function autoTransfer(
        address user,
        uint256 tokenId,
        uint256 amount
    ) 
        external 
        whenNotPaused
        nonReentrant
        onlyServerWallet
        onlyActiveToken(tokenId)
    {
        require(autoTransferEnabled, "Auto-transfer disabled");
        require(user != address(0), "Invalid user");
        require(amount > 0, "Invalid amount");
        require(amount <= maxAutoTransferPerCall, "Amount exceeds max per call");
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        if (lastTransferDay[user] != today) {
            userDailyTransferred[user] = 0;
            lastTransferDay[user] = today;
        }
        
        require(
            userDailyTransferred[user] + amount <= dailyAutoTransferLimit,
            "Daily limit exceeded"
        );
        
        TokenConfig storage tokenConfig = tokens[tokenId];
        
        // Check contract has sufficient balance
        require(
            tokenConfig.token.balanceOf(address(this)) >= amount,
            "Insufficient contract balance"
        );
        
        // Calculate treasury fee
        uint256 treasuryFee = (amount * treasuryFeePercent) / 100;
        uint256 userAmount = amount - treasuryFee;
        
        // Transfer tokens
        if (treasuryFee > 0) {
            tokenConfig.token.safeTransfer(treasury, treasuryFee);
        }
        tokenConfig.token.safeTransfer(user, userAmount);
        
        // Update tracking
        tokenConfig.totalDistributed += amount;
        tokenConfig.autoTransferred += amount;
        userAutoTransferred[user][tokenId] += amount;
        userDailyTransferred[user] += amount;
        
        emit AutoTransferCompleted(user, tokenId, amount, serverWallet);
    }
    
    /**
     * @dev Batch auto-transfer for multiple users (gas optimization)
     */
    function batchAutoTransfer(
        address[] calldata users,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) 
        external 
        whenNotPaused
        nonReentrant
        onlyServerWallet
    {
        require(users.length == tokenIds.length && tokenIds.length == amounts.length, "Array length mismatch");
        require(users.length <= 20, "Too many transfers");
        
        for (uint i = 0; i < users.length; i++) {
            // Internal call to avoid reentrancy issues
            _autoTransferInternal(users[i], tokenIds[i], amounts[i]);
        }
    }
    
    function _autoTransferInternal(address user, uint256 tokenId, uint256 amount) private {
        require(autoTransferEnabled, "Auto-transfer disabled");
        require(user != address(0), "Invalid user");
        require(amount > 0, "Invalid amount");
        require(tokens[tokenId].isActive, "Token not active");
        require(amount <= maxAutoTransferPerCall, "Amount exceeds max per call");
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        if (lastTransferDay[user] != today) {
            userDailyTransferred[user] = 0;
            lastTransferDay[user] = today;
        }
        
        require(
            userDailyTransferred[user] + amount <= dailyAutoTransferLimit,
            "Daily limit exceeded"
        );
        
        TokenConfig storage tokenConfig = tokens[tokenId];
        
        // Check contract has sufficient balance
        require(
            tokenConfig.token.balanceOf(address(this)) >= amount,
            "Insufficient contract balance"
        );
        
        // Calculate treasury fee
        uint256 treasuryFee = (amount * treasuryFeePercent) / 100;
        uint256 userAmount = amount - treasuryFee;
        
        // Transfer tokens
        if (treasuryFee > 0) {
            tokenConfig.token.safeTransfer(treasury, treasuryFee);
        }
        tokenConfig.token.safeTransfer(user, userAmount);
        
        // Update tracking
        tokenConfig.totalDistributed += amount;
        tokenConfig.autoTransferred += amount;
        userAutoTransferred[user][tokenId] += amount;
        userDailyTransferred[user] += amount;
        
        emit AutoTransferCompleted(user, tokenId, amount, serverWallet);
    }

    // ========== MANUAL CLAIM FUNCTIONS (FALLBACK) ==========
    
    /**
     * @dev Manual claim tokens with signature verification (fallback when auto-transfer fails)
     */
    function claimTokens(ClaimRequest calldata claimRequest) 
        external 
        whenNotPaused
        nonReentrant
        onlyActiveToken(claimRequest.tokenId)
    {
        require(claimRequest.user == msg.sender, "Invalid claimer");
        require(block.timestamp <= claimRequest.deadline, "Claim expired");
        require(claimRequest.amount > 0, "Invalid amount");
        
        // Verify nonce (prevents replay attacks)
        require(claimRequest.nonce == userNonces[msg.sender] + 1, "Invalid nonce");
        
        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                claimRequest.user,
                claimRequest.tokenId,
                claimRequest.amount,
                claimRequest.nonce,
                claimRequest.deadline
            )
        );
        
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        require(_verifySignature(ethSignedMessageHash, claimRequest.signature), "Invalid signature");
        
        // Update nonce
        userNonces[msg.sender] = claimRequest.nonce;
        
        TokenConfig storage tokenConfig = tokens[claimRequest.tokenId];
        
        // Calculate treasury fee
        require(claimRequest.amount >= 100, "Amount too small for fee calculation");
        uint256 treasuryFee = (claimRequest.amount * treasuryFeePercent) / 100;
        uint256 userAmount = claimRequest.amount - treasuryFee;
        
        // Check contract has sufficient balance
        require(
            tokenConfig.token.balanceOf(address(this)) >= claimRequest.amount,
            "Insufficient contract balance"
        );
        
        // Transfer tokens
        if (treasuryFee > 0) {
            tokenConfig.token.safeTransfer(treasury, treasuryFee);
        }
        tokenConfig.token.safeTransfer(claimRequest.user, userAmount);
        
        // Update tracking
        tokenConfig.totalDistributed += claimRequest.amount;
        tokenConfig.manuallyClaimed += claimRequest.amount;
        
        emit TokensClaimed(
            claimRequest.user,
            claimRequest.tokenId,
            claimRequest.amount,
            claimRequest.nonce
        );
    }

    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @dev Configure a token for rewards
     */
    function configureToken(
        uint256 tokenId,
        address tokenAddress,
        bool isActive
    ) external onlyOwner {
        require(tokenId < MAX_TOKENS, "Invalid token ID");
        require(tokenAddress != address(0), "Invalid token address");
        
        TokenConfig storage config = tokens[tokenId];
        bool wasActive = config.isActive;
        
        config.token = IERC20(tokenAddress);
        config.isActive = isActive;
        
        // Update active token count
        if (isActive && !wasActive) {
            activeTokenCount++;
        } else if (!isActive && wasActive) {
            activeTokenCount--;
        }
        
        emit TokenConfigured(tokenId, tokenAddress, isActive);
    }
    
    /**
     * @dev Update server wallet address
     */
    function setServerWallet(address _serverWallet) external onlyOwner {
        require(_serverWallet != address(0), "Invalid server wallet");
        serverWallet = _serverWallet;
        emit ServerWalletUpdated(_serverWallet);
    }
    
    /**
     * @dev Update auto-transfer settings
     */
    function setAutoTransferSettings(
        bool _enabled,
        uint256 _maxPerCall,
        uint256 _dailyLimit
    ) external onlyOwner {
        autoTransferEnabled = _enabled;
        maxAutoTransferPerCall = _maxPerCall;
        dailyAutoTransferLimit = _dailyLimit;
        emit AutoTransferSettingsUpdated(_enabled, _maxPerCall, _dailyLimit);
    }
    
    /**
     * @dev Update claim signer address
     */
    function setClaimSigner(address _claimSigner) external onlyOwner {
        require(_claimSigner != address(0), "Invalid signer");
        claimSigner = _claimSigner;
    }
    
    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
    
    /**
     * @dev Owner can unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Toggle emergency mode
     */
    function setEmergencyMode(bool _enabled) external onlyEmergencyOperator {
        emergencyMode = _enabled;
        if (_enabled) {
            _pause();
        } else {
            _unpause();
        }
        emit EmergencyModeToggled(_enabled, msg.sender);
    }

    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Get token configuration and stats
     */
    function getTokenConfig(uint256 tokenId) 
        external 
        view 
        returns (
            address tokenAddress,
            uint256 totalDistributed,
            uint256 autoTransferred,
            uint256 manuallyClaimed,
            bool isActive
        ) 
    {
        TokenConfig storage config = tokens[tokenId];
        return (
            address(config.token),
            config.totalDistributed,
            config.autoTransferred,
            config.manuallyClaimed,
            config.isActive
        );
    }
    
    /**
     * @dev Get user's auto-transfer history
     */
    function getUserAutoTransferHistory(address user) 
        external 
        view 
        returns (uint256[] memory amounts) 
    {
        amounts = new uint256[](MAX_TOKENS);
        for (uint i = 0; i < MAX_TOKENS; i++) {
            amounts[i] = userAutoTransferred[user][i];
        }
        return amounts;
    }
    
    /**
     * @dev Get contract configuration
     */
    function getContractConfig() 
        external 
        view 
        returns (
            bool autoTransferEnabled_,
            uint256 maxAutoTransferPerCall_,
            uint256 dailyAutoTransferLimit_,
            address serverWallet_,
            address claimSigner_,
            bool isPaused,
            uint256 activeTokens
        ) 
    {
        return (
            autoTransferEnabled,
            maxAutoTransferPerCall,
            dailyAutoTransferLimit,
            serverWallet,
            claimSigner,
            paused(),
            activeTokenCount
        );
    }

    // ========== INTERNAL FUNCTIONS ==========
    
    /**
     * @dev Verify signature against claim signer
     */
    function _verifySignature(bytes32 hash, bytes memory signature) 
        internal 
        view 
        returns (bool) 
    {
        return _recoverSigner(hash, signature) == claimSigner;
    }
    
    /**
     * @dev Recover signer from signature
     */
    function _recoverSigner(bytes32 hash, bytes memory signature) 
        internal 
        pure 
        returns (address) 
    {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        // Prevent signature malleability
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "Invalid signature 's' value"
        );
        
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "Invalid signature");
        
        return signer;
    }
    
    // ========== FALLBACK ==========
    
    receive() external payable {
        revert("Direct ETH not accepted");
    }
    
    fallback() external payable {
        revert("Function not found");
    }
}