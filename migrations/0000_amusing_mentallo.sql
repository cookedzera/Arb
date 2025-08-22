CREATE TABLE "game_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp DEFAULT now(),
	"total_claims" integer DEFAULT 0,
	"contract_txs" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "spin_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"symbols" jsonb,
	"is_win" boolean DEFAULT false,
	"reward_amount" text DEFAULT '0',
	"token_type" text,
	"token_id" varchar,
	"token_address" text,
	"is_accumulated" boolean DEFAULT true,
	"claim_type" text,
	"transaction_hash" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "token_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"token1_amount" text DEFAULT '0',
	"token2_amount" text DEFAULT '0',
	"token3_amount" text DEFAULT '0',
	"total_value_usd" text DEFAULT '0',
	"transaction_hash" text,
	"status" text DEFAULT 'pending',
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "token_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"token_name" text NOT NULL,
	"token_symbol" text NOT NULL,
	"token_address" text,
	"description" text,
	"votes" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"last_voted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"decimals" integer DEFAULT 18,
	"is_active" boolean DEFAULT true,
	"reward_amount" integer DEFAULT 100,
	CONSTRAINT "tokens_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"wallet_address" text,
	"farcaster_fid" integer,
	"farcaster_username" text,
	"farcaster_display_name" text,
	"farcaster_pfp_url" text,
	"farcaster_bio" text,
	"spins_used" integer DEFAULT 0,
	"total_wins" integer DEFAULT 0,
	"total_spins" integer DEFAULT 0,
	"last_spin_date" timestamp,
	"accumulated_token1" text DEFAULT '0',
	"accumulated_token2" text DEFAULT '0',
	"accumulated_token3" text DEFAULT '0',
	"claimed_token1" text DEFAULT '0',
	"claimed_token2" text DEFAULT '0',
	"claimed_token3" text DEFAULT '0',
	"last_claim_date" timestamp,
	"total_claims" integer DEFAULT 0,
	"is_temporary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "spin_results" ADD CONSTRAINT "spin_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_results" ADD CONSTRAINT "spin_results_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_claims" ADD CONSTRAINT "token_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_votes" ADD CONSTRAINT "token_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;