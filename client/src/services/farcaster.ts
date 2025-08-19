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
    // Check if we're in Farcaster developer preview environment
    const isPreviewEnvironment = window.location.hostname.includes('farcaster.xyz') || 
                                  window.location.hostname.includes('developers');
    
    if (isPreviewEnvironment) {
      // In preview environment, simulate a valid Farcaster user
      return {
        fid: 190522, // Valid test FID
        username: 'cookedzera',
        displayName: 'ArbCasino Player',
        pfpUrl: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/309c4432-ce5e-4e2c-a2f4-50a0f8e21f00/original',
        bio: 'Playing ArbCasino in preview mode'
      };
    }

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
    
    return {
      fid: userFID,
      username: user.username,
      displayName: user.displayName,
      pfpUrl: user.pfpUrl,
      bio: (user as any).bio || ''
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