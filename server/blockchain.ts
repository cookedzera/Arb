// Simple blockchain service for configuration endpoints
export class BlockchainService {
  constructor() {
    console.log("🔧 Blockchain service ready for server-based gaming");
  }

  // Configuration methods for frontend compatibility
  async getContractAddress(): Promise<string> {
    return ""; // Server-based, no contract needed
  }

  async getTokenAddresses(): Promise<{ [key: string]: string }> {
    return {
      TOKEN1: "",
      TOKEN2: "",
      TOKEN3: ""
    }; // Server-based, no tokens needed
  }

  async getChainId(): Promise<number> {
    return 421614; // Arbitrum Sepolia for wallet connections
  }
}

export const blockchainService = new BlockchainService();