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
    if (!farcasterSDK) {
      return null;
    }

    await farcasterSDK.actions.ready();
    const context = await farcasterSDK.context as any;
    
    if (!context || !context.user) {
      return null;
    }

    const user = context.user;
    const userFID = user.fid;
    
    if (!userFID) {
      return null;
    }
    
    // Get additional user data from backend Hub API
    let additionalData: any = {};
    try {
      const response = await fetch(`/api/farcaster/user/${userFID}`);
      if (response.ok) {
        additionalData = await response.json();
      }
    } catch (error) {
      // Silently handle error
    }
    
    return {
      fid: userFID,
      username: user.username || additionalData.username,
      displayName: user.displayName || additionalData.displayName,
      pfpUrl: user.pfpUrl || additionalData.pfpUrl,
      bio: (user as any).bio || additionalData.bio || ''
    };

  } catch (error) {
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