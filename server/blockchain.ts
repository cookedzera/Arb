import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Contract ABIs - Updated for real SpinToClaimContract
const SPIN_CLAIM_ABI = [
  "function spin(uint256 tokenId) external returns (bool isWin, uint256 rewardAmount)",
  "function claimTokens(tuple(address user, uint256 tokenId, uint256 amount, uint256 nonce, uint256 deadline, bytes signature) claimRequest) external",
  "function getUserStats(address user) external view returns (tuple(uint256 lastSpinBlock, uint256 totalSpins, uint256 totalWins, uint256 totalClaimed, bool isBlacklisted) userData)",
  "function canSpin(address user, uint256 tokenId) external view returns (bool canSpinNow, string memory reason)",
  "function getTokenConfig(uint256 tokenId) external view returns (address tokenAddress, uint256 minReward, uint256 maxReward, bool isActive, uint256 totalDistributed, uint256 reserveBalance)",
  "function configureToken(uint256 tokenId, address tokenAddress, uint256 minReward, uint256 maxReward, bool isActive) external",
  "function pause() external",
  "function unpause() external",
  "function paused() external view returns (bool)",
  "function userNonces(address user) external view returns (uint256)",
  "function emergencyMode() external view returns (bool)",
  "function treasury() external view returns (address)",
  "function treasuryFeePercent() external view returns (uint256)",
  "function getContractStats() external view returns (uint256 totalActiveTokens, bool isPaused, bool inEmergencyMode, address treasuryAddress, uint256 feePercent)",
  "event SpinExecuted(address indexed user, uint256 indexed tokenId, uint256 amount, bool isWin, uint256 blockNumber)",
  "event TokensClaimed(address indexed user, uint256 indexed tokenId, uint256 amount, uint256 nonce)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function totalSupply() external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

interface ContractConfig {
  contractAddress: string;
  tokenAddresses: {
    TOKEN1: string;
    TOKEN2: string;
    TOKEN3: string;
  };
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract?: ethers.Contract;
  private config: ContractConfig;

  constructor() {
    console.log("🔧 Initializing blockchain service for Arbitrum Sepolia...");
    
    // Load configuration
    this.config = this.loadConfig();
    
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    
    // Initialize contract if address is available
    if (this.config.contractAddress) {
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        SPIN_CLAIM_ABI,
        this.provider
      );
      console.log("✅ Smart contract connected:", this.config.contractAddress);
    } else {
      console.log("⚠️  Contract address not configured - run deployment first");
    }
  }

  private loadConfig(): ContractConfig {
    const configPath = path.join(process.cwd(), "deployed-contracts.json");
    
    // Default configuration for Arbitrum Sepolia with token addresses
    const defaultConfig: ContractConfig = {
      contractAddress: process.env.SPIN_CLAIM_CONTRACT_ADDRESS || "",
      tokenAddresses: {
        TOKEN1: "0x09e18590e8f76b6cf471b3cd30676b46ef36f7cd", // AIDOGE on Arbitrum Sepolia
        TOKEN2: "0x13a7dedb7169a17be92b0c1d7faf17c7b3", // BOOP on Arbitrum Sepolia
        TOKEN3: "0x980b62da83eff3d4576c647993b0c1d7faf17c73" // ARB on Arbitrum Sepolia
      },
      chainId: 421614,
      rpcUrl: "https://421614.rpc.thirdweb.com",
      explorerUrl: "https://sepolia.arbiscan.io"
    };

    try {
      if (fs.existsSync(configPath)) {
        const deploymentData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Map deployment data to config format
        if (deploymentData.contractAddress) {
          defaultConfig.contractAddress = deploymentData.contractAddress;
          console.log("📄 Loaded contract address from deployment:", deploymentData.contractAddress);
        }
        
        if (deploymentData.chainId) {
          defaultConfig.chainId = deploymentData.chainId;
        }
        
        if (deploymentData.rpcUsed) {
          defaultConfig.rpcUrl = deploymentData.rpcUsed;
        }
      }
    } catch (error) {
      console.log("⚠️  Using default configuration:", error);
    }
    
    return defaultConfig;
  }

  // Configuration methods for frontend compatibility
  async getContractAddress(): Promise<string> {
    return this.config.contractAddress;
  }

  // Get user's current nonce from contract
  async getUserNonce(userAddress: string): Promise<number> {
    if (!this.contract) {
      return 0;
    }

    try {
      const nonce = await this.contract.userNonces(userAddress);
      return parseInt(nonce.toString());
    } catch (error) {
      console.error("Error getting user nonce:", error);
      return 0;
    }
  }

  async getTokenAddresses(): Promise<{ [key: string]: string }> {
    return this.config.tokenAddresses;
  }

  async getChainId(): Promise<number> {
    return this.config.chainId;
  }

  // Smart contract interaction methods
  async canUserSpin(userAddress: string, tokenId: number): Promise<{ canSpin: boolean; reason: string }> {
    if (!this.contract) {
      return { canSpin: false, reason: "Contract not configured" };
    }

    try {
      const [canSpin, reason] = await this.contract.canSpin(userAddress, tokenId);
      return { canSpin, reason };
    } catch (error) {
      console.error("Error checking spin eligibility:", error);
      return { canSpin: false, reason: "Contract error" };
    }
  }

  async getUserStats(userAddress: string) {
    if (!this.contract) {
      return null;
    }

    try {
      const userData = await this.contract.getUserStats(userAddress);
      
      return {
        lastSpinBlock: userData.lastSpinBlock.toString(),
        totalSpins: userData.totalSpins.toString(),
        totalWins: userData.totalWins.toString(),
        totalClaimed: userData.totalClaimed.toString(),
        isBlacklisted: userData.isBlacklisted
      };
    } catch (error) {
      console.error("Error getting user stats:", error);
      return null;
    }
  }

  async getTokenConfig(tokenId: number) {
    if (!this.contract) {
      return null;
    }

    try {
      const [tokenAddress, minReward, maxReward, isActive, totalDistributed, reserveBalance] = 
        await this.contract.getTokenConfig(tokenId);
      
      return {
        tokenAddress,
        minReward: minReward.toString(),
        maxReward: maxReward.toString(),
        isActive,
        totalDistributed: totalDistributed.toString(),
        reserveBalance: reserveBalance.toString()
      };
    } catch (error) {
      console.error("Error getting token config:", error);
      return null;
    }
  }

  async getTokenInfo(tokenAddress: string) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      return {
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString(),
        address: tokenAddress
      };
    } catch (error) {
      console.error("Error getting token info:", error);
      return null;
    }
  }

  // Generate claim signature (server-side signing)
  async generateClaimSignature(
    userAddress: string,
    tokenId: number,
    amount: string,
    nonce: number,
    deadline: number,
    privateKey: string
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);
    
    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [userAddress, tokenId, amount, nonce, deadline, this.config.contractAddress]
      )
    );
    
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    return signature;
  }

  // Check contract status
  async isContractPaused(): Promise<boolean> {
    if (!this.contract) {
      return true; // Assume paused if not connected
    }

    try {
      return await this.contract.paused();
    } catch (error) {
      console.error("Error checking pause status:", error);
      return true;
    }
  }

  // Update contract configuration
  async updateConfig(newConfig: Partial<ContractConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.contractAddress) {
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        SPIN_CLAIM_ABI,
        this.provider
      );
    }

    // Save updated config
    const configPath = path.join(process.cwd(), "deployed-contracts.json");
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    
    console.log("✅ Contract configuration updated:", this.config);
  }

  // Get network info
  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      return {
        chainId: Number(network.chainId),
        blockNumber,
        name: network.name,
        rpcUrl: this.config.rpcUrl
      };
    } catch (error) {
      console.error("Error getting network info:", error);
      return null;
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();