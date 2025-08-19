# ArbCasino - Farcaster Mini App

A casino-style slot machine game built exclusively for the Arbitrum blockchain network. Players can spin a virtual slot machine to win real tokens (AIDOGE, BOOP, CATCH) with automatic token distribution.

## Features

- **Token-Based Slot Machine**: Real token logos (AIDOGE, BOOP, CATCH) as slot symbols
- **Daily Spin Limits**: 5 spins per user per day with UTC midnight reset
- **Real Token Rewards**: Automatic distribution of actual tokens on Arbitrum
- **Win Detection**: Match 3 token logos to win that specific token
- **Leaderboard System**: Real-time ranking based on total wins
- **Admin Panel**: Token management and reward configuration
- **Mobile Optimized**: 390px width frame for Farcaster Mini Apps

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and config
│   │   └── pages/         # App pages
│   └── index.html
├── server/                # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Data layer
│   └── vite.ts           # Vite integration
├── shared/               # Shared types and schemas
│   └── schema.ts
├── attached_assets/      # Token logos and assets
└── package.json
```

## Token Integration

The app supports three Arbitrum tokens:

- **AIDOGE** (0x09e18590e8f76b6cf471b3cd75fe1a1a9d2b2c2b) - Fox logo
- **BOOP** (0x13a7dedb7169a17be92b0e3c7c2315b46f4772b3) - Dog logo  
- **CATCH** (0xbc4c97fb9befaa8b41448e1dfcc5236da543217f) - Geometric logo

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file with:
   ```
   DATABASE_URL=your_postgresql_url
   PRIVATE_KEY=your_wallet_private_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Access the App**
   - Main app: http://localhost:5000
   - Admin panel: http://localhost:5000/admin

## Game Logic

- **Spinning**: Generates 3 random token symbols
- **Winning**: All 3 symbols must match to win
- **Rewards**: Winners receive actual tokens via Arbitrum transactions
- **Limits**: 5 spins per user per day, resets at UTC midnight
- **Leaderboard**: Tracks total wins across all players

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL with Neon serverless
- **Blockchain**: Ethers.js for Arbitrum token transfers
- **UI Components**: shadcn/ui with Radix primitives

## Deployment

The app is configured for Replit deployment with automatic builds and hosting. Use the Deploy button in Replit to deploy to production.

## Admin Features

Access `/admin` to:
- View all registered tokens
- Add new tokens with addresses and reward amounts
- Toggle token active/inactive status
- Monitor game statistics

## API Endpoints

- `POST /api/user` - Create/get user
- `GET /api/user/:id` - Get user details
- `POST /api/spin` - Perform slot machine spin
- `GET /api/leaderboard` - Get top players
- `GET /api/stats` - Get game statistics
- `GET /api/tokens` - Get all tokens (admin)
- `POST /api/tokens` - Add new token (admin)

## Security Notes

- Private key is used for automatic token distribution
- All transactions are processed on Arbitrum mainnet
- Daily spin limits prevent abuse
- Input validation on all API endpoints

## License

MIT License - Built for Farcaster Mini App ecosystem