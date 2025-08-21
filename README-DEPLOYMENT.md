# Spin-to-Claim Contract Deployment Guide

## Overview

This project includes a secure claim contract for Arbitrum Sepolia that allows users to claim tokens they've won from server-based spinning. The architecture separates concerns:

- **Spinning**: Server-based, gas-free, fast gameplay
- **Claiming**: Blockchain-based token distribution with security

## Architecture

### Server-Side Spinning (Gas-Free)
- Users spin wheel on server
- Results stored in database  
- Tokens accumulate in user accounts
- No gas costs, instant feedback

### Blockchain Claiming (Secure)
- Users connect wallet to claim accumulated tokens
- Server generates signed claim authorization
- Users execute blockchain transaction
- Tokens transferred from contract to wallet

## Smart Contract Features

### SpinToClaimContract.sol
✅ **Security Features:**
- Pausable/unpausable for emergencies
- Owner and emergency operator controls
- User blacklist functionality
- Reentrancy protection
- Daily spin limits and cooldowns
- Anti-bot protection

✅ **Token Management:**
- Support for up to 10 different reward tokens
- Configurable min/max reward amounts per token
- Token activation/deactivation
- Real-time balance checking

✅ **Claim System:**
- Server-signed claim authorization
- Nonce-based replay protection
- 24-hour claim deadline
- Treasury fee collection (5% configurable)
- Claim verification and recording

## Deployment Steps

### 1. Prerequisites

```bash
# Install dependencies (already included)
npm install

# Set up environment variables
export PRIVATE_KEY="your_deployer_private_key"
export CLAIM_SIGNER_PRIVATE_KEY="your_claim_signer_key"  
export ARBISCAN_API_KEY="your_arbiscan_api_key"
```

### 2. Get Testnet ETH

1. **Get Sepolia ETH**: Use a faucet like sepoliafaucet.com
2. **Bridge to Arbitrum Sepolia**: 
   - Go to bridge.arbitrum.io
   - Bridge ETH from Sepolia to Arbitrum Sepolia
   - Wait 10-30 minutes for bridging

### 3. Deploy Contracts

```bash
# Run deployment script
node scripts/deploy-claim-contract.js

# This will generate hardhat.config.js and deployed-contracts.json
```

### 4. Compile and Deploy with Hardhat

```bash
# Install Hardhat (if not already installed)
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Compile contracts
npx hardhat compile

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/deploy-claim-contract.js --network arbitrumSepolia

# Verify contract on Arbiscan
npx hardhat verify <CONTRACT_ADDRESS> "TREASURY_ADDRESS" "EMERGENCY_OPERATOR" --network arbitrumSepolia
```

### 5. Configure Tokens

After deployment, configure reward tokens:

```javascript
// Example: Configure USDC as Token 0
await contract.configureToken(
  0,                                    // Token ID
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC Arbitrum Sepolia
  ethers.parseUnits("1", 6),           // Min reward: 1 USDC
  ethers.parseUnits("100", 6),         // Max reward: 100 USDC  
  true                                 // Active
);
```

### 6. Fund Contract

Transfer reward tokens to the contract:

```javascript
// Transfer tokens to contract for distribution
await usdcToken.transfer(contractAddress, ethers.parseUnits("10000", 6));
```

### 7. Unpause Contract

```javascript
// Enable claiming (starts paused for safety)
await contract.unpause();
```

## Testing

### Test Token Deployment

```bash
# Deploy test ERC20 tokens for testing
npx hardhat run scripts/deploy-test-tokens.js --network arbitrumSepolia
```

### Contract Testing

```bash
# Run contract tests
npx hardhat test

# Test on local network first
npx hardhat node
npx hardhat run scripts/deploy-claim-contract.js --network localhost
```

## Integration

### Backend Integration

The server automatically integrates with the deployed contract:

