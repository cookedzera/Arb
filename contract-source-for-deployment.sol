
pragma solidity ^0.8.0;

contract SpinClaimV1 {
    address public owner;
    address public claimSigner; 
    bool public paused = true;
    uint256 public totalClaims = 0;
    
    mapping(address => uint256) public userClaims;
    
    event ContractDeployed(address owner, address claimSigner);
    event ClaimProcessed(address user, uint256 amount);
    event PausedChanged(bool isPaused);
    
    constructor(address _claimSigner) {
        owner = msg.sender;
        claimSigner = _claimSigner;
        emit ContractDeployed(owner, _claimSigner);
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedChanged(_paused);
    }
    
    function updateClaimSigner(address _signer) external onlyOwner {
        claimSigner = _signer;
    }
    
    function simulateClaim(address user, uint256 amount) external onlyOwner {
        require(!paused, "Contract paused");
        userClaims[user] += amount;
        totalClaims += amount;
        emit ClaimProcessed(user, amount);
    }
    
    function getClaimBalance(address user) external view returns (uint256) {
        return userClaims[user];
    }
    
    function getContractInfo() external view returns (address, address, bool, uint256) {
        return (owner, claimSigner, paused, totalClaims);
    }
}