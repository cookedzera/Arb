import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Contract ABIs - Auto-Transfer Contract (server handles spinning + transfers)
const AUTO_TRANSFER_ABI = [
  // Main function
  "function autoTransfer(address user, uint256 tokenId, uint256 amount) external",
  "function batchAutoTransfer(address[] calldata users, uint256[] calldata tokenIds, uint256[] calldata amounts) external",
  
  // Admin functions
  "function setTokens(uint256 tokenId, address token, bool active) external",
  "function setRateLimiting(uint256 newCooldownPeriod) external",
  "function setTreasury(address newTreasury, uint256 newFeePercent) external",
  "function pause() external",
  "function unpause() external",
  "function paused() external view returns (bool)",
  
  // View functions
  "function tokens(uint256) external view returns (address)",
  "function tokenActive(uint256) external view returns (bool)",
  "function server() external view returns (address)",
  "function treasury() external view returns (address)",
  "function treasuryFeePercent() external view returns (uint256)",
  "function cooldownPeriod() external view returns (uint256)",
  
  // Events
  "event Transfer(address indexed user, uint256 indexed tokenId, uint256 amount)",
  "event TokenSet(uint256 indexed tokenId, address token, bool active)",
  "event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, uint256 indexed feePercent)"
];

const CLAIM_ONLY_ABI = [
  "function claimTokens(tuple(address user, uint256 tokenId, uint256 amount, uint256 nonce, uint256 deadline, bytes signature) claimRequest) external",
  "function paused() external view returns (bool)",
  "function getTokenConfig(uint256 tokenId) external view returns (address tokenAddress, uint256 totalDistributed, uint256 reserveBalance, bool isActive)"
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

    // Retry logic for RPC rate limiting
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🚀 Initiating auto-transfer (attempt ${attempt}/3): ${amount} ${tokenType} to ${userAddress}`);
        
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
        
        // Check if user can receive transfer (skip for instant transfers)
        // const canTransfer = await this.canUserReceiveTransfer(userAddress);
        // Always allow transfers now since cooldown is disabled
        
        // Execute auto-transfer with proper address checksum and transaction description
        const checksummedAddress = ethers.getAddress(userAddress);
        
        // Get token symbol for transaction description
        const tokenSymbols = ['AIDOGE', 'BOOP', 'BOBOTRUM'];
        const tokenSymbol = tokenSymbols[tokenId] || 'TOKEN';
        const formattedAmount = (parseFloat(amount) / 1e18).toFixed(1);
        
        console.log(`📡 Calling autoTransfer for Spin Reward: ${formattedAmount} ${tokenSymbol} to ${checksummedAddress}`);
        
        // Create transaction with descriptive data for Arbiscan
        const txOptions = {
          gasLimit: 300000, // Increase gas limit for complex transfers
          // Add a descriptive note that will appear on Arbiscan in the transaction data
        };
        
        const tx = await (contractWithSigner as any).autoTransfer(
          checksummedAddress,
          tokenId,
          amount,
          txOptions
        );
        
        console.log(`⏳ Spin Reward transaction submitted: ${tx.hash} - ${formattedAmount} ${tokenSymbol}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          console.log(`✅ Spin Reward transfer successful: ${tx.hash} - ${formattedAmount} ${tokenSymbol} to ${checksummedAddress}`);
          return { success: true, txHash: tx.hash };
        } else {
          return { success: false, error: "Spin reward transfer failed" };
        }
        
      } catch (error: any) {
        // Check if it's an RPC rate limit error
        if (error.message && error.message.includes("rate limit") && attempt < 3) {
          console.log(`⏱️ RPC rate limit hit, retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        
        // If it's the last attempt or not a rate limit error, handle normally
        console.error(`❌ Auto-transfer failed (attempt ${attempt}/3):`, error);
        
        // Parse error message for user-friendly response
        let errorMessage = "Auto-transfer failed";
        
        if (error.reason) {
          errorMessage = error.reason;
          // Handle cooldown specifically (though it should be disabled now)
          if (error.reason === "Cooldown") {
            console.log("⏱️ Auto-transfer failed: Cooldown (this should not happen!)");
            return { success: false, error: "Cooldown" };
          }
        } else if (error.message) {
          if (error.message.includes("Cooldown")) {
            console.log("⏱️ Auto-transfer failed: Cooldown (this should not happen!)");
            return { success: false, error: "Cooldown" };
          } else if (error.message.includes("daily limit")) {
            errorMessage = "Daily transfer limit reached";
          } else if (error.message.includes("rate limit")) {
            errorMessage = "RPC provider is overloaded, transfer will accumulate for later claim";
          } else if (error.message.includes("paused")) {
            errorMessage = "Contract is paused for maintenance";
          } else if (error.message.includes("insufficient")) {
            errorMessage = "Insufficient contract balance";
          }
        }
        
        return { success: false, error: errorMessage };
      }
    }
    
    // Should never reach here, but TypeScript wants a return
    return { success: false, error: "All retry attempts failed" };
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
      
      // Execute batch auto-transfer for multiple spin rewards
      console.log("📡 Calling batchAutoTransfer for multiple spin rewards...");
      
      const tx = await (contractWithSigner as any).batchAutoTransfer(
        users,
        tokenIds,
        amounts,
        {
          gasLimit: 500000, // Higher gas limit for batch operations
        }
      );
      
      console.log(`⏳ Batch Spin Rewards transaction submitted: ${tx.hash} - ${transfers.length} winners`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Batch Spin Rewards successful: ${tx.hash} - ${transfers.length} players received tokens`);
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: "Batch spin rewards failed" };
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

  // Remove or reduce cooldown for gaming experience
  async setCooldownPeriod(seconds: number): Promise<{ success: boolean; error?: string }> {
    if (!this.contract) {
      return { success: false, error: "Contract not initialized" };
    }

    try {
      console.log(`🎮 Setting cooldown period to ${seconds} seconds for better gaming experience...`);
      
      const serverWallet = this.getServerWallet();
      if (!serverWallet) {
        return { success: false, error: "Server wallet not configured" };
      }
      
      const contractWithSigner = this.contract.connect(serverWallet);
      const tx = await (contractWithSigner as any).setRateLimiting(seconds);
      
      console.log("⏳ Cooldown update transaction submitted:", tx.hash);
      await tx.wait();
      
      console.log(`✅ Cooldown period updated to ${seconds} seconds!`);
      return { success: true };
      
    } catch (error: any) {
      console.error("❌ Failed to update cooldown:", error);
      return { success: false, error: error.message };
    }
  }

  // Get current cooldown period
  async getCooldownPeriod(): Promise<number> {
    if (!this.contract) {
      return 0;
    }

    try {
      const cooldown = await this.contract.cooldownPeriod();
      return Number(cooldown);
    } catch (error) {
      console.error("Error getting cooldown period:", error);
      return 0;
    }
  }

  // Remove treasury fees - set to 0% so users get 100% of rewards
  async removeTreasuryFees(): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.contract) {
      return { success: false, error: "Contract not initialized" };
    }

    try {
      // Get server wallet with treasury role
      const serverWallet = this.getServerWallet();
      if (!serverWallet) {
        return { success: false, error: "Server wallet not configured" };
      }

      // Connect contract with server wallet (should have TREASURY_ROLE)
      const contractWithSigner = this.contract.connect(serverWallet);
      
      // Get current treasury address
      const currentTreasury = await this.contract.treasury();
      console.log(`📋 Current treasury: ${currentTreasury}`);
      
      // Set treasury fee to 0% (users get 100% of rewards!)
      console.log("🎯 Setting treasury fee to 0% - users get 100% of rewards!");
      const tx = await (contractWithSigner as any).setTreasury(currentTreasury, 0);
      
      console.log("⏳ Transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log("✅ Treasury fee removed! Users now get 100% of rewards!");
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: "Transaction failed" };
      }
      
    } catch (error: any) {
      console.error("❌ Failed to remove treasury fees:", error);
      return { success: false, error: error.message || "Failed to update treasury" };
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