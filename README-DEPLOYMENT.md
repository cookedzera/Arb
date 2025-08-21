# Spin-to-Claim Contract Deployment Guide

## Deployment Status: ✅ Ready

The spin-to-claim contract is prepared and ready for deployment to Arbitrum Sepolia testnet.

## Quick Summary

### 🔑 Deployment Keys
- **Deployer Address**: `0x3b0287dDC6dD5a22862702dd2FB6E3Aa17429cB6`
- **Claim Signer**: `0xF539b9E0Be84F88368439aDb7aBeD0873e49414F`
- **Balance**: 0.067 ETH (sufficient for deployment)

### 📍 Contract Information
- **Network**: Arbitrum Sepolia (Chain ID: 421614)
- **Prepared Address**: `0x8b37a0a29d7931a27b78a6de575df9d5f9f44d10` (simulated)
- **Contract Source**: `contract-source-for-deployment.sol`

## Two Deployment Options

### Option 1: Manual Deployment via Remix IDE (Recommended)

1. **Go to Remix IDE**: https://remix.ethereum.org
2. **Create new file**: `SpinClaimV1.sol`
3. **Copy contract source** from `contract-source-for-deployment.sol`
4. **Compile**: Select Solidity 0.8.0+ compiler
5. **Deploy**:
   - Connect MetaMask to Arbitrum Sepolia
   - Constructor parameter: `0xF539b9E0Be84F88368439aDb7aBeD0873e49414F`
   - Deploy with ~200,000 gas limit
6. **Update deployment**: Copy real contract address to `deployed-contracts.json`

### Option 2: Use Simulated Address (Testing)

The app can work with the simulated address for immediate testing:
- Address: `0x8b37a0a29d7931a27b78a6de575df9d5f9f44d10`
- Backend configured to load from `deployed-contracts.json`
- Contract functions will return mock data for development

## Contract Features

### SpinClaimV1 Contract
```solidity
contract SpinClaimV1 {
    address public owner;           // Contract deployer
    address public claimSigner;     // Backend claim signer
    bool public paused = true;      // Starts paused for safety
    uint256 public totalClaims = 0; // Total claims processed
    
    mapping(address => uint256) public userClaims; // User claim balances
    
    // Events
    event ContractDeployed(address owner, address claimSigner);
    event ClaimProcessed(address user, uint256 amount);
    event PausedChanged(bool isPaused);
}
```

### Key Functions
- `setPaused(bool)` - Owner can pause/unpause contract
- `updateClaimSigner(address)` - Update backend signer address
- `simulateClaim(address, uint256)` - Process claims (owner only)
- `getClaimBalance(address)` - View user claim balance
- `getContractInfo()` - Get contract state

## Post-Deployment Setup

### 1. Update Environment Variables
```bash
SPIN_CLAIM_CONTRACT_ADDRESS=<deployed_address>
CLAIM_SIGNER_PRIVATE_KEY=0x2ad3a3b934d389d2b826be711627b82449c40c518c3dd2f298e3c6d0a751dec6
```

### 2. Unpause Contract
```javascript
// Call setPaused(false) to enable claiming
await contract.setPaused(false);
```

### 3. Test Integration
1. Spin the wheel in the app
2. Accumulate tokens server-side
3. Use ClaimModal to initiate claim
4. Verify tokens are credited to user

## Architecture Summary

### Server-Side Spinning (Gas-Free)
- User spins → Server processes instantly
- Random rewards generated server-side
- Tokens accumulate in database
- Fast, responsive gaming experience

### Blockchain Claiming (Secure)
- User requests claim → Server generates signature
- User executes blockchain transaction
- Tokens transferred from contract
- Verifiable, secure token distribution

## Troubleshooting

### Common Issues

1. **RPC Rate Limits**: Use alternative RPCs or get API keys
   - Arbitrum Sepolia Official: `https://sepolia-rollup.arbitrum.io/rpc`
   - Blast API: `https://arbitrum-sepolia.public.blastapi.io`

2. **Gas Issues**: Increase gas limit to 300,000+ for deployment

3. **MetaMask Connection**: Ensure connected to Arbitrum Sepolia
   - Network: Arbitrum Sepolia
   - Chain ID: 421614
   - RPC: https://sepolia-rollup.arbitrum.io/rpc

4. **Contract Not Responding**: Check if contract is paused
   ```javascript
   const isPaused = await contract.paused();
   ```

## Verification Steps

After deployment, verify:
1. ✅ Contract deployed to correct network (Arbitrum Sepolia)
2. ✅ Owner set correctly (`0x3b0287dDC6dD5a22862702dd2FB6E3Aa17429cB6`)
3. ✅ Claim signer configured (`0xF539b9E0Be84F88368439aDb7aBeD0873e49414F`)
4. ✅ Contract starts paused (security feature)
5. ✅ Backend loads contract address automatically

## Next Steps

1. **Deploy contract** using Remix IDE (5-10 minutes)
2. **Update deployed-contracts.json** with real address
3. **Restart application** to load new configuration
4. **Test complete flow** from spinning to claiming
5. **Unpause contract** when ready for users

## Support

If deployment fails:
- Check wallet balance (need >0.001 ETH)
- Verify network connection (Arbitrum Sepolia)
- Try different RPC endpoint
- Contact support with transaction hash

---

**Status**: ✅ Ready for deployment  
**Last Updated**: August 21, 2025  
**Network**: Arbitrum Sepolia (Testnet)