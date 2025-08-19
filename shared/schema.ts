import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  walletAddress: text("wallet_address"),
  farcasterFid: integer("farcaster_fid"),
  farcasterUsername: text("farcaster_username"),
  farcasterDisplayName: text("farcaster_display_name"),
  farcasterPfpUrl: text("farcaster_pfp_url"),
  farcasterBio: text("farcaster_bio"),
  spinsUsed: integer("spins_used").default(0), // Now max 3 per day
  totalWins: integer("total_wins").default(0),
  totalSpins: integer("total_spins").default(0),
  lastSpinDate: timestamp("last_spin_date"),
  // Accumulated token balances (pending claim)
  accumulatedToken1: text("accumulated_token1").default("0"), // Store as string to handle large numbers
  accumulatedToken2: text("accumulated_token2").default("0"),
  accumulatedToken3: text("accumulated_token3").default("0"),
  // Claimed token balances (already transferred)
  claimedToken1: text("claimed_token1").default("0"),
  claimedToken2: text("claimed_token2").default("0"),
  claimedToken3: text("claimed_token3").default("0"),
  lastClaimDate: timestamp("last_claim_date"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const gameStats = pgTable("game_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").default(sql`now()`),
  totalClaims: integer("total_claims").default(0),
  contractTxs: integer("contract_txs").default(0),
});

export const tokens = pgTable("tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  decimals: integer("decimals").default(18),
  isActive: boolean("is_active").default(true),
  rewardAmount: integer("reward_amount").default(100), // Base reward amount in wei
});

export const spinResults = pgTable("spin_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  symbols: jsonb("symbols").$type<string[]>(),
  isWin: boolean("is_win").default(false),
  rewardAmount: text("reward_amount").default("0"), // Changed to text for large numbers
  tokenType: text("token_type"), // TOKEN1, TOKEN2, TOKEN3
  tokenId: varchar("token_id").references(() => tokens.id),
  tokenAddress: text("token_address"),
  isAccumulated: boolean("is_accumulated").default(true), // True = pending claim, False = claimed
  claimType: text("claim_type"), // 'single' or 'batch'
  transactionHash: text("transaction_hash"), // Only set when actually claimed
  timestamp: timestamp("timestamp").default(sql`now()`),
});

// New table for tracking claims
export const tokenClaims = pgTable("token_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  token1Amount: text("token1_amount").default("0"),
  token2Amount: text("token2_amount").default("0"), 
  token3Amount: text("token3_amount").default("0"),
  totalValueUSD: text("total_value_usd").default("0"),
  transactionHash: text("transaction_hash"),
  status: text("status").default("pending"), // pending, confirmed, failed
  timestamp: timestamp("timestamp").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertGameStatsSchema = createInsertSchema(gameStats).omit({
  id: true,
  date: true,
});

export const insertTokenSchema = createInsertSchema(tokens).omit({
  id: true,
});

export const insertSpinResultSchema = createInsertSchema(spinResults).omit({
  id: true,
  timestamp: true,
});

export const insertTokenClaimSchema = createInsertSchema(tokenClaims).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGameStats = z.infer<typeof insertGameStatsSchema>;
export type GameStats = typeof gameStats.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokens.$inferSelect;
export type InsertSpinResult = z.infer<typeof insertSpinResultSchema>;
export type SpinResult = typeof spinResults.$inferSelect;
export type InsertTokenClaim = z.infer<typeof insertTokenClaimSchema>;
export type TokenClaim = typeof tokenClaims.$inferSelect;
