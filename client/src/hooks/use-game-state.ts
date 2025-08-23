import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type User } from "@shared/schema";
import { useEffect, useState } from "react";
import { useFarcaster } from "./use-farcaster";

export function useGameState() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user: farcasterUser, isAuthenticated: isFarcasterAuth, loading: farcasterLoading } = useFarcaster();

  // Initialize user
  const initUserMutation = useMutation({
    mutationFn: async (userData: { 
      username: string; 
      walletAddress?: string; 
      farcasterFid?: number;
      farcasterUsername?: string;
      farcasterDisplayName?: string;
      farcasterPfpUrl?: string;
    }) => {
      // User creation in progress
      const response = await apiRequest("POST", "/api/user", userData);
      return response.json() as Promise<User>;
    },
    onSuccess: (user) => {
      // User created successfully
      setUserId(user.id);
      localStorage.setItem("arbcasino_user_id", user.id);
    }
  });

  // Get user data - but skip API call for temporary users
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/user", userId],
    enabled: !!userId && !userId.startsWith('temp_'),
    retry: false,
  });

  // Initialize user on mount - simplified to prevent infinite loops
  useEffect(() => {
    // Wait for Farcaster auth to complete, but with timeout
    if (farcasterLoading) {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.log('⏱️ Farcaster loading timeout - proceeding without Farcaster data');
      }, 5000);
      return () => clearTimeout(timeoutId);
    }

    const storedUserId = localStorage.getItem("arbcasino_user_id");
    
    // Clear invalid stored user IDs that start with "temp_" when we have Farcaster auth
    if (storedUserId && storedUserId.startsWith("temp_") && isFarcasterAuth) {
      console.log('🔄 Clearing temporary user ID for Farcaster user');
      localStorage.removeItem("arbcasino_user_id");
      setUserId(null);
      return;
    }
    
    // If we have a stored user ID and no error, use it
    if (storedUserId && !error && !userId) {
      console.log('✅ Using stored user ID:', storedUserId);
      setUserId(storedUserId);
      return;
    }
    
    // Clear invalid stored user ID if there's an error
    if (storedUserId && error) {
      console.log('❌ Clearing invalid user ID due to error');
      localStorage.removeItem("arbcasino_user_id");
      setUserId(null);
    }
    
    // Only create a new user if we don't have one and haven't already started the process
    if (!storedUserId && !userId && !initUserMutation.isPending && !initUserMutation.isSuccess) {
      if (isFarcasterAuth && farcasterUser) {
        // Real Farcaster user - save to database
        const username = farcasterUser.username || farcasterUser.displayName || `FarcasterUser${farcasterUser.fid}`;
        const walletAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
        
        console.log('🚀 Creating Farcaster user (database):', { username, fid: farcasterUser.fid });
        
        initUserMutation.mutate({
          username,
          walletAddress,
          farcasterFid: farcasterUser.fid,
          farcasterUsername: farcasterUser.username,
          farcasterDisplayName: farcasterUser.displayName,
          farcasterPfpUrl: farcasterUser.pfpUrl,
        });
      } else {
        // Chrome browser user - create temporary fun-mode user
        const tempUserId = `temp_fun_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const username = `Player${Math.floor(Math.random() * 10000)}`;
        
        console.log('🎮 Creating fun-mode user (temporary):', { tempUserId, username });
        
        // Set temporary user directly without API call
        setUserId(tempUserId);
        localStorage.setItem("arbcasino_user_id", tempUserId);
      }
    }
  }, [farcasterLoading, error, userId, initUserMutation.isPending, initUserMutation.isSuccess, isFarcasterAuth, farcasterUser]);

  // Create temporary user object for fun-mode users
  const tempUser = userId && userId.startsWith('temp_') ? {
    id: userId,
    username: `Player${Math.floor(Math.random() * 10000)}`,
    walletAddress: `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    isTemporary: true,
    spinsUsed: 0,
    totalSpins: 0,
    farcasterFid: null,
    farcasterUsername: null,
    farcasterDisplayName: null,
    farcasterPfpUrl: null,
    createdAt: new Date(),
    lastSpinDate: null,
    totalWins: 0,
    accumulatedToken1: '0',
    accumulatedToken2: '0',
    accumulatedToken3: '0',
    claimedToken1: '0',
    claimedToken2: '0',
    claimedToken3: '0',
    totalClaims: 0,
    lastClaimDate: null
  } as User : null;

  return {
    user: tempUser || user,
    farcasterUser,
    isFarcasterAuthenticated: isFarcasterAuth,
    isLoading: (isLoading || initUserMutation.isPending) && farcasterLoading === false, // Only show loading after Farcaster check is done
    initUser: initUserMutation.mutate,
  };
}
