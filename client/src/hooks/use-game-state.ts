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

  // Get user data
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/user", userId],
    enabled: !!userId,
    retry: false,
  });

  // Initialize user on mount - simplified to prevent infinite loops
  useEffect(() => {
    // Wait for Farcaster auth to complete
    if (farcasterLoading) return;

    const storedUserId = localStorage.getItem("arbcasino_user_id");
    
    // Clear invalid stored user IDs that start with "temp_" when we have Farcaster auth
    if (storedUserId && storedUserId.startsWith("temp_") && isFarcasterAuth) {
      // Clearing temporary user ID for Farcaster user
      localStorage.removeItem("arbcasino_user_id");
      setUserId(null);
      return;
    }
    
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
    if (!storedUserId && !userId && !initUserMutation.isPending && !initUserMutation.isSuccess) {
      // Create user with Farcaster data if available, otherwise use mock data
      const username = isFarcasterAuth && farcasterUser 
        ? (farcasterUser.username || farcasterUser.displayName || `FarcasterUser${farcasterUser.fid}`)
        : `Player${Math.floor(Math.random() * 10000)}`;
        
      const walletAddress = `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      
      // Initializing user with Farcaster data
      
      initUserMutation.mutate({
        username,
        walletAddress,
        farcasterFid: isFarcasterAuth && farcasterUser ? farcasterUser.fid : undefined,
        farcasterUsername: isFarcasterAuth && farcasterUser ? farcasterUser.username : undefined,
        farcasterDisplayName: isFarcasterAuth && farcasterUser ? farcasterUser.displayName : undefined,
        farcasterPfpUrl: isFarcasterAuth && farcasterUser ? farcasterUser.pfpUrl : undefined,
      });
    }
  }, [farcasterLoading, error, userId, initUserMutation.isPending, initUserMutation.isSuccess, isFarcasterAuth, farcasterUser]); // Fixed dependencies

  return {
    user,
    farcasterUser,
    isFarcasterAuthenticated: isFarcasterAuth,
    isLoading: isLoading || initUserMutation.isPending,
    initUser: initUserMutation.mutate,
  };
}
