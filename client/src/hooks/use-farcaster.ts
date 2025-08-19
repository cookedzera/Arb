/**
 * React hook for Farcaster Mini App integration
 * Uses official SDK Method 1: Auto FID from Context
 */

import { useState, useEffect } from 'react';
import { getFarcasterUser, type FarcasterUser } from '@/services/farcaster';

// Global cache to persist Farcaster data across page navigation
let globalFarcasterCache: {
  user: FarcasterUser | null;
  isAuthenticated: boolean;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useFarcaster() {
  const [user, setUser] = useState<FarcasterUser | null>(
    globalFarcasterCache?.user || null
  );
  const [loading, setLoading] = useState(!globalFarcasterCache);
  const [isAuthenticated, setIsAuthenticated] = useState(
    globalFarcasterCache?.isAuthenticated || false
  );

  useEffect(() => {
    let mounted = true;

    async function loadFarcasterUser() {
      // Check if we have valid cached data
      if (globalFarcasterCache && 
          (Date.now() - globalFarcasterCache.timestamp) < CACHE_DURATION) {
        if (mounted) {
          setUser(globalFarcasterCache.user);
          setIsAuthenticated(globalFarcasterCache.isAuthenticated);
          setLoading(false);
        }
        return;
      }

      try {
        const farcasterUser = await getFarcasterUser();
        
        // Update global cache
        globalFarcasterCache = {
          user: farcasterUser,
          isAuthenticated: !!farcasterUser,
          timestamp: Date.now()
        };
        
        if (mounted) {
          setUser(farcasterUser);
          setIsAuthenticated(!!farcasterUser);
          setLoading(false);
        }
      } catch (error) {
        // Update cache with null data
        globalFarcasterCache = {
          user: null,
          isAuthenticated: false,
          timestamp: Date.now()
        };
        
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
      }
    }

    loadFarcasterUser();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    user,
    fid: user?.fid,
    username: user?.username,
    displayName: user?.displayName,
    avatarUrl: user?.pfpUrl,
    bio: user?.bio,
    isAuthenticated,
    loading
  };
}