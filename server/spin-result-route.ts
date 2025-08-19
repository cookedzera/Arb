import { Request, Response } from 'express';
import { ethers } from 'ethers';

// This endpoint parses transaction receipts to extract spin results
// when users execute spins directly from their wallets
export async function handleSpinResult(req: Request, res: Response) {
  try {
    const { transactionHash, userId, userAddress } = req.body;
    
    if (!transactionHash) {
      return res.status(400).json({ error: 'Transaction hash required' });
    }
    
    console.log(`🔍 Parsing spin result for transaction: ${transactionHash}`);
    
    // Connect to Arbitrum Sepolia to read transaction receipt
    const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
    
    try {
      const receipt = await provider.getTransactionReceipt(transactionHash);
      
      if (!receipt) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // Parse logs for SpinResult event
      const contractAddress = process.env.DEPLOYED_CONTRACT_ADDRESS;
      const spinEvent = receipt.logs.find(log => 
        log.address.toLowerCase() === contractAddress?.toLowerCase()
      );
      
      if (spinEvent && spinEvent.data && spinEvent.topics) {
        // Decode the SpinResult event
        // This is a simplified version - in production you'd use the full ABI
        const abiCoder = new ethers.AbiCoder();
        
        // SpinResult(address indexed player, string segment, bool isWin, address tokenAddress, uint256 rewardAmount, uint256 randomSeed)
        const decodedData = abiCoder.decode(
          ['string', 'bool', 'address', 'uint256', 'uint256'],
          spinEvent.data
        );
        
        const result = {
          segment: decodedData[0],
          isWin: decodedData[1],
          tokenAddress: decodedData[2],
          rewardAmount: decodedData[3].toString(),
          randomSeed: decodedData[4].toString(),
          transactionHash
        };
        
        console.log(`✅ Parsed spin result:`, result);
        
        // Update user stats in database if needed
        // This would track the spin without executing it
        
        return res.json(result);
      } else {
        // No spin event found, return default
        return res.json({
          segment: 'UNKNOWN',
          isWin: false,
          tokenAddress: null,
          rewardAmount: '0',
          transactionHash
        });
      }
      
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return res.status(500).json({ error: 'Failed to parse transaction' });
    }
    
  } catch (error) {
    console.error('Spin result endpoint error:', error);
    res.status(500).json({ error: 'Failed to get spin result' });
  }
}