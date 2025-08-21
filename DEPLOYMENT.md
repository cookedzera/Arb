# SpinToClaimContract Deployment Guide

## Contract Information
- **Contract**: SpinToClaimContract.sol
- **Network**: Arbitrum Sepolia
- **Chain ID**: 421614
- **Solidity Version**: ^0.8.20

## Pre-deployment Setup

### 1. Contract Dependencies
The contract requires OpenZeppelin contracts:
- @openzeppelin/contracts/utils/Pausable.sol
- @openzeppelin/contracts/access/Ownable.sol
- @openzeppelin/contracts/token/ERC20/IERC20.sol
- @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol
- @openzeppelin/contracts/utils/ReentrancyGuard.sol
- @openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol

### 2. Constructor Parameters
- **_treasury**: `0x3b0287dDC6dD5a22862702dd2FB6E3Aa17429cB6`
- **_emergencyOperator**: `0xF539b9E0Be84F88368439aDb7aBeD0873e49414F`

## Deployment Steps

### Step 1: Deploy Contract
1. Open [Remix IDE](https://remix.ethereum.org/)
2. Import `contracts/SpinToClaimContract.sol`
3. Install OpenZeppelin dependencies
4. Compile with Solidity 0.8.20+
5. Connect MetaMask to Arbitrum Sepolia
6. Deploy with constructor parameters:
   - `_treasury`: `0x3b0287dDC6dD5a22862702dd2FB6E3Aa17429cB6`
   - `_emergencyOperator`: `0xF539b9E0Be84F88368439aDb7aBeD0873e49414F`

### Step 2: Configure Tokens
After deployment, configure each token using `configureToken()`:

```solidity
// Token 0: AIDOGE
configureToken(
    0, 
    0x09e18590e8f76b6cf471b3cd30676b46ef36f7cd,
    1000000000000000000,  // 1 token min reward
    10000000000000000000, // 10 tokens max reward
    true
);

// Token 1: BOOP  
configureToken(
    1,
    0x13a7dedb7169a17be92b0c1d7faf17c7b3,
    500000000000000000,   // 0.5 token min reward
    5000000000000000000,  // 5 tokens max reward
    true
);

// Token 2: ARB
configureToken(
    2,
    0x980b62da83eff3d4576c647993b0c1d7faf17c73,
    100000000000000000,   // 0.1 token min reward
    1000000000000000000,  // 1 token max reward
    true
);
```

### Step 3: Enable Contract
Call `unpause()` to enable the contract for use.

### Step 4: Update Configuration
Update `deployed-contracts.json` with the deployed contract address:

```json
{
  "contractAddress": "0x_YOUR_DEPLOYED_CONTRACT_ADDRESS",
  "status": "deployed"
}
```

## Post-deployment Verification

### Verify Contract State
1. Check `paused()` returns `false`
2. Verify `treasury()` returns correct address
3. Verify `emergencyOperator()` returns correct address
4. Check each token configuration with `getTokenConfig()`

### Test Basic Functions
1. Test `getUserStats()` with a wallet address
2. Test `getContractStats()` for overall status
3. Verify nonce tracking with `userNonces()`

## Environment Variables
Ensure these are set in your environment:
- `CLAIM_SIGNER_PRIVATE_KEY`: Private key for claim signature generation
- `SPIN_CLAIM_CONTRACT_ADDRESS`: Deployed contract address (optional)

## Security Notes
- Contract starts paused for safety
- Only owner can configure tokens and unpause
- Emergency operator can pause in emergencies
- Treasury receives 5% fee from all claims
- Nonce system prevents replay attacks