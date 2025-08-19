// Client-side configuration - will be updated from API
let dynamicConfig = {
  contractAddress: '' as `0x${string}`,
  tokenAddresses: {
    TOKEN1: '' as `0x${string}`,
    TOKEN2: '' as `0x${string}`,
    TOKEN3: '' as `0x${string}`,
  },
  chainId: 421614
}

// Mutable configuration object
export const CONTRACT_CONFIG = {
  // Will be updated dynamically from API config endpoint
  WHEEL_GAME_ADDRESS: '' as `0x${string}`,
  
  // Token addresses will be configured when contracts are deployed
  TOKEN_ADDRESSES: {
    TOKEN1: "" as `0x${string}`,
    TOKEN2: "" as `0x${string}`,
    TOKEN3: "" as `0x${string}`,
  },
  
  // Network configuration
  CHAIN_ID: 421614, // Arbitrum Sepolia
}

// Function to fetch and update configuration from API
export async function updateConfig() {
  try {
    const response = await fetch('/api/config')
    if (response.ok) {
      const config = await response.json()
      dynamicConfig = config
      // Update the contract config dynamically
      CONTRACT_CONFIG.WHEEL_GAME_ADDRESS = config.contractAddress || ''
      CONTRACT_CONFIG.TOKEN_ADDRESSES.TOKEN1 = config.tokenAddresses.TOKEN1 || ''
      CONTRACT_CONFIG.TOKEN_ADDRESSES.TOKEN2 = config.tokenAddresses.TOKEN2 || ''
      CONTRACT_CONFIG.TOKEN_ADDRESSES.TOKEN3 = config.tokenAddresses.TOKEN3 || ''
      console.log('✅ Contract configuration updated from API:', config)
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch config from API, using fallback')
  }
}

// Function to check if contract is properly configured
export function isContractConfigured(): boolean {
  return CONTRACT_CONFIG.WHEEL_GAME_ADDRESS !== '' && CONTRACT_CONFIG.WHEEL_GAME_ADDRESS !== ('0x' as `0x${string}`)
}