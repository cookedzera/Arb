// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MinimalAutoTransferContract
 * @dev Ultra-minimal contract for token transfers after spins
 */
contract MinimalAutoTransferContract is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========== STORAGE ==========
    address public server;
    address public treasury;
    uint256 public treasuryFee = 5; // 5%
    
    mapping(uint256 => IERC20) public tokens; // tokenId => token contract
    mapping(uint256 => bool) public tokenActive; // tokenId => active status
    mapping(address => mapping(uint256 => uint256)) public userTransferred; // user => tokenId => amount
    mapping(address => uint256) public lastTransfer; // user => timestamp
    
    uint256 public constant COOLDOWN = 30 seconds;
    uint256 public constant MAX_AMOUNT = 10 ether;

    // ========== EVENTS ==========
    event Transfer(address indexed user, uint256 indexed tokenId, uint256 amount);
    event TokenSet(uint256 indexed tokenId, address token, bool active);

    // ========== MODIFIERS ==========
    modifier onlyServer() {
        require(msg.sender == server, "Not server");
        _;
    }
    
    modifier validToken(uint256 tokenId) {
        require(tokenId < 3 && tokenActive[tokenId], "Invalid token");
        _;
    }
    
    modifier cooldown(address user) {
        require(block.timestamp >= lastTransfer[user] + COOLDOWN, "Cooldown");
        _;
    }

    // ========== CONSTRUCTOR ==========
    constructor(address _server, address _treasury) Ownable(msg.sender) {
        server = _server;
        treasury = _treasury;
        _pause(); // Start paused for safety
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
        onlyServer
        validToken(tokenId)
        cooldown(user)
    {
        require(user != address(0), "Zero address");
        require(amount > 0 && amount <= MAX_AMOUNT, "Invalid amount");
        
        IERC20 token = tokens[tokenId];
        require(token.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        // Calculate amounts
        uint256 fee = (amount * treasuryFee) / 100;
        uint256 userAmount = amount - fee;
        
        // Update state
        userTransferred[user][tokenId] += amount;
        lastTransfer[user] = block.timestamp;
        
        // Transfer tokens
        if (fee > 0) {
            token.safeTransfer(treasury, fee);
        }
        token.safeTransfer(user, userAmount);
        
        emit Transfer(user, tokenId, amount);
    }

    // ========== ADMIN FUNCTIONS ==========
    function setToken(uint256 tokenId, address tokenAddress, bool active) 
        external 
        onlyOwner 
    {
        require(tokenId < 3, "Invalid ID");
        require(tokenAddress != address(0), "Zero address");
        
        tokens[tokenId] = IERC20(tokenAddress);
        tokenActive[tokenId] = active;
        
        emit TokenSet(tokenId, tokenAddress, active);
    }
    
    function setServer(address newServer) external onlyOwner {
        require(newServer != address(0), "Zero address");
        server = newServer;
    }
    
    function setTreasury(address newTreasury, uint256 newFee) external onlyOwner {
        require(newTreasury != address(0), "Zero address");
        require(newFee <= 20, "Fee too high");
        treasury = newTreasury;
        treasuryFee = newFee;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========== VIEW FUNCTIONS ==========
    function getUserTotal(address user, uint256 tokenId) external view returns (uint256) {
        return userTransferred[user][tokenId];
    }
    
    function getTokenInfo(uint256 tokenId) external view returns (address, bool) {
        return (address(tokens[tokenId]), tokenActive[tokenId]);
    }

    // ========== EMERGENCY ==========
    function emergencyWithdraw(address token) external onlyOwner {
        require(paused(), "Not paused");
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(owner(), balance);
    }
}