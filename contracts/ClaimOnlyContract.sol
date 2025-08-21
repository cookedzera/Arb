// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ClaimOnlyContract
 * @dev Simplified contract for claiming tokens with signature verification
 * Spinning happens on server-side, contract only handles secure token distribution
 */
contract ClaimOnlyContract is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    // ========== STRUCTS ==========
    
    struct TokenConfig {
        IERC20 token;
        uint256 totalDistributed;
        uint256 reserveBalance;
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
    
    // User nonces for replay protection
    mapping(address => uint256) public userNonces;
    
    // Emergency controls
    address public emergencyOperator;
    bool public emergencyMode;
    
    // Revenue sharing
    address public treasury;
    uint256 public treasuryFeePercent = 5; // 5% fee
    
    // Claim signer (server wallet)
    address public claimSigner;

    // ========== EVENTS ==========
    
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
    
    event EmergencyModeToggled(bool enabled, address operator);
    event TreasuryUpdated(address indexed newTreasury);
    event ClaimSignerUpdated(address indexed newSigner);
    
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

    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _treasury,
        address _emergencyOperator,
        address _claimSigner
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_emergencyOperator != address(0), "Invalid emergency operator");
        require(_claimSigner != address(0), "Invalid claim signer");
        
        treasury = _treasury;
        emergencyOperator = _emergencyOperator;
        claimSigner = _claimSigner;
        
        // Contract starts paused for safety
        _pause();
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
        onlyActiveToken(claimRequest.tokenId)
    {
        require(claimRequest.user == msg.sender, "Invalid claimer");
        require(block.timestamp <= claimRequest.deadline, "Claim expired");
        require(claimRequest.amount > 0, "Invalid amount");
        
        // Verify nonce (prevents replay attacks) - must be exactly next nonce
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
        
        // Calculate treasury fee (prevent zero-amount claims after fee)
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
        
        emit TokensClaimed(
            claimRequest.user,
            claimRequest.tokenId,
            claimRequest.amount,
            claimRequest.nonce
        );
    }
    
    /**
     * @dev Batch claim multiple tokens in one transaction
     * @param claimRequests Array of claim requests
     */
    function batchClaimTokens(ClaimRequest[] calldata claimRequests) 
        external 
        whenNotPaused
        nonReentrant
    {
        require(claimRequests.length > 0, "Empty claims");
        require(claimRequests.length <= 10, "Too many claims");
        
        uint256 currentNonce = userNonces[msg.sender];
        
        // Pre-validate all claims to prevent partial failures
        for (uint i = 0; i < claimRequests.length; i++) {
            ClaimRequest calldata req = claimRequests[i];
            require(req.user == msg.sender, "Invalid claimer");
            require(tokens[req.tokenId].isActive, "Token not active");
            require(block.timestamp <= req.deadline, "Claim expired");
            require(req.amount >= 100, "Amount too small for fee calculation");
            require(req.nonce == currentNonce + i + 1, "Invalid nonce sequence");
            
            // Verify signature for each claim
            bytes32 messageHash = keccak256(
                abi.encodePacked(req.user, req.tokenId, req.amount, req.nonce, req.deadline)
            );
            bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
            require(_verifySignature(ethSignedMessageHash, req.signature), "Invalid signature");
            
            TokenConfig storage tokenConfig = tokens[req.tokenId];
            require(
                tokenConfig.token.balanceOf(address(this)) >= req.amount,
                "Insufficient contract balance"
            );
        }
        
        // Execute all claims after validation
        for (uint i = 0; i < claimRequests.length; i++) {
            ClaimRequest calldata req = claimRequests[i];
            TokenConfig storage tokenConfig = tokens[req.tokenId];
            
            // Calculate treasury fee
            uint256 treasuryFee = (req.amount * treasuryFeePercent) / 100;
            uint256 userAmount = req.amount - treasuryFee;
            
            // Transfer tokens
            if (treasuryFee > 0) {
                tokenConfig.token.safeTransfer(treasury, treasuryFee);
            }
            tokenConfig.token.safeTransfer(req.user, userAmount);
            
            tokenConfig.totalDistributed += req.amount;
            
            emit TokensClaimed(req.user, req.tokenId, req.amount, req.nonce);
        }
        
        // Update nonce once at the end
        userNonces[msg.sender] = currentNonce + claimRequests.length;
    }

    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @dev Configure a token for claiming
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
     * @dev Update claim signer address
     */
    function setClaimSigner(address _claimSigner) external onlyOwner {
        require(_claimSigner != address(0), "Invalid signer");
        claimSigner = _claimSigner;
        emit ClaimSignerUpdated(_claimSigner);
    }
    
    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    /**
     * @dev Set emergency operator
     */
    function setEmergencyOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator");
        emergencyOperator = _operator;
    }
    
    /**
     * @dev Owner can unpause in normal operation
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
     * @dev Get token configuration
     */
    function getTokenConfig(uint256 tokenId) 
        external 
        view 
        returns (
            address tokenAddress,
            uint256 totalDistributed,
            uint256 reserveBalance,
            bool isActive
        ) 
    {
        TokenConfig storage config = tokens[tokenId];
        return (
            address(config.token),
            config.totalDistributed,
            config.reserveBalance,
            config.isActive
        );
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
            uint256 feePercent,
            address signerAddress
        ) 
    {
        return (
            activeTokenCount,
            paused(),
            emergencyMode,
            treasury,
            treasuryFeePercent,
            claimSigner
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
     * @dev Recover signer from signature (protected against malleability)
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
        // Valid signature 's' value must be in lower half order
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "Invalid signature 's' value"
        );
        
        // Normalize v to 27 or 28
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