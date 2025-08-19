import { createClient } from '@farcaster/quick-auth';
import { Errors } from '@farcaster/quick-auth';
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

// Initialize Quick Auth client
const client = createClient();

// Initialize Neynar API client (if API key is available)
let neynarClient: NeynarAPIClient | null = null;
try {
  if (process.env.NEYNAR_API_KEY) {
    const config = new Configuration({
      apiKey: process.env.NEYNAR_API_KEY,
    });
    neynarClient = new NeynarAPIClient(config);
  }
} catch (error) {
  console.log('Neynar API not configured - using fallback data');
}

// Interface for Farcaster user data
export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  bio?: string;
  pfpUrl?: string;
  custody?: string;
  verifications?: string[];
}

// Verify JWT token and extract user data
export async function verifyFarcasterToken(token: string, domain: string): Promise<FarcasterUser> {
  try {
    const payload = await client.verifyJwt({
      token,
      domain,
    });

    // The payload.sub contains the user's FID
    const fid = payload.sub;

    // In a real implementation, you would fetch additional user data from:
    // 1. Farcaster Hub API
    // 2. Neynar API
    // 3. Your own database cache
    
    // For now, we'll return the basic verified data
    return {
      fid: parseInt(fid.toString()),
      username: `fc-user-${fid}`,
      displayName: `Farcaster User ${fid}`,
      bio: 'Authenticated Farcaster user',
      pfpUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fid}`,
      custody: (payload as any).custody || '',
      verifications: (payload as any).verifications || []
    };
  } catch (error) {
    if (error instanceof Errors.InvalidTokenError) {
      throw new Error('Invalid Farcaster token');
    }
    throw error;
  }
}

// Middleware to authenticate Farcaster users
export function createFarcasterAuthMiddleware(domain: string) {
  return async (req: any, res: any, next: any) => {
    try {
      const authorization = req.headers.authorization;
      
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authorization.split(' ')[1];
      const user = await verifyFarcasterToken(token, domain);
      
      // Attach user data to request
      req.farcasterUser = user;
      next();
    } catch (error) {
      console.error('Farcaster auth error:', error);
      return res.status(401).json({ error: 'Invalid Farcaster authentication' });
    }
  };
}

// Fetch user data from Pinata Farcaster Hub API (free, no API key needed)
export async function fetchUserDataFromHub(fid: number): Promise<Partial<FarcasterUser>> {
  try {
    const response = await fetch(`https://hub.pinata.cloud/v1/userDataByFid?fid=${fid}`);
    
    if (!response.ok) {
      return {};
    }

    const data = await response.json();

    if (!data.messages || data.messages.length === 0) {
      return {};
    }

    const messages = data.messages;
    let displayName = '';
    let username = '';
    let bio = '';
    let pfpUrl = '';

    messages.forEach((msg: any) => {
      const userData = msg.data?.userDataBody;
      if (!userData) return;

      switch (userData.type) {
        case 'USER_DATA_TYPE_DISPLAY':
          displayName = userData.value;
          break;
        case 'USER_DATA_TYPE_USERNAME':
          username = userData.value;
          break;
        case 'USER_DATA_TYPE_BIO':
          bio = userData.value;
          break;
        case 'USER_DATA_TYPE_PFP':
          pfpUrl = userData.value;
          break;
      }
    });

    return {
      fid,
      username: username || '',
      displayName: displayName || '',
      bio: bio || '',
      pfpUrl: pfpUrl || '',
      custody: '',
      verifications: []
    };
  } catch (error) {
    return {};
  }
}

// Helper function to resolve additional user data from external APIs
export async function resolveUserData(fid: number): Promise<Partial<FarcasterUser>> {
  try {
    const hubData = await fetchUserDataFromHub(fid);
    if (hubData.username || hubData.displayName) {
      return hubData;
    }

    if (neynarClient) {
      try {
        const { users } = await neynarClient.fetchBulkUsers({ fids: [fid] });
        if (users && users.length > 0) {
          const user = users[0];
          return {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            bio: user.profile?.bio?.text || '',
            pfpUrl: user.pfp_url,
            custody: user.custody_address,
            verifications: user.verified_addresses?.eth_addresses || []
          };
        }
      } catch (neynarError) {
        // Silently handle error
      }
    }

    return { fid };
  } catch (error) {
    return { fid };
  }
}

