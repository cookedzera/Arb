import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getFarcasterUser } from '@/services/farcaster';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const authenticate = async () => {
    setIsLoading(true);
    try {
      const farcasterUser = await getFarcasterUser();
      if (farcasterUser) {
        setUser(farcasterUser);
        setIsAuthenticated(true);
        console.log('Farcaster user authenticated:', farcasterUser);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        console.log('No Farcaster user found');
      }
    } catch (error) {
      console.error('Farcaster auth error:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('farcaster_user');
  };

  // Initialize Farcaster authentication
  useEffect(() => {
    authenticate();
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    walletConnected: isConnected,
    walletAddress: address,
    authenticate,
    signOut
  };
}