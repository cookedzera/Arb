import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  bio?: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: string[];
}

interface FarcasterAuth {
  user: FarcasterUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  walletConnected: boolean;
  walletAddress?: string;
  authenticate: () => Promise<void>;
  signOut: () => void;
}

export function useFarcasterAuth(): FarcasterAuth {
  const { isConnected, address } = useAccount();
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // This hook now primarily tracks Wagmi connection state
  // The actual user data fetching is handled by the FarcasterConnect component
  const authenticate = async () => {
    // This is now handled by the FarcasterConnect component
    // when the wallet is connected through Wagmi
    return Promise.resolve();
  };

  const signOut = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('farcaster_user');
  };

  // Update authentication state based on wallet connection
  useEffect(() => {
    if (!isConnected) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    // Check for stored user data when wallet is connected
    const storedUser = localStorage.getItem('farcaster_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (parseError) {
        console.error('Failed to parse stored user data:', parseError);
        localStorage.removeItem('farcaster_user');
      }
    }
  }, [isConnected]);

  return {
    user,
    isLoading,
    isAuthenticated: isAuthenticated && isConnected,
    walletConnected: isConnected,
    walletAddress: address,
    authenticate,
    signOut
  };
}