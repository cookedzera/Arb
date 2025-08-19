import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Wallet, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFarcaster } from '@/hooks/use-farcaster'
import { arbitrumSepolia } from 'wagmi/chains'

export function WalletConnectCompact() {
  const { isConnected, address, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { displayName, username, avatarUrl, isAuthenticated } = useFarcaster()
  const [showDetails, setShowDetails] = useState(false)
  const [showWallets, setShowWallets] = useState(false)
  const [showExternalWallets, setShowExternalWallets] = useState(false)

  const handleConnect = async (connector: any) => {
    try {
      // Add error handling for MetaMask detection
      if (connector.id === 'injected' && typeof window?.ethereum === 'undefined') {
        alert('Please install MetaMask to connect with this wallet option.')
        return
      }
      await connect({ connector })
      setShowWallets(false)
      
      // Network switching will be handled by the network prompt modal
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      // Show user-friendly error message
      alert('Failed to connect wallet. Please try again or use a different wallet.')
    }
  }

  const handleExternalClick = () => {
    setShowExternalWallets(!showExternalWallets)
  }

  const handleDisconnect = () => {
    disconnect()
    setShowDetails(false)
  }

  // Show network switch button if connected but not on Arbitrum
  const needsNetworkSwitch = isConnected && chain?.id !== arbitrumSepolia.id

  if (isConnected) {
    return (
      <div className="relative">
        {/* Network switch prompt */}
        {needsNetworkSwitch && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mx-4 max-w-sm text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Switch to Arbitrum</h3>
              <p className="text-white/60 text-sm mb-4">
                This app works best on Arbitrum Sepolia. Switch networks for the optimal gaming experience.
              </p>
              <div className="flex space-x-3">
                <Button
                  onClick={async () => {
                    try {
                      await switchChain({ chainId: arbitrumSepolia.id })
                    } catch (error) {
                      console.log('Network switch cancelled or failed:', error)
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Switch Network
                </Button>
                <Button
                  onClick={() => {/* User can dismiss for now */}}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300"
                >
                  Later
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Compact connected state */}
        <motion.button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center space-x-2 px-3 py-2 rounded-xl text-white/80 hover:text-white transition-all duration-200"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          data-testid="wallet-connected-button"
        >
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Profile" 
              className="w-6 h-6 rounded-full border border-purple-400/30"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
          )}
          <div className="flex flex-col items-start">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-medium text-white truncate max-w-20">
                {displayName || 'Wallet'}
              </span>
              {chain?.id === arbitrumSepolia.id ? (
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
              ) : (
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
              )}
            </div>
            <span className="text-xs text-white/50 truncate max-w-24">
              {address?.slice(0, 4)}...{address?.slice(-2)}
            </span>
          </div>
        </motion.button>

        {/* Dropdown details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full right-0 mt-2 w-64 p-4 rounded-2xl text-white z-50"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
              }}
              data-testid="wallet-details-dropdown"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Wallet Connected</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-white/60 hover:text-white p-1"
                  data-testid="close-wallet-details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center space-x-3 mb-3">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full border border-purple-400/30"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {displayName || 'Wallet User'}
                  </p>
                  {username && username !== displayName && (
                    <p className="text-xs text-white/60 truncate">@{username}</p>
                  )}
                  <p className="text-xs text-white/50 truncate">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                </div>
              </div>
              
              {/* Network Information */}
              <div className="mb-4 p-3 rounded-xl" style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">Network</span>
                  {chain?.id === arbitrumSepolia.id ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-green-400">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="text-xs text-yellow-400">Wrong Network</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {chain?.name || 'Unknown Network'}
                  </span>
                  {chain?.id !== arbitrumSepolia.id && (
                    <button
                      onClick={async () => {
                        try {
                          await switchChain({ chainId: arbitrumSepolia.id })
                        } catch (error) {
                          console.log('User rejected network switch:', error)
                        }
                      }}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                    >
                      Switch to Arbitrum
                    </button>
                  )}
                </div>
                {chain?.id === arbitrumSepolia.id && (
                  <p className="text-xs text-white/40 mt-1">
                    Perfect for fast, low-cost transactions
                  </p>
                )}
              </div>
              
              <Button 
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
                className="w-full border-red-400/30 text-red-400 hover:bg-red-500/10 text-xs"
                data-testid="disconnect-wallet-button"
              >
                Disconnect
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Compact connect button with wallet options
  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowWallets(!showWallets)}
        disabled={isPending}
        className="flex items-center space-x-2 px-3 py-2 rounded-xl text-white/80 hover:text-white disabled:opacity-50 transition-all duration-200"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="connect-wallet-button"
      >
        <Wallet className="w-4 h-4" />
        <span className="text-xs font-medium">
          {isPending ? 'Connecting...' : 'Connect'}
        </span>
      </motion.button>

      {/* Wallet options dropdown */}
      <AnimatePresence>
        {showWallets && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-56 p-3 rounded-2xl text-white z-50"
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
            }}
            data-testid="wallet-options-dropdown"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Choose Wallet</h3>
              <button
                onClick={() => setShowWallets(false)}
                className="text-white/60 hover:text-white p-1"
                data-testid="close-wallet-options"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {/* Farcaster - Primary Option (First connector is Mini App based on wagmi config) */}
              {connectors.length > 0 && connectors[0].id && connectors
                .filter((connector, index) => index === 0) // First connector is miniAppConnector() from config
                .map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => handleConnect(connector)}
                    disabled={isPending}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-white/10 disabled:opacity-50 transition-all duration-200 group"
                    data-testid={`wallet-option-${connector.id}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">Farcaster Wallet</div>
                      <div className="text-xs text-white/60">Fast & secure on Arbitrum</div>
                    </div>
                  </button>
                ))
              }

              {/* External Wallets - Secondary Option */}
              <button
                onClick={handleExternalClick}
                className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-white/10 transition-all duration-200 group"
                data-testid="external-wallets-toggle"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">External</div>
                  <div className="text-xs text-white/60">MetaMask, Coinbase & more</div>
                </div>
                <ChevronRight 
                  className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                    showExternalWallets ? 'rotate-90' : ''
                  }`} 
                />
              </button>

              {/* External Wallet Options - Expanded */}
              <AnimatePresence>
                {showExternalWallets && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-11 space-y-2 overflow-hidden"
                  >
                    {/* Auto-detected browser wallets */}
                    {connectors
                      .filter(connector => connector.id === 'injected')
                      .map((connector) => (
                        <button
                          key={connector.id}
                          onClick={() => handleConnect(connector)}
                          disabled={isPending}
                          className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-white/10 disabled:opacity-50 transition-all duration-200 group"
                          data-testid={`wallet-option-${connector.id}`}
                        >
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Wallet className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">Injected</div>
                            <div className="text-xs text-white/60">Browser Wallet</div>
                          </div>
                        </button>
                      ))
                    }
                    
                    {/* Coinbase Wallet (Base) */}
                    {connectors
                      .filter(connector => connector.id === 'coinbaseWalletSDK')
                      .map((connector) => (
                        <button
                          key={connector.id}
                          onClick={() => handleConnect(connector)}
                          disabled={isPending}
                          className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-white/10 disabled:opacity-50 transition-all duration-200 group"
                          data-testid={`wallet-option-${connector.id}`}
                        >
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">Coinbase Wallet</div>
                            <div className="text-xs text-white/60">External Wallet</div>
                          </div>
                        </button>
                      ))
                    }
                    
                    {/* Rainbow Wallet */}
                    <button
                      onClick={() => window.open('https://rainbow.me/', '_blank')}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg text-left hover:bg-white/10 transition-all duration-200 group"
                      data-testid="wallet-option-rainbow"
                    >
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L13.09 8.26L22 12L13.09 15.74L12 22L10.91 15.74L2 12L10.91 8.26L12 2Z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Rainbow</div>
                        <div className="text-xs text-white/60">Install Wallet</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}