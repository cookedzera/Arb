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
    // Proper Farcaster detection: try to use the actual SDK
    let isRealFarcaster = false;
    let farcasterContext = null;
    
    try {
      // Test if Farcaster SDK is actually available and working
      farcasterContext = await farcasterSDK.context;
      if (farcasterContext && farcasterContext.user && farcasterContext.user.fid) {
        isRealFarcaster = true;
      }
    } catch (sdkError) {
      // SDK not available or failed - not in Farcaster
      isRealFarcaster = false;
    }
    
    // Additional check: look for Farcaster-specific URL patterns or referrers
    const url = window.location.href;
    const referrer = document.referrer;
    const userAgent = navigator.userAgent;
    
    // Check for Farcaster-specific indicators
    const hasFarcasterIndicators = 
      url.includes('farcaster') || 
      referrer.includes('farcaster') ||
      userAgent.includes('Farcaster') ||
      window.location.search.includes('fc_');
    
    console.log('🔍 Farcaster Detection:', {
      isRealFarcaster,
      hasFarcasterIndicators,
      hasSDKContext: !!farcasterContext,
      hasValidUser: !!(farcasterContext && farcasterContext.user),
      url: url.substring(0, 100),
      referrer: referrer.substring(0, 100),
      userAgent: userAgent.substring(0, 50)
    });
    
    if (isRealFarcaster && farcasterContext && farcasterContext.user) {
      console.log('✅ Real Farcaster detected - enabling database mode');
      return {
        fid: farcasterContext.user.fid,
        username: farcasterContext.user.username || '',
        displayName: farcasterContext.user.displayName || farcasterContext.user.username || '',
        pfpUrl: farcasterContext.user.pfpUrl || '',
        bio: 'ArbCasino Player'
      };
    } else {
      // We're outside Farcaster - fun mode
      console.log('🎮 Chrome browser detected - enabling FUN MODE (no data saved)');
      return null;
    }

  } catch (error) {
    console.log('🎮 Farcaster detection failed - defaulting to FUN MODE:', error);
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