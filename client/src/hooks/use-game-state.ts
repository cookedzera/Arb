import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type User } from "@shared/schema";
import { useEffect, useState } from "react";
import { useFarcasterAuth } from "./use-farcaster-auth";

export function useGameState() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user: farcasterUser, isAuthenticated: isFarcasterAuth, isLoading: farcasterLoading } = useFarcasterAuth();

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
      console.log('Creating user with data:', userData);
      const response = await apiRequest("POST", "/api/user", userData);
      return response.json() as Promise<User>;
    },
    onSuccess: (user) => {
      console.log('User created successfully:', user);
      setUserId(user.id);
      localStorage.setItem("arbcasino_user_id", user.id);
    }
  });

  // Get user data
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/user", userId],
    enabled: !!userId,
    retry: false,
  });

  // Initialize user on mount - optimized to prevent infinite loops
  useEffect(() => {
    // Wait for Farcaster auth to complete
    if (farcasterLoading) return;

    // Force refresh for testing - clear localStorage to test auth
    localStorage.removeItem("arbcasino_user_id");

    const storedUserId = localStorage.getItem("arbcasino_user_id");
    
    // If we have a stored user ID and no error, use it
    if (storedUserId && !error && !userId) {
      setUserId(storedUserId);
      return;
    }
    
    // Clear invalid stored user ID if there's an error
    if (storedUserId && error) {
      localStorage.removeItem("arbcasino_user_id");
      setUserId(null);
    }
    
    // Only create a new user if we don't have one and haven't already started the process
    if (!storedUserId && !userId && !initUserMutation.isPending) {
      // Create user with Farcaster data if available, otherwise use mock data
      const username = isFarcasterAuth && farcasterUser 
        ? (farcasterUser.username || farcasterUser.displayName || `FarcasterUser${farcasterUser.fid}`)
        : `Player${Math.floor(Math.random() * 10000)}`;
        
      const walletAddress = isFarcasterAuth && farcasterUser?.custody
        ? farcasterUser.custody
        : `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      
      console.log('Initializing user with Farcaster data:', {
        isFarcasterAuth,
        farcasterUser,
        username
      });
      
      initUserMutation.mutate({
        username,
        walletAddress,
        farcasterFid: isFarcasterAuth && farcasterUser ? farcasterUser.fid : undefined,
        farcasterUsername: isFarcasterAuth && farcasterUser ? farcasterUser.username : undefined,
        farcasterDisplayName: isFarcasterAuth && farcasterUser ? farcasterUser.displayName : undefined,
        farcasterPfpUrl: isFarcasterAuth && farcasterUser ? farcasterUser.pfpUrl : undefined,
      });
    }
  }, [farcasterLoading, error, userId, initUserMutation.isPending, isFarcasterAuth, farcasterUser]); // Include auth state in dependencies

  return {
    user,
    farcasterUser,
    isFarcasterAuthenticated: isFarcasterAuth,
    isLoading: isLoading || initUserMutation.isPending || farcasterLoading,
    initUser: initUserMutation.mutate,
  };
}
