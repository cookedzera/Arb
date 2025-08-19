# Overview

ArbCasino is a web-based Wheel of Fortune game implemented as a Farcaster Mini App for the Arbitrum Sepolia testnet. Users can spin a virtual wheel daily to win IARB, JUICE, and ABET tokens. The application integrates smart contracts for real token rewards, tracks pending rewards, and provides a comprehensive claiming system. The vision is to offer a transparent and engaging crypto gaming experience with direct on-chain interaction.

# User Preferences

Preferred communication style: Simple, everyday language.
Code preferences: Clean, production-ready code without testing/debug code.
Project focus: Fully Replit-compatible without external dependencies like tsx.
Navigation preferences: Fast, smooth transitions without loading animations between pages.
UI preferences: Token collection display with real balances instead of accumulated rewards on profile.
Gas fee preference: Users should pay their own gas fees for both spinning and claiming transactions, not the project wallet.
Database preference: Supabase for external deployment, scalable for 200-400 users. **MIGRATED**: App successfully moved to Supabase database with permanent connection (August 18, 2025).

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite.
- **Routing**: Wouter.
- **UI Framework**: Tailwind CSS with shadcn/ui components.
- **Styling**: Casino-themed dark mode with neon effects and retro gaming aesthetics.
- **Animations**: Framer Motion for slot machine spin animations and visual feedback.
- **State Management**: TanStack Query (React Query) for server state management.
- **Form Handling**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Smart center display for winning results, smooth navigation with Farcaster profile caching, and a typewriter brand animation in the header. Optimized for 390px width Farcaster Mini App standard with a mobile-first responsive design.

## Backend Architecture
- **Runtime**: Node.js with Express.js server.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful endpoints for user management, spinning mechanics, and leaderboard.
- **Session Management**: In-memory storage with PostgreSQL migration.
- **Error Handling**: Centralized error handling.

## Database Schema
- **Database**: Supabase (PostgreSQL) with transaction pooler for optimal performance.
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Tables**: `users` (player profiles, Farcaster data, spin counts, wallet addresses, token balances), `tokens` (configurations), `game_stats` (daily aggregated statistics), `spin_results` (individual spin outcomes), `token_claims` (token claim requests).
- **Data Validation**: Zod schemas for type-safe operations.
- **Connection**: Transaction pooler (port 6543) for concurrent user handling.

## Game Logic
- **Spin Mechanics**: Smart contract-based wheel spinning with 8 segments (IARB, JUICE, ABET, BONUS, JACKPOT, BUST).
- **Rate Limiting**: 5 spins per user per day enforced by smart contract.
- **Reward System**: Real token rewards with contract-managed pending balances and individual token claiming.
- **Token Types**: IARB, JUICE, ABET with BONUS (2x) and JACKPOT (10x) multipliers.
- **Claim System**: Users can claim accumulated rewards directly from smart contract to their wallet via a single "Claim All" button after all daily spins.

## Farcaster Integration
- **Mini App SDK**: @farcaster/miniapp-sdk for native Farcaster functionality.
- **Authentication**: Quick Auth with JWT verification.
- **User Profiles**: Utilizes Farcaster user data (FID, username, display name, profile pictures) via Hub API integration.
- **Backend Verification**: Server-side token validation.

# External Dependencies

## Database
- **Supabase**: Serverless PostgreSQL.
- **Drizzle Kit**: Database migrations and schema management.

## Security
- **Arbitrum Sepolia**: Testnet for blockchain interactions.

## UI Components
- **Radix UI**: Accessible, unstyled React components.
- **Class Variance Authority**: Type-safe utility for component variants.
- **Tailwind CSS**: Utility-first CSS framework.

## Development Tools
- **ESBuild**: Fast TypeScript compilation.
- **PostCSS**: CSS processing.

## Animation Libraries
- **Framer Motion**: Production-ready motion library.

## Utility Libraries
- **date-fns**: Date manipulation.
- **clsx**: Conditional className utility.
- **nanoid**: Secure random ID generation.
- **wagmi**: For user wallet transactions and contract interactions.