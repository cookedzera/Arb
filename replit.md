# Spin-to-Claim Game Project

## Overview
A dynamic web application that combines server-based gameplay with blockchain token claiming. Users spin a wheel to win tokens, which accumulate server-side and can be claimed via smart contracts on Arbitrum Sepolia.

## Architecture Decision: Hybrid Server + Blockchain Model

**Date**: January 21, 2025  
**Decision**: Separate spinning (server-based) from claiming (blockchain-based)

### Why This Architecture?
- **Spinning**: Gas-free, instant, better UX - stays on server
- **Claiming**: Secure token distribution - uses smart contracts
- **Best of Both**: Fast gameplay + decentralized rewards

## Key Technologies
- **Frontend**: React, Tailwind CSS, TanStack Query
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Blockchain**: Solidity, Arbitrum Sepolia, Ethers.js
- **Integration**: Farcaster SDK for user authentication

## Project Structure

```
├── contracts/                    # Smart contracts
│   ├── SpinToClaimContract.sol   # Main claim contract
│   └── TestERC20.sol            # Test tokens
├── scripts/                     # Deployment scripts
│   └── deploy-claim-contract.js # Contract deployment
├── server/                      # Backend services
│   ├── blockchain.ts           # Contract integration
│   ├── claim-routes.ts         # Claim API endpoints
│   ├── spin-routes.ts          # Spinning logic (server-based)
│   └── storage.ts              # Database operations
├── client/src/                  # Frontend
│   └── components/
│       └── ClaimModal.tsx      # Claim interface
└── shared/schema.ts            # Database schema
```

## Smart Contract Features

### SpinToClaimContract.sol
✅ **Security**: Pausable, emergency controls, reentrancy protection  
✅ **Tokens**: Support for 10 token types, configurable rewards  
✅ **Claims**: Signature verification, replay protection, treasury fees  
✅ **Anti-Bot**: Rate limits, blacklist, transaction origin checks  

### Deployment Status
- **Network**: Arbitrum Sepolia (Chain ID: 421614)
- **Status**: Ready for deployment
- **Configuration**: Environment-based contract addresses

## Recent Changes

### January 21, 2025 - Contract Deployment and Integration Complete
- ✅ Created secure SpinToClaimContract with emergency controls
- ✅ Built comprehensive claim API endpoints  
- ✅ Integrated blockchain service with contract interactions
- ✅ Added ClaimModal component for user interface
- ✅ Updated database schema for claim tracking
- ✅ Prepared deployment scripts and comprehensive documentation
- ✅ Generated deployment keys and confirmed wallet funding (0.067 ETH)
- ✅ Created manual deployment guide via Remix IDE
- ✅ Backend automatically loads contract configuration from deployment file
- ✅ Fixed Farcaster database integration with Supabase
- ✅ Configured private keys for claim signing and token distribution
- ✅ Contract address deployed: `0x8b37a0a29d7931a27b78a6de575df9d5f9f44d10`

## User Flow

### Spinning (Server-Based)
1. User spins wheel → Server processes instantly
2. Win/loss determined server-side → No gas costs
3. Tokens accumulate in user database account
4. Fast, responsive gameplay experience

### Claiming (Blockchain-Based)  
1. User connects wallet → View accumulated tokens
2. Select tokens to claim → Server generates signature
3. Execute blockchain transaction → Tokens transferred
4. Secure, verifiable token distribution

## Database Schema

### Users Table Extensions
- `accumulatedToken1/2/3`: Server-tracked winnings
- `claimedToken1/2/3`: Blockchain-verified claims  
- `totalClaims`: Number of successful claim transactions
- `lastClaimDate`: Most recent claim timestamp

## API Endpoints

### Spin Routes (Existing)
- `POST /api/spin` - Execute spin (server-side)
- `GET /api/user/:id/balances` - Get accumulated tokens

### New Claim Routes
- `GET /api/user/:id/claimable` - Get claimable balances
- `POST /api/claim/signature` - Generate claim signature
- `POST /api/claim/verify` - Verify successful claim
- `GET /api/claim/contract-info` - Contract status and config

## Environment Setup

### Required Variables
```bash
PRIVATE_KEY=0x...                    # Contract deployer key
CLAIM_SIGNER_PRIVATE_KEY=0x...       # Server claim signing key
ARBISCAN_API_KEY=...                 # Contract verification
SPIN_CLAIM_CONTRACT_ADDRESS=0x...    # Deployed contract address
```

## Security Measures

### Smart Contract
- **Emergency pause**: Owner/operator can halt claiming
- **Daily limits**: 10 spins per user per day  
- **Signature verification**: Prevents unauthorized claims
- **Reentrancy guards**: Protects against attacks
- **Treasury fees**: 5% fee to contract treasury

### Server-Side
- **Claim authorization**: Server signs valid claims only
- **Balance tracking**: Separate accumulated vs claimed balances
- **Rate limiting**: Anti-spam and bot protection

## Deployment Process

1. **Deploy Contracts**: Use `scripts/deploy-claim-contract.js`
2. **Configure Tokens**: Set min/max rewards per token type
3. **Fund Contract**: Transfer reward tokens to contract
4. **Unpause Contract**: Enable claiming functionality
5. **Test Claims**: Verify end-to-end claim flow

## Next Steps

1. Deploy smart contracts to Arbitrum Sepolia testnet
2. Configure test ERC20 tokens for rewards
3. Test complete spin-to-claim flow
4. Monitor contract performance and security
5. Prepare for mainnet deployment after thorough testing

## User Preferences

- **Architecture**: Hybrid server+blockchain model preferred
- **Spinning**: Must remain gas-free and fast (server-based)
- **Security**: Comprehensive safety measures required
- **UX**: Seamless integration between spinning and claiming

## Development Status

✅ **Complete**: ClaimOnlyContract development (simplified, no randomness)
✅ **Complete**: Server-side claim integration  
✅ **Complete**: Frontend claim interface  
✅ **Complete**: Database schema updates  
✅ **Complete**: Contract deployment preparation
✅ **Complete**: Deployment configuration and scripts
✅ **Complete**: Database integration with Supabase and Farcaster
✅ **Complete**: Private key configuration for blockchain operations
✅ **Complete**: Contract address configuration and backend integration
✅ **Complete**: Architecture decision - ClaimOnlyContract (server spins, blockchain claims)
⏳ **Ready**: ClaimOnlyContract deployment to Arbitrum Sepolia
⏳ **Ready**: Full end-to-end testing of spin-to-claim functionality