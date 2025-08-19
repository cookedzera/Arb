import { ethers } from "ethers";
import { db } from "./db";
import { users, spinResults } from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

// Contract event tracking for leaderboard
export class LeaderboardService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  }

  async syncLeaderboardData() {
    if (!process.env.WHEEL_GAME_ADDRESS) {
      console.log("Contract address not set, skipping leaderboard sync");
      return;
    }

    try {
      // Initialize contract if not already done
      if (!this.contract) {
        const abi = [
          "event SpinResult(address indexed player, string segment, bool isWin, address tokenAddress, uint256 rewardAmount)",
          "event RewardsClaimed(address indexed player, address indexed token, uint256 amount)"
        ];
        this.contract = new ethers.Contract(process.env.WHEEL_GAME_ADDRESS, abi, this.provider);
      }

      // Get recent SpinResult events (last 1000 blocks)
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);

      const spinEvents = await this.contract.queryFilter(
        this.contract.filters.SpinResult(),
        fromBlock,
        currentBlock
      );

      // Process events and update database
      for (const event of spinEvents) {
        await this.processSpinEvent(event);
      }

      console.log(`Processed ${spinEvents.length} spin events for leaderboard`);
    } catch (error) {
      console.error("Error syncing leaderboard data:", error);
    }
  }

  private async processSpinEvent(event: any) {
    try {
      const { player, segment, isWin, tokenAddress, rewardAmount } = event.args;
      
      // Find or create user by wallet address
      let user = await db.select().from(users).where(eq(users.walletAddress, player.toLowerCase())).limit(1);
      
      if (user.length === 0) {
        // Create new user if doesn't exist
        [user[0]] = await db.insert(users).values({
          username: `Player_${player.slice(-6)}`,
          walletAddress: player.toLowerCase()
        }).returning();
      }

      // Record spin result in database
      await db.insert(spinResults).values({
        userId: user[0].id,
        symbols: [segment],
        isWin: isWin,
        rewardAmount: rewardAmount.toString(),
        tokenAddress: isWin ? tokenAddress : null,
        transactionHash: event.transactionHash
      });

      // Update user stats
      await db.update(users)
        .set({
          totalSpins: sql`${users.totalSpins} + 1`,
          totalWins: isWin ? sql`${users.totalWins} + 1` : users.totalWins,
        })
        .where(eq(users.id, user[0].id));

    } catch (error) {
      console.error("Error processing spin event:", error);
    }
  }

  async getLeaderboard(category: 'wins' | 'spins' | 'rewards' = 'wins', limitCount = 10) {
    try {
      // For rewards category, use a different approach
      if (category === 'rewards') {
        try {
          const rewardLeaders = await db
            .select({
              id: users.id,
              username: users.username,
              walletAddress: users.walletAddress,
              farcasterUsername: users.farcasterUsername,
              farcasterPfpUrl: users.farcasterPfpUrl,
              totalWins: users.totalWins,
              totalSpins: users.totalSpins,
              totalRewards: sql<string>`COALESCE(SUM(CAST(${spinResults.rewardAmount} AS NUMERIC)), 0)`.as('totalRewards')
            })
            .from(users)
            .leftJoin(spinResults, and(eq(spinResults.userId, users.id), eq(spinResults.isWin, true)))
            .groupBy(users.id, users.username, users.walletAddress, users.farcasterUsername, users.farcasterPfpUrl, users.totalWins, users.totalSpins)
            .orderBy(desc(sql`COALESCE(SUM(CAST(${spinResults.rewardAmount} AS NUMERIC)), 0)`))
            .limit(limitCount);
          
          return rewardLeaders;
        } catch (rewardError) {
          console.error("Error getting reward leaderboard:", rewardError);
          // Fallback to regular user query
        }
      }

      // Default query for wins/spins
      let orderBy;
      switch (category) {
        case 'wins':
          orderBy = desc(users.totalWins);
          break;
        case 'spins':
          orderBy = desc(users.totalSpins);
          break;
        default:
          orderBy = desc(users.totalWins);
      }

      const leaders = await db
        .select({
          id: users.id,
          username: users.username,
          walletAddress: users.walletAddress,
          totalWins: users.totalWins,
          totalSpins: users.totalSpins,
          farcasterUsername: users.farcasterUsername,
          farcasterPfpUrl: users.farcasterPfpUrl
        })
        .from(users)
        .where(gte(users.totalSpins, 1))
        .orderBy(orderBy)
        .limit(limitCount);

      return leaders;
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      return [];
    }
  }

  async getPlayerRank(playerAddress: string, category: 'wins' | 'spins' | 'rewards' = 'wins') {
    try {
      const player = await db.select().from(users)
        .where(eq(users.walletAddress, playerAddress.toLowerCase()))
        .limit(1);

      if (player.length === 0) return null;

      let rankQuery;
      switch (category) {
        case 'wins':
          rankQuery = await db
            .select({ rank: sql<number>`COUNT(*) + 1` })
            .from(users)
            .where(sql`${users.totalWins} > ${player[0].totalWins}`);
          break;
        case 'spins':
          rankQuery = await db
            .select({ rank: sql<number>`COUNT(*) + 1` })
            .from(users)
            .where(sql`${users.totalSpins} > ${player[0].totalSpins}`);
          break;
        case 'rewards':
          const playerRewards = await db
            .select({ totalRewards: sql<string>`COALESCE(SUM(CAST(${spinResults.rewardAmount} AS NUMERIC)), 0)` })
            .from(spinResults)
            .where(and(eq(spinResults.userId, player[0].id), eq(spinResults.isWin, true)));

          rankQuery = await db.execute(sql`
            SELECT COUNT(*) + 1 as rank FROM (
              SELECT user_id, SUM(CAST(reward_amount AS NUMERIC)) as total_rewards
              FROM spin_results 
              WHERE is_win = true 
              GROUP BY user_id
              HAVING SUM(CAST(reward_amount AS NUMERIC)) > ${playerRewards[0]?.totalRewards || '0'}
            ) ranked_players
          `);
          break;
      }

      return {
        player: player[0],
        rank: Number((rankQuery as any)[0].rank),
        category
      };
    } catch (error) {
      console.error("Error getting player rank:", error);
      return null;
    }
  }

  async getWeeklyLeaderboard(limitCount = 10) {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      try {
        const weeklyLeaders = await db
          .select({
            userId: users.id,
            username: users.username,
            walletAddress: users.walletAddress,
            farcasterUsername: users.farcasterUsername,
            farcasterPfpUrl: users.farcasterPfpUrl,
            weeklyWins: sql<number>`COUNT(CASE WHEN ${spinResults.isWin} = true THEN 1 END)`.as('weeklyWins'),
            weeklySpins: sql<number>`COUNT(*)`.as('weeklySpins'),
            weeklyRewards: sql<string>`COALESCE(SUM(CASE WHEN ${spinResults.isWin} = true THEN CAST(${spinResults.rewardAmount} AS NUMERIC) ELSE 0 END), 0)`.as('weeklyRewards')
          })
          .from(users)
          .leftJoin(spinResults, and(eq(spinResults.userId, users.id), gte(spinResults.timestamp, oneWeekAgo)))
          .where(gte(users.totalSpins, 1))
          .groupBy(users.id, users.username, users.walletAddress, users.farcasterUsername, users.farcasterPfpUrl)
          .orderBy(desc(sql`COUNT(CASE WHEN ${spinResults.isWin} = true THEN 1 END)`))
          .limit(limitCount);

        return weeklyLeaders;
      } catch (weeklyError) {
        console.error("Weekly leaderboard query failed:", weeklyError);
        // Fallback to all-time data for now
        return this.getLeaderboard('wins', limitCount);
      }
    } catch (error) {
      console.error("Error getting weekly leaderboard:", error);
      return [];
    }
  }
}

export const leaderboardService = new LeaderboardService();