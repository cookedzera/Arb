import { http, createConfig } from 'wagmi'
import { arbitrum, arbitrumSepolia, base } from 'wagmi/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { coinbaseWallet, injected } from 'wagmi/connectors'

// Wallet config with Base wallet and auto-detection
export const config = createConfig({
  chains: [arbitrumSepolia, arbitrum, base], // Support testnet, mainnet, and Base
  connectors: [
    miniAppConnector(), // Farcaster wallet integration
    injected(), // Auto-detect installed browser wallets
    coinbaseWallet({
      appName: 'ArbCasino',
    }),
  ],
  transports: {
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [base.id]: http('https://mainnet.base.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}