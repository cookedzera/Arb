import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkIcon, User } from 'lucide-react'

interface FarcasterUser {
  fid: number
  username?: string
  displayName?: string
  bio?: string
  pfpUrl?: string
  custody?: string
  verifications?: string[]
  isWalletOnly?: boolean
}

export function FarcasterConnect() {
  const { isConnected, address } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [user, setUser] = useState<FarcasterUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Get Farcaster user data when connected
  useEffect(() => {
    const fetchUserData = async () => {
      if (!isConnected || !address) return

      try {
        setIsLoading(true)
        console.log(`🔍 Starting automatic Farcaster detection for: ${address}`)
        
        // Try to get real Farcaster user data using the working Hub API
        try {
          const response = await fetch('/api/farcaster/user-by-address', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address })
          })
          
          if (response.ok) {
            const userData = await response.json()
            console.log(`✅ Found Farcaster profile:`, userData)
            setUser(userData)
            localStorage.setItem('farcaster_user', JSON.stringify(userData))
          } else if (response.status === 404) {
            // No Farcaster profile found - create wallet-only user
            console.log(`❌ No Farcaster profile found for ${address}`)
            const walletOnlyUser = {
              fid: 0,
              username: `wallet-${address.slice(-4)}`,
              displayName: `Wallet User`,
              bio: 'Wallet connected - no Farcaster profile detected',
              pfpUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
              custody: address,
              verifications: [address],
              isWalletOnly: true
            }
            setUser(walletOnlyUser)
            localStorage.setItem('farcaster_user', JSON.stringify(walletOnlyUser))
          } else {
            throw new Error(`API responded with ${response.status}`)
          }
        } catch (apiError) {
          console.error('Farcaster API lookup failed:', apiError)
          // Create fallback user data when API fails
          const fallbackUser = {
            fid: 0,
            username: `wallet-${address.slice(-4)}`,
            displayName: `Wallet User`,
            bio: 'Wallet connected - Farcaster lookup temporarily unavailable',
            pfpUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`,
            custody: address,
            verifications: [address],
            isWalletOnly: true
          }
          setUser(fallbackUser)
          localStorage.setItem('farcaster_user', JSON.stringify(fallbackUser))
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [isConnected, address])

  const handleConnect = async () => {
    try {
      if (connectors[0]) {
        // Add MetaMask detection
        if (connectors[0].id === 'injected' && typeof window?.ethereum === 'undefined') {
          alert('Please install MetaMask to connect.')
          return
        }
        await connect({ connector: connectors[0] })
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      alert('Failed to connect wallet. Please try again.')
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setUser(null)
  }

  if (isConnected && isLoading) {
    return (
      <Card className="bg-white/5 backdrop-blur-md border border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></div>
            Detecting Farcaster Profile...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-white/60 text-sm">
              Automatically searching for your Farcaster profile using the Hub API
            </p>
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <span>Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isConnected && user) {
    const isFarcasterUser = user.fid > 0 && !user.isWalletOnly;
    
    return (
      <Card className="bg-white/5 backdrop-blur-md border border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <LinkIcon className={`w-5 h-5 ${isFarcasterUser ? 'text-green-400' : 'text-yellow-400'}`} />
            {isFarcasterUser ? 'Farcaster Profile Found' : 'Wallet Connected'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user.pfpUrl ? (
                <img 
                  src={user.pfpUrl} 
                  alt="Profile" 
                  className={`w-16 h-16 rounded-full border-2 ${isFarcasterUser ? 'border-purple-400' : 'border-gray-400'}`}
                />
              ) : (
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${isFarcasterUser ? 'from-purple-500 to-blue-500' : 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg">
                  {user.displayName || user.username || 'User'}
                </h3>
                {user.username && (
                  <p className="text-white/60 text-sm">@{user.username}</p>
                )}
                {isFarcasterUser && (
                  <p className="text-white/50 text-xs">FID: {user.fid}</p>
                )}
                <p className="text-white/50 text-xs">Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                {user.bio && (
                  <p className="text-white/60 text-sm mt-2">{user.bio}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Badge className={`${isFarcasterUser ? 'bg-green-500/20 text-green-400 border-green-400/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30'} text-xs`}>
                  {isFarcasterUser ? 'Farcaster' : 'Wallet Only'}
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30 text-xs">
                  Connected
                </Badge>
              </div>
            </div>
            <Button 
              onClick={handleDisconnect}
              variant="outline"
              size="sm"
              className="border-red-400/30 text-red-400 hover:bg-red-500/10"
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 backdrop-blur-md border border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <LinkIcon className="w-5 h-5" />
          Connect Farcaster Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 text-center">
          <p className="text-white/60 text-sm">
            Connect your Farcaster wallet to access your profile data and start playing with real cryptocurrency rewards.
          </p>
          <Button 
            onClick={handleConnect}
            disabled={isPending || isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
          >
            {isPending || isLoading ? 'Connecting...' : 'Connect Wallet'}
          </Button>
          {!isConnected && (
            <p className="text-white/40 text-xs">
              Your wallet and Farcaster profile will be automatically detected
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}