1. **Contract Detection**: Reads `deployed-contracts.json`
2. **Claim Routes**: `/api/claim/*` endpoints for claim functionality
3. **User Balances**: Tracks accumulated vs claimed tokens
4. **Signature Generation**: Server signs claim authorizations

### Frontend Integration

The ClaimModal component handles the user experience:

1. **Wallet Connection**: Users connect wallet via Farcaster or direct connection
2. **Balance Display**: Shows accumulated claimable tokens
3. **Claim Process**: Guides users through blockchain transaction
4. **Transaction Tracking**: Monitors claim success/failure

## Configuration

### Environment Variables

```bash
# Required for deployment
PRIVATE_KEY=0x...                    # Deployer private key
CLAIM_SIGNER_PRIVATE_KEY=0x...       # Server claim signing key
ARBISCAN_API_KEY=...                 # For contract verification

# Optional
SPIN_CLAIM_CONTRACT_ADDRESS=0x...    # Auto-set after deployment
TOKEN1_ADDRESS=0x...                 # Token addresses
TOKEN2_ADDRESS=0x...
TOKEN3_ADDRESS=0x...
```

### Contract Parameters

```solidity
// Adjustable parameters
uint256 public constant MAX_TOKENS = 10;           // Max token types
uint256 public constant MIN_SPIN_INTERVAL = 1;     // Blocks between spins
uint256 public constant CLAIM_DEADLINE = 24 hours; // Claim expiry
uint256 public constant MAX_DAILY_SPINS = 10;      // Daily spin limit
uint256 public treasuryFeePercent = 5;             // 5% treasury fee
```

## Security Considerations

### Access Controls
- **Owner**: Full contract control, can pause/configure
- **Emergency Operator**: Can pause contract only
- **Treasury**: Receives fee distributions

### Rate Limiting
- **1 block minimum** between spins (anti-spam)
- **10 spins maximum** per day per user
- **24-hour deadline** for claim execution

### Anti-Bot Protection
- **tx.origin check**: Prevents contract-based attacks
- **User blacklist**: Manual bot mitigation
- **Signature verification**: Prevents unauthorized claims

## Monitoring

### Events
- `SpinExecuted`: Track spin results
- `TokensClaimed`: Monitor successful claims  
- `EmergencyModeToggled`: Alert on pause/unpause
- `TokenConfigured`: Track token config changes

### Metrics
- Daily active users
- Claim success rate
- Token distribution amounts
- Contract balance monitoring

## Troubleshooting

### Common Issues

1. **"Contract paused"**: Contract starts paused - call `unpause()`
2. **"Insufficient balance"**: Fund contract with reward tokens
3. **"Invalid signature"**: Check claim signer private key setup
4. **"Daily limit reached"**: User hit 10 spins per day limit

### Debug Commands

```bash
# Check contract status
npx hardhat console --network arbitrumSepolia
> const contract = await ethers.getContractAt("SpinToClaimContract", "CONTRACT_ADDRESS")
> await contract.paused()
> await contract.getContractStats()

# Check user stats  
> await contract.getUserStats("USER_ADDRESS")
```

## Gas Optimization

The contract is optimized for Arbitrum's L2 environment:

- **Via IR compilation**: Better optimization
- **Packed structs**: Reduced storage costs
- **Minimal external calls**: Lower transaction costs
- **Batch operations**: Where possible

Expected gas costs on Arbitrum Sepolia:
- **Claim transaction**: ~50,000-80,000 gas
- **Configure token**: ~30,000-50,000 gas
- **Pause/unpause**: ~20,000-30,000 gas

## Next Steps

1. **Deploy contracts** to Arbitrum Sepolia
2. **Configure test tokens** for initial testing
3. **Test claim flow** end-to-end
4. **Monitor contract** performance and security
5. **Scale to mainnet** after thorough testing

For production deployment to Arbitrum mainnet, conduct a comprehensive security audit and implement additional monitoring systems.