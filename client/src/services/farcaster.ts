/**
 * Official Farcaster Mini App SDK Integration
 * Using modern ES modules approach instead of script tag
 */

import { sdk as farcasterSDK } from '@farcaster/miniapp-sdk';

export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
}

/**
 * Initialize Farcaster SDK and get user context
 * Returns user data if in Farcaster environment, null otherwise
 */
export async function getFarcasterUser(): Promise<FarcasterUser | null> {
  try {
    // Simple check: are we inside Farcaster SDK context?
    const isInFarcaster = window.parent !== window; // Running in iframe (Farcaster app)
    
    console.log('Simple Farcaster check:', {
      isInFarcaster,
      hasParent: window.parent !== window,
      hostname: window.location.hostname
    });
    
    if (isInFarcaster) {
      console.log('✅ Running in Farcaster SDK - enabling database mode');
      
      try {
        // Get real user data from Farcaster SDK context (it's a Promise)
        const context = await farcasterSDK.context;
        if (context && context.user) {
          const farcasterUser = context.user;
          console.log('Farcaster user authenticated:', farcasterUser);
          
          return {
            fid: farcasterUser.fid,
            username: farcasterUser.username,
            displayName: farcasterUser.displayName,
            pfpUrl: farcasterUser.pfpUrl,
            bio: farcasterUser.bio
          };
        }
      } catch (contextError) {
        console.log('Failed to get Farcaster context:', contextError);
      }
    } else {
      // We're outside Farcaster - fun mode
      console.log('❌ Not in Farcaster SDK - enabling fun mode');
    }
    
    return null;

  } catch (error) {
    console.log('Error in getFarcasterUser:', error);
    return null;
  }
}

/**
 * Check if we're running in a Farcaster Mini App environment
 */
export async function isFarcasterEnvironment(): Promise<boolean> {
  try {
    if (!farcasterSDK) return false;
    const context = await farcasterSDK.context;
    return !!context && !!context.user;
  } catch {
    return false;
  }
}