// Search for FID by ethereum address using Pinata Hub API
export async function getFidByAddress(address: string): Promise<number | null> {
  try {
    console.log(`🔍 Looking up FID for address: ${address}`);
    
    // Try multiple approaches to find FID by address
    // Approach 1: Direct verification lookup (may not work for all addresses)
    try {
      const response = await fetch(`https://hub.pinata.cloud/v1/verificationsByFid?fid=1&address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const fid = data.messages[0]?.data?.fid;
          if (fid) {
            console.log(`✅ Found FID ${fid} for address ${address} via direct lookup`);
            return fid;
          }
        }
      }
    } catch (error) {
      console.log('Direct verification lookup failed:', error);
    }

    // For now, return null since we need a proper address-to-FID mapping service
    console.log(`❌ No FID found for address ${address} - may need Neynar API for address lookup`);
    return null;
  } catch (error) {
    console.error('Error fetching FID by address:', error);
    return null;
  }
}

// Fetch user by ethereum address
export async function getUserByAddress(address: string): Promise<FarcasterUser | null> {
  try {
    console.log(`🔍 Fetching Farcaster user for address: ${address}`);

    // Try Neynar API first if available
    if (neynarClient) {
      try {
        console.log(`🔄 Trying Neynar API for address ${address}`);
        const response = await neynarClient.fetchBulkUsersByEthOrSolAddress({
          addresses: [address]
        });
        
        if (response && Object.keys(response).length > 0) {
          const addressData = response[address.toLowerCase()];
          if (addressData && addressData.length > 0) {
            const user = addressData[0];
            console.log(`✅ Found user via Neynar for address ${address}`);
            return {
              fid: user.fid,
              username: user.username,
              displayName: user.display_name,
              bio: user.profile?.bio?.text || '',
              pfpUrl: user.pfp_url,
              custody: user.custody_address,
              verifications: user.verified_addresses?.eth_addresses || []
            };
          }
        }
      } catch (neynarError) {
        console.log('Neynar address lookup failed:', neynarError);
      }
    }

    // Try to find FID using Hub API verification lookup
    const fid = await getFidByAddress(address);
    if (fid) {
      // Get user data using the FID
      const userData = await fetchUserDataFromHub(fid);
      if (userData.username || userData.displayName) {
        console.log(`✅ Found user via Hub API for address ${address}`);
        return {
          fid,
          username: userData.username || '',
          displayName: userData.displayName || '',
          bio: userData.bio || '',
          pfpUrl: userData.pfpUrl || '',
          custody: address,
          verifications: [address]
        };
      }
    }

    // For testing purposes, let's try a known FID to verify the API works
    if (address.toLowerCase() === '0x...') { // Add specific test address if needed
      const testUserData = await fetchUserDataFromHub(190522);
      if (testUserData.username || testUserData.displayName) {
        console.log(`🧪 Test: Successfully fetched data for FID 190522`);
      }
    }

    // Fallback to Searchcaster API (free alternative)
    try {
      console.log(`🔄 Trying Searchcaster for address ${address}`);
      const response = await fetch(`https://searchcaster.xyz/api/profiles?connected_address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const user = data[0];
          console.log(`✅ Found user via Searchcaster for address ${address}`);
          return {
            fid: user.body?.fid || 0,
            username: user.body?.username || '',
            displayName: user.body?.displayName || '',
            bio: user.body?.bio || '',
            pfpUrl: user.body?.pfpUrl || '',
            custody: user.body?.address || address,
            verifications: [address]
          };
        }
      }
    } catch (searchError) {
      console.log('Searchcaster lookup failed:', searchError);
    }

    console.log(`❌ No Farcaster profile found for address ${address}`);
    return null;
  } catch (error) {
    console.error('Error fetching user by address:', error);
    return null;
  }
}