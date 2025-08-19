import { type User, type InsertUser, type GameStats, type InsertGameStats, type SpinResult, type InsertSpinResult, type Token, type InsertToken, type TokenClaim, type InsertTokenClaim, users, gameStats, spinResults, tokens, tokenClaims } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>; // Alias for getUser
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getGameStats(): Promise<GameStats>;
  updateGameStats(updates: Partial<GameStats>): Promise<GameStats>;
  createSpinResult(result: InsertSpinResult): Promise<SpinResult>;
  addSpinResult(result: InsertSpinResult): Promise<SpinResult>; // Alias for createSpinResult
  getLeaderboard(): Promise<User[]>;
  getUserSpinsToday(userId: string): Promise<number>;
  getTokens(): Promise<Token[]>;
  createToken(token: InsertToken): Promise<Token>;
  updateToken(id: string, updates: Partial<Token>): Promise<Token | undefined>;
  getActiveTokens(): Promise<Token[]>;
  // New methods for accumulated rewards
  addAccumulatedReward(userId: string, tokenType: string, amount: string): Promise<User | undefined>;
  getUserAccumulatedBalances(userId: string): Promise<{ token1: string; token2: string; token3: string }>;
  createTokenClaim(claim: InsertTokenClaim): Promise<TokenClaim>;
  addTokenClaim(claim: InsertTokenClaim): Promise<TokenClaim>; // Alias for createTokenClaim
  getUserClaims(userId: string): Promise<TokenClaim[]>;
  canUserClaim(userId: string): Promise<{ canClaim: boolean; totalValueUSD: string }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getGameStats(): Promise<GameStats> {
    const [stats] = await db.select().from(gameStats).limit(1);
    if (!stats) {
      // Create initial stats if none exist
      const [newStats] = await db
        .insert(gameStats)
        .values({ totalClaims: 1024, contractTxs: 839 })
        .returning();
      return newStats;
    }
    return stats;
  }

  async updateGameStats(updates: Partial<GameStats>): Promise<GameStats> {
    const currentStats = await this.getGameStats();
    const [updatedStats] = await db
      .update(gameStats)
      .set(updates)
      .where(eq(gameStats.id, currentStats.id))
      .returning();
    return updatedStats;
  }

  async createSpinResult(result: InsertSpinResult): Promise<SpinResult> {
    const [spinResult] = await db
      .insert(spinResults)
      .values(result)
      .returning();
    return spinResult;
  }

  async addSpinResult(result: InsertSpinResult): Promise<SpinResult> {
    return this.createSpinResult(result);
  }

  async getLeaderboard(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.totalWins))
      .limit(10);
  }

  async getUserSpinsToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(spinResults)
      .where(
        sql`${spinResults.userId} = ${userId} AND ${spinResults.timestamp} >= ${today}`
      );
    
    return result[0]?.count || 0;
  }

  async getTokens(): Promise<Token[]> {
    return await db.select().from(tokens);
  }

  async createToken(token: InsertToken): Promise<Token> {
    const [newToken] = await db
      .insert(tokens)
      .values(token)
      .returning();
    return newToken;
  }

  async updateToken(id: string, updates: Partial<Token>): Promise<Token | undefined> {
    const [token] = await db
      .update(tokens)
      .set(updates)
      .where(eq(tokens.id, id))
      .returning();
    return token || undefined;
  }

  async getActiveTokens(): Promise<Token[]> {
    return await db
      .select()
      .from(tokens)
      .where(eq(tokens.isActive, true));
  }

  // New methods for accumulated rewards
  async addAccumulatedReward(userId: string, tokenType: string, amount: string): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    let updates: Partial<User> = {};
    
    switch (tokenType) {
      case 'TOKEN1':
        const newToken1 = (BigInt(user.accumulatedToken1 || '0') + BigInt(amount)).toString();
        updates.accumulatedToken1 = newToken1;
        break;
      case 'TOKEN2':
        const newToken2 = (BigInt(user.accumulatedToken2 || '0') + BigInt(amount)).toString();
        updates.accumulatedToken2 = newToken2;
        break;
      case 'TOKEN3':
        const newToken3 = (BigInt(user.accumulatedToken3 || '0') + BigInt(amount)).toString();
        updates.accumulatedToken3 = newToken3;
        break;
      default:
        return user;
    }

    return await this.updateUser(userId, updates);
  }

  async getUserAccumulatedBalances(userId: string): Promise<{ token1: string; token2: string; token3: string }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { token1: '0', token2: '0', token3: '0' };
    }
    
    return {
      token1: user.accumulatedToken1 || '0',
      token2: user.accumulatedToken2 || '0',
      token3: user.accumulatedToken3 || '0'
    };
  }

  async createTokenClaim(claim: InsertTokenClaim): Promise<TokenClaim> {
    const [newClaim] = await db
      .insert(tokenClaims)
      .values(claim)
      .returning();
    return newClaim;
  }

  async addTokenClaim(claim: InsertTokenClaim): Promise<TokenClaim> {
    return this.createTokenClaim(claim);
  }

  async getUserClaims(userId: string): Promise<TokenClaim[]> {
    return await db
      .select()
      .from(tokenClaims)
      .where(eq(tokenClaims.userId, userId))
      .orderBy(desc(tokenClaims.timestamp));
  }

  async canUserClaim(userId: string): Promise<{ canClaim: boolean; totalValueUSD: string }> {
    const balances = await this.getUserAccumulatedBalances(userId);
    
    // Simple calculation: assume each token is worth $0.0001 USD for demo purposes
    // In reality, you'd fetch real prices from a price oracle
    const token1ValueUSD = (BigInt(balances.token1) * BigInt(1)) / BigInt(10000); // $0.0001 per token
    const token2ValueUSD = (BigInt(balances.token2) * BigInt(2)) / BigInt(10000); // $0.0002 per token  
    const token3ValueUSD = (BigInt(balances.token3) * BigInt(5)) / BigInt(10000); // $0.0005 per token
    
    const totalValueUSD = (token1ValueUSD + token2ValueUSD + token3ValueUSD).toString();
    const minClaimThreshold = BigInt(100); // $1.00 minimum claim threshold
    
    return {
      canClaim: (token1ValueUSD + token2ValueUSD + token3ValueUSD) >= minClaimThreshold,
      totalValueUSD
    };
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private gameStats: GameStats;
  private spinResults: Map<string, SpinResult>;
  private tokens: Map<string, Token>;

  constructor() {
    this.users = new Map();
    this.gameStats = {
      id: randomUUID(),
      date: new Date(),
      totalClaims: 1024,
      contractTxs: 839,
    };
    this.spinResults = new Map();
    this.tokens = new Map();
    
    // Initialize with some mock users for leaderboard and tokens
    this.initializeMockData();
    this.initializeTokens();
  }

  private initializeMockData() {
    const generateMockAddress = () => `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    const mockUsers = [
      { username: "0xAb...C1F", walletAddress: generateMockAddress(), spinsUsed: 2, totalWins: 4, totalSpins: 4 },
      { username: "0xD2...B12", walletAddress: generateMockAddress(), spinsUsed: 2, totalWins: 3, totalSpins: 5 },
      { username: "0xE3...A45", walletAddress: generateMockAddress(), spinsUsed: 1, totalWins: 2, totalSpins: 3 },
      { username: "0xF4...B67", walletAddress: generateMockAddress(), spinsUsed: 2, totalWins: 2, totalSpins: 4 },
      { username: "0xG5...C89", walletAddress: generateMockAddress(), spinsUsed: 1, totalWins: 1, totalSpins: 2 },
    ];

    mockUsers.forEach(user => {
      const id = randomUUID();
      const fullUser: User = {
        id,
        ...user,
        farcasterFid: null,
        farcasterUsername: null,
        farcasterDisplayName: null,
        farcasterPfpUrl: null,
        farcasterBio: null,
        accumulatedToken1: "0",
        accumulatedToken2: "0",
        accumulatedToken3: "0",
        claimedToken1: "0",
        claimedToken2: "0",
        claimedToken3: "0",
        lastClaimDate: null,
        lastSpinDate: new Date(),
        createdAt: new Date(),
      };
      this.users.set(id, fullUser);
    });
  }

  private initializeTokens() {
    const tokensData = [
      {
        address: "0x09e18590e8f76b6cf471b3cd75fe1a1a9d2b2c2b",
        symbol: "TOKEN1",
        name: "First Token",
        decimals: 18,
        isActive: true,
        rewardAmount: 50000000000000 // 0.00005 tokens (very small amount)
      },
      {
        address: "0x13a7dedb7169a17be92b0e3c7c2315b46f4772b3",
        symbol: "TOKEN2", 
        name: "Second Token",
        decimals: 18,
        isActive: true,
        rewardAmount: 100000000000000 // 0.0001 tokens
      },
      {
        address: "0xbc4c97fb9befaa8b41448e1dfcc5236da543217f",
        symbol: "TOKEN3",
        name: "Third Token", 
        decimals: 18,
        isActive: true,
        rewardAmount: 25000000000000 // 0.000025 tokens
      }
    ];

    tokensData.forEach(tokenData => {
      const id = randomUUID();
      const token: Token = {
        id,
        ...tokenData,
      };
      this.tokens.set(id, token);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      walletAddress: insertUser.walletAddress || null,
      id,
      farcasterFid: insertUser.farcasterFid || null,
      farcasterUsername: insertUser.farcasterUsername || null,
      farcasterDisplayName: insertUser.farcasterDisplayName || null,
      farcasterPfpUrl: insertUser.farcasterPfpUrl || null,
      farcasterBio: insertUser.farcasterBio || null,
      spinsUsed: 0,
      totalWins: 0,
      totalSpins: 0,
      accumulatedToken1: "0",
      accumulatedToken2: "0",
      accumulatedToken3: "0",
      claimedToken1: "0",
      claimedToken2: "0",
      claimedToken3: "0",
      lastSpinDate: null,
      lastClaimDate: null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getGameStats(): Promise<GameStats> {
    return this.gameStats;
  }

  async updateGameStats(updates: Partial<GameStats>): Promise<GameStats> {
    this.gameStats = { ...this.gameStats, ...updates };
    return this.gameStats;
  }

  async createSpinResult(result: InsertSpinResult): Promise<SpinResult> {
    const id = randomUUID();
    const spinResult: SpinResult = {
      ...result,
      rewardAmount: result.rewardAmount || "0",
      userId: result.userId || null,
      symbols: result.symbols || null,
      isWin: result.isWin || false,
      tokenType: result.tokenType || null,
      tokenId: result.tokenId || null,
      tokenAddress: result.tokenAddress || null,
      isAccumulated: result.isAccumulated !== undefined ? result.isAccumulated : true,
      claimType: result.claimType || null,
      transactionHash: result.transactionHash || null,
      id,
      timestamp: new Date(),
    };
    this.spinResults.set(id, spinResult);
    return spinResult;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async addSpinResult(result: InsertSpinResult): Promise<SpinResult> {
    return this.createSpinResult(result);
  }

  async getLeaderboard(): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0))
      .slice(0, 10);
  }

  async getUserSpinsToday(userId: string): Promise<number> {
    const user = this.users.get(userId);
    if (!user || !user.lastSpinDate) return 0;
    
    const today = new Date();
    const lastSpin = new Date(user.lastSpinDate);
    
    // Check if last spin was today (UTC)
    if (
      today.getUTCDate() === lastSpin.getUTCDate() &&
      today.getUTCMonth() === lastSpin.getUTCMonth() &&
      today.getUTCFullYear() === lastSpin.getUTCFullYear()
    ) {
      return user.spinsUsed || 0;
    }
    
    return 0;
  }

  async getTokens(): Promise<Token[]> {
    return Array.from(this.tokens.values());
  }

  async createToken(insertToken: InsertToken): Promise<Token> {
    const id = randomUUID();
    const token: Token = {
      ...insertToken,
      decimals: insertToken.decimals || 18,
      isActive: insertToken.isActive !== undefined ? insertToken.isActive : true,
      rewardAmount: insertToken.rewardAmount || 100,
      id,
    };
    this.tokens.set(id, token);
    return token;
  }

  async updateToken(id: string, updates: Partial<Token>): Promise<Token | undefined> {
    const token = this.tokens.get(id);
    if (!token) return undefined;
    
    const updatedToken = { ...token, ...updates };
    this.tokens.set(id, updatedToken);
    return updatedToken;
  }

  async getActiveTokens(): Promise<Token[]> {
    return Array.from(this.tokens.values()).filter(token => token.isActive);
  }

  // New methods for accumulated rewards (placeholder implementations)
  async addAccumulatedReward(userId: string, tokenType: string, amount: string): Promise<User | undefined> {
    // For memory storage, we'll just return the user - this is a placeholder
    return this.users.get(userId);
  }

  async getUserAccumulatedBalances(userId: string): Promise<{ token1: string; token2: string; token3: string }> {
    return { token1: '0', token2: '0', token3: '0' };
  }

  async createTokenClaim(claim: InsertTokenClaim): Promise<TokenClaim> {
    const id = randomUUID();
    const tokenClaim: TokenClaim = {
      ...claim,
      userId: claim.userId || null,
      token1Amount: claim.token1Amount || "0",
      token2Amount: claim.token2Amount || "0",
      token3Amount: claim.token3Amount || "0",
      totalValueUSD: claim.totalValueUSD || "0",
      transactionHash: claim.transactionHash || null,
      status: claim.status || "pending",
      id,
      timestamp: new Date(),
    };
    return tokenClaim;
  }

  async addTokenClaim(claim: InsertTokenClaim): Promise<TokenClaim> {
    return this.createTokenClaim(claim);
  }

  async getUserClaims(userId: string): Promise<TokenClaim[]> {
    return [];
  }

  async canUserClaim(userId: string): Promise<{ canClaim: boolean; totalValueUSD: string }> {
    return { canClaim: false, totalValueUSD: '0' };
  }
}

// Use Supabase database storage
function createStorage(): IStorage {
  const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl || databaseUrl.trim() === '') {
    throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set. Please configure your Supabase database connection.");
  }
  
  console.log('🔧 Connecting to Supabase database...');
  return new DatabaseStorage();
}

export const storage = createStorage();
