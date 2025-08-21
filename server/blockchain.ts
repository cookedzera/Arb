import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Contract ABIs
const SPIN_CLAIM_ABI = [
  "function spin(uint256 tokenId) external returns (bool isWin, uint256 rewardAmount)",
  "function claimTokens(tuple(address user, uint256 tokenId, uint256 amount, uint256 nonce, uint256 deadline, bytes signature) claimRequest) external",
  "function getUserStats(address user) external view returns (uint256 totalSpins, uint256 totalWins, uint256 totalClaimed, uint256 lastSpinBlock, bool isBlacklisted, uint256 dailySpinsToday)",
  "function canSpin(address user, uint256 tokenId) external view returns (bool canSpinNow, string memory reason)",
  "function getTokenConfig(uint256 tokenId) external view returns (address tokenAddress, uint256 minReward, uint256 maxReward, bool isActive, uint256 totalDistributed, uint256 contractBalance)",
  "function configureToken(uint256 tokenId, address tokenAddress, uint256 minReward, uint256 maxReward, bool isActive) external",
  "function pause() external",
  "function unpause() external",
  "function paused() external view returns (bool)",
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
    
    // Default configuration for Arbitrum Sepolia
    const defaultConfig: ContractConfig = {
      contractAddress: process.env.SPIN_CLAIM_CONTRACT_ADDRESS || "",
      tokenAddresses: {
        TOKEN1: process.env.TOKEN1_ADDRESS || "",
        TOKEN2: process.env.TOKEN2_ADDRESS || "",
        TOKEN3: process.env.TOKEN3_ADDRESS || ""
      },
      chainId: 421614,
      rpcUrl: "https://421614.rpc.thirdweb.com",
      explorerUrl: "https://sepolia.arbiscan.io"
    };

    try {
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...fileConfig };
      }
    } catch (error) {
      console.log("Using default configuration");
    }
    
    return defaultConfig;
  }

  // Configuration methods for frontend compatibility
  async getContractAddress(): Promise<string> {
    return this.config.contractAddress;
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
      const [totalSpins, totalWins, totalClaimed, lastSpinBlock, isBlacklisted, dailySpinsToday] = 
        await this.contract.getUserStats(userAddress);
      
      return {
        totalSpins: totalSpins.toString(),
        totalWins: totalWins.toString(),
        totalClaimed: totalClaimed.toString(),
        lastSpinBlock: lastSpinBlock.toString(),
        isBlacklisted,
        dailySpinsToday: dailySpinsToday.toString()
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
      const [tokenAddress, minReward, maxReward, isActive, totalDistributed, contractBalance] = 
        await this.contract.getTokenConfig(tokenId);
      
      return {
        tokenAddress,
        minReward: minReward.toString(),
        maxReward: maxReward.toString(),
        isActive,
        totalDistributed: totalDistributed.toString(),
        contractBalance: contractBalance.toString()
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