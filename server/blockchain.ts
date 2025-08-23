import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Contract ABIs - Auto-Transfer Contract (server handles spinning + transfers)
const AUTO_TRANSFER_ABI = [
  // Main function
  "function autoTransfer(address user, uint256 tokenId, uint256 amount) external",
  
  // Admin functions
  "function setTokens(uint256 tokenId, address token, bool active) external",
  "function pause() external",
  "function unpause() external",
  "function paused() external view returns (bool)",
  
  // View functions
  "function tokens(uint256) external view returns (address)",
  "function tokenActive(uint256) external view returns (bool)",
  "function server() external view returns (address)",
  "function treasury() external view returns (address)",
  
  // Events
  "event Transfer(address indexed user, uint256 indexed tokenId, uint256 amount)",
  "event TokenSet(uint256 indexed tokenId, address token, bool active)"
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
        AUTO_TRANSFER_ABI,
        this.provider
      );
      console.log("✅ Auto-Transfer contract connected:", this.config.contractAddress);
    } else {
      console.log("⚠️  Contract address not configured - run deployment first");
    }
  }

  private loadConfig(): ContractConfig {
    // Try loading from auto-transfer deployment first
    const autoTransferPath = path.join(process.cwd(), "auto-transfer-deployment.json");
    const fallbackPath = path.join(process.cwd(), "deployed-contracts.json");
    
    // Default configuration for Arbitrum Sepolia with token addresses
    const defaultConfig: ContractConfig = {
      contractAddress: process.env.SPIN_AUTO_TRANSFER_CONTRACT_ADDRESS || process.env.SPIN_CLAIM_CONTRACT_ADDRESS || "",
      tokenAddresses: {
        TOKEN1: "0x287396E90c5febB4dC1EDbc0EEF8e5668cdb08D4", // User deployed test token
        TOKEN2: "0xaeA5bb4F5b5524dee0E3F931911c8F8df4576E19", // BOOP Test on Arbitrum Sepolia
        TOKEN3: "0x0E1CD6557D2BA59C61c75850E674C2AD73253952" // BOBOTRUM Test on Arbitrum Sepolia
      },
      chainId: 421614,
      rpcUrl: "https://421614.rpc.thirdweb.com",
      explorerUrl: "https://sepolia.arbiscan.io"
    };

    try {
      // First try to load auto-transfer deployment
      if (fs.existsSync(autoTransferPath)) {
        const deploymentData = JSON.parse(fs.readFileSync(autoTransferPath, 'utf8'));
        
        if (deploymentData.contractAddress) {
          defaultConfig.contractAddress = deploymentData.contractAddress;
          console.log("📄 Loaded AUTO-TRANSFER contract address:", deploymentData.contractAddress);
        }
        
        if (deploymentData.chainId) {
          defaultConfig.chainId = deploymentData.chainId;
        }
      }
      // Fallback to old deployment file
      else if (fs.existsSync(fallbackPath)) {
        const deploymentData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        
        if (deploymentData.contractAddress) {
          defaultConfig.contractAddress = deploymentData.contractAddress;
          console.log("📄 Loaded contract address from fallback deployment:", deploymentData.contractAddress);
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

  // Auto-transfer tokens to user after server spin (MAIN FUNCTION)
  async autoTransferTokens(
    userAddress: string, 
    tokenType: string, 
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract) {
      return { success: false, error: "Contract not initialized" };
    }

    try {
      console.log(`🚀 Initiating auto-transfer: ${amount} ${tokenType} to ${userAddress}`);
      
      // Map token type to ID
      const tokenId = this.getTokenId(tokenType);
      if (tokenId === -1) {
        return { success: false, error: `Invalid token type: ${tokenType}` };
      }
      
      // Get server wallet with private key
      const serverWallet = this.getServerWallet();
      if (!serverWallet) {
        return { success: false, error: "Server wallet not configured" };
      }
      
      // Connect contract with server wallet
      const contractWithSigner = this.contract.connect(serverWallet);
      
      // Check if user can receive transfer
      const canTransfer = await this.canUserReceiveTransfer(userAddress);
      if (!canTransfer) {
        return { success: false, error: "User rate limited or contract paused" };
      }
      
      // Execute auto-transfer with proper address checksum
      const checksummedAddress = ethers.getAddress(userAddress);
      console.log(`📡 Calling autoTransfer(${checksummedAddress}, ${tokenId}, ${amount})`);
      
      const tx = await contractWithSigner.autoTransfer(
        checksummedAddress,
        tokenId,
        amount
      );
      
      console.log("⏳ Transaction submitted:", tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log("✅ Auto-transfer successful:", tx.hash);
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: "Transaction failed" };
      }
      
    } catch (error: any) {
      console.error("❌ Auto-transfer failed:", error);
      
      // Parse error message for user-friendly response
      let errorMessage = "Auto-transfer failed";
      
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message) {
        if (error.message.includes("daily limit")) {
          errorMessage = "Daily transfer limit reached";
        } else if (error.message.includes("rate limit")) {
          errorMessage = "Transfer too frequent, please wait";
        } else if (error.message.includes("paused")) {
          errorMessage = "Contract is paused for maintenance";
        } else if (error.message.includes("insufficient")) {
          errorMessage = "Insufficient contract balance";
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Batch auto-transfer for multiple users (gas optimization)
  async batchAutoTransfer(
    transfers: Array<{ userAddress: string; tokenType: string; amount: string }>
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract) {
      return { success: false, error: "Contract not initialized" };
    }

    try {
      console.log(`🚀 Initiating batch auto-transfer for ${transfers.length} users`);
      
      const users: string[] = [];
      const tokenIds: number[] = [];
      const amounts: string[] = [];
      
      // Prepare batch data
      for (const transfer of transfers) {
        const tokenId = this.getTokenId(transfer.tokenType);
        if (tokenId === -1) {
          return { success: false, error: `Invalid token type: ${transfer.tokenType}` };
        }
        
        users.push(transfer.userAddress);
        tokenIds.push(tokenId);
        amounts.push(transfer.amount);
      }
      
      // Get server wallet with private key
      const serverWallet = this.getServerWallet();
      if (!serverWallet) {
        return { success: false, error: "Server wallet not configured" };
      }
      
      // Connect contract with server wallet
      const contractWithSigner = this.contract.connect(serverWallet);
      
      // Execute batch auto-transfer
      console.log("📡 Calling batchAutoTransfer...");
      
      const tx = await contractWithSigner.batchAutoTransfer(
        users,
        tokenIds,
        amounts
      );
      
      console.log("⏳ Batch transaction submitted:", tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log("✅ Batch auto-transfer successful:", tx.hash);
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: "Batch transaction failed" };
      }
      
    } catch (error: any) {
      console.error("❌ Batch auto-transfer failed:", error);
      return { success: false, error: error.reason || error.message || "Batch transfer failed" };
    }
  }

  // Helper: Get server wallet from private key
  private getServerWallet(): ethers.Wallet | null {
    const privateKey = process.env.PRIVATE_KEY || process.env.CLAIM_SIGNER_PRIVATE_KEY;
    
    if (!privateKey) {
      console.error("❌ Server private key not configured");
      return null;
    }
    
    try {
      return new ethers.Wallet(privateKey, this.provider);
    } catch (error) {
      console.error("❌ Invalid server private key:", error);
      return null;
    }
  }

  // Helper: Map token type to contract ID
  private getTokenId(tokenType: string): number {
    const tokenMap: { [key: string]: number } = {
      'TOKEN1': 0,  // AIDOGE
      'TOKEN2': 1,  // BOOP
      'TOKEN3': 2,  // BOBOTRUM
      'AIDOGE': 0,
      'BOOP': 1,
      'BOBOTRUM': 2,
      'ARB': 2      // Alias for BOBOTRUM
    };
    
    return tokenMap[tokenType.toUpperCase()] ?? -1;
  }

  // Helper: Check if user can receive transfer - simplified for minimal contract
  async canUserReceiveTransfer(userAddress: string): Promise<boolean> {
    // Minimal contract doesn't have transfer stats, so always allow
    // In production, add proper rate limiting here
    return true;
  }

  // Get user's current nonce from contract (legacy method for compatibility)
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

  // getUserStats removed - ClaimOnlyContract doesn't track spin stats

  async getTokenConfig(tokenId: number) {
    if (!this.contract) {
      return null;
    }

    try {
      const [tokenAddress, totalDistributed, reserveBalance, isActive] = 
        await this.contract.getTokenConfig(tokenId);
      
      return {
        tokenAddress,
        totalDistributed: totalDistributed.toString(),
        reserveBalance: reserveBalance.toString(),
        isActive
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

  // Check actual ERC20 token balance of the contract
  async getContractTokenBalance(tokenAddress: string): Promise<string> {
    try {
      console.log(`🔍 Checking balance for token ${tokenAddress} in contract ${this.config.contractAddress}`);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await tokenContract.balanceOf(this.config.contractAddress);
      const balanceString = balance.toString();
      console.log(`💰 Token ${tokenAddress} balance: ${balanceString}`);
      return balanceString;
    } catch (error) {
      console.error(`❌ Error getting balance for token ${tokenAddress}:`, error);
      return "0";
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
    
    // Match the contract's signature format exactly
    // Contract uses: abi.encodePacked(user, tokenId, amount, nonce, deadline)
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
      [userAddress, tokenId, amount, nonce, deadline]
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
        CLAIM_ONLY_ABI,
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