import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Coins, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseEther } from 'viem';
import { arbitrumSepolia } from 'wagmi/chains';
import { CLAIM_CONTRACT_ABI } from '@/lib/claim-contract-abi';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  walletAddress?: string;
}

export function ClaimModal({ isOpen, onClose, userId, walletAddress }: ClaimModalProps) {
  const [selectedToken, setSelectedToken] = useState(0);
  const [claimAmount, setClaimAmount] = useState('0');
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Wagmi hooks for Farcaster wallet integration
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get claimable balances
  const { data: claimableData, isLoading: loadingBalances } = useQuery<{
    token1: string;
    token2: string;
    token3: string;
    totalClaimable: string;
  }>({
    queryKey: ['/api/user', userId, 'claimable'],
    enabled: isOpen && !userId.startsWith('temp_')
  });

  // Get contract info  
  const { data: contractInfo, isLoading: loadingContract } = useQuery<{
    contractAddress?: string;
    isConfigured?: boolean;
    isPaused?: boolean;
    tokens?: any[];
  }>({
    queryKey: ['/api/claim/contract-info'],
    enabled: isOpen
  });

  // Generate signature mutation
  const generateSignature = useMutation({
    mutationFn: async (data: { tokenId: number; amount: string; walletAddress: string }) => {
      const response = await fetch('/api/claim/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }
  });

  // Generate batch signatures mutation
  const generateBatchSignatures = useMutation({
    mutationFn: async (data: { claims: Array<{ tokenId: number; amount: string }>; walletAddress: string }) => {
      const response = await fetch('/api/claim/batch-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to generate claim signatures';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return response.json();
    }
  });

  // Handle Farcaster wallet connection
  const handleConnect = async () => {
    if (connectors[0]) {
      await connect({ connector: connectors[0] });
    }
  };

  // Handle claiming all tokens using batch claim
  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    
    if (!isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Connect your Farcaster wallet to claim tokens",
        variant: "destructive"
      });
      setIsClaimingAll(false);
      return;
    }

    // Check if we need to switch to Arbitrum Sepolia
    if (chainId !== arbitrumSepolia.id) {
      try {
        toast({
          title: "Switching Network",
          description: "Switching to Arbitrum Sepolia..."
        });
        
        await switchChain({ chainId: arbitrumSepolia.id });
        
        toast({
          title: "Network Switched",
          description: "Successfully switched to Arbitrum Sepolia"
        });
      } catch (error: any) {
        toast({
          title: "Network Switch Failed",
          description: error.message || "Failed to switch to Arbitrum Sepolia",
          variant: "destructive"
        });
        setIsClaimingAll(false);
        return;
      }
    }

    // Check if user has any tokens to claim
    const hasTokens = claimableData && (
      parseFloat(claimableData.token1) > 0 || 
      parseFloat(claimableData.token2) > 0 || 
      parseFloat(claimableData.token3) > 0
    );

    if (!hasTokens) {
      toast({
        title: "No Tokens to Claim",
        description: "You don't have any tokens available to claim",
        variant: "destructive"
      });
      setIsClaimingAll(false);
      return;
    }

    try {
      // Prepare claims for tokens with balance > 0
      const claims = [];
      
      if (parseFloat(claimableData!.token1) > 0) {
        claims.push({ tokenId: 0, amount: claimableData!.token1 });
      }
      if (parseFloat(claimableData!.token2) > 0) {
        claims.push({ tokenId: 1, amount: claimableData!.token2 });
      }
      if (parseFloat(claimableData!.token3) > 0) {
        claims.push({ tokenId: 2, amount: claimableData!.token3 });
      }

      toast({
        title: "Preparing Claims",
        description: `Generating signatures for ${claims.length} token types...`
      });

      // Generate batch signatures with proper nonce sequence
      const batchData = await generateBatchSignatures.mutateAsync({
        claims,
        walletAddress: address
      });

      // Execute batch claim transaction
      toast({
        title: "Confirm Transaction",
        description: "Please confirm the batch claim transaction in your wallet"
      });

      console.log("🔍 About to execute batch claim with data:", {
        contractAddress: contractInfo?.contractAddress,
        claimRequests: batchData.claimRequests.map((req: any) => ({
          user: req.user,
          tokenId: req.tokenId,
          amount: req.amount,
          nonce: req.nonce,
          deadline: req.deadline
        }))
      });

      await writeContract({
        address: contractInfo?.contractAddress as `0x${string}`,
        abi: CLAIM_CONTRACT_ABI,
        functionName: 'batchClaimTokens',
        args: [batchData.claimRequests],
      });

    } catch (error: any) {
      let errorMessage = error.message || "Failed to claim tokens";
      
      // Handle specific error types
      if (errorMessage.includes("nonce")) {
        errorMessage = "Transaction nonce conflict. Please wait a moment and try again.";
      } else if (errorMessage.includes("User rejected") || errorMessage.includes("denied")) {
        errorMessage = "Transaction cancelled by user";
      } else if (errorMessage.includes("insufficient balance")) {
        errorMessage = "Contract has insufficient token balance. Please contact support.";
      } else if (errorMessage.includes("gas")) {
        errorMessage = "Transaction failed due to gas issues. Try again with higher gas.";
      }
      
      console.error("Batch claim error details:", error);
      
      toast({
        title: "Batch Claim Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
    
    setIsClaimingAll(false);
  };

  // Helper function to claim a single token
  const claimSingleToken = async (tokenId: number, amount: string) => {
    // Generate claim signature from server
    const signatureData = await generateSignature.mutateAsync({
      tokenId,
      amount,
      walletAddress: address!
    });

    // Execute transaction through Farcaster wallet
    await writeContract({
      address: contractInfo?.contractAddress as `0x${string}`,
      abi: CLAIM_CONTRACT_ABI,
      functionName: 'claimTokens',
      args: [signatureData.claimRequest],
    });
  };

  // Handle claim with Farcaster wallet (single token)
  const handleClaim = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Connect your Farcaster wallet to claim tokens",
        variant: "destructive"
      });
      return;
    }

    // Check if we need to switch to Arbitrum Sepolia
    if (chainId !== arbitrumSepolia.id) {
      try {
        toast({
          title: "Switching Network",
          description: "Switching to Arbitrum Sepolia..."
        });
        
        await switchChain({ chainId: arbitrumSepolia.id });
        
        toast({
          title: "Network Switched",
          description: "Successfully switched to Arbitrum Sepolia"
        });
      } catch (error: any) {
        toast({
          title: "Network Switch Failed",
          description: error.message || "Failed to switch to Arbitrum Sepolia",
          variant: "destructive"
        });
        return;
      }
    }

    if (!claimAmount || parseFloat(claimAmount) <= 0) {
      toast({
        title: "Invalid Amount", 
        description: "Please enter a valid amount to claim",
        variant: "destructive"
      });
      return;
    }

    try {
      // Generate claim signature from server
      toast({
        title: "Preparing Claim",
        description: "Generating claim signature..."
      });

      const signatureData = await generateSignature.mutateAsync({
        tokenId: selectedToken,
        amount: claimAmount,
        walletAddress: address
      });

      // Execute transaction through Farcaster wallet
      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet"
      });

      await writeContract({
        address: contractInfo?.contractAddress as `0x${string}`,
        abi: CLAIM_CONTRACT_ABI,
        functionName: 'claimTokens',
        args: [signatureData.claimRequest],
      });

    } catch (error: any) {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to prepare claim",
        variant: "destructive"
      });
    }
  };

  if (!isOpen) return null;

  // Loading state
  if (loadingBalances || loadingContract) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-claim">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading claim information...</span>
          </div>
        </div>
      </div>
    );
  }

  // Temp user state
  if (userId.startsWith('temp_')) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-claim">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Claim Tokens</h2>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Connect with Farcaster to start accumulating tokens that you can claim!
            </p>
          </div>
          <Button onClick={onClose} className="w-full" data-testid="button-close">
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Contract not configured
  if (!contractInfo || !contractInfo.isConfigured) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-claim">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Claim Tokens</h2>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              The claim contract is not yet deployed. Please check back later!
            </p>
          </div>
          <Button onClick={onClose} className="w-full" data-testid="button-close">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const claimable = claimableData || { token1: '0', token2: '0', token3: '0', totalClaimable: '0' };
  const tokenOptions = ['Token 1', 'Token 2', 'Token 3'];
  const amounts = [claimable.token1, claimable.token2, claimable.token3];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-claim">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Claim Your Tokens</h2>
        </div>

        <div className="space-y-4">
          {/* Network info */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Network:</span>
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs">
              Arbitrum Sepolia
            </span>
          </div>

          {/* Token selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Token:</label>
            <div className="space-y-2">
              {tokenOptions.map((name, index) => {
                const balance = amounts[index];
                const hasBalance = parseFloat(balance) > 0;
                
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (hasBalance) {
                        setSelectedToken(index);
                        setClaimAmount(balance);
                      }
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedToken === index 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    } ${!hasBalance ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!hasBalance}
                    data-testid={`button-select-token-${index}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{name}</span>
                      <span className="text-sm font-mono">{balance}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium mb-2">Amount to Claim:</label>
            <input
              type="number"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Enter amount"
              step="0.000001"
              max={amounts[selectedToken]}
              data-testid="input-claim-amount"
            />
          </div>

          {/* Contract address */}
          {contractInfo?.contractAddress && (
            <div className="text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>Contract:</span>
                <a
                  href={`https://sepolia.arbiscan.io/address/${contractInfo.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  {contractInfo.contractAddress.slice(0, 8)}...{contractInfo.contractAddress.slice(-6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                className="flex-1"
                data-testid="button-connect-wallet"
              >
                Connect Farcaster Wallet
              </Button>
            ) : (
              <div className="flex-1 space-y-2">
                <Button
                  onClick={handleClaimAll}
                  disabled={isClaimingAll || isWriting || isConfirming}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="button-claim-all"
                >
                  {isClaimingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming All...
                    </>
                  ) : (
                    'Claim All Rewards'
                  )}
                </Button>
                <Button
                  onClick={handleClaim}
                  disabled={!claimAmount || parseFloat(claimAmount) <= 0 || isWriting || isConfirming}
                  className="w-full"
                  variant="outline"
                  data-testid="button-claim-single"
                >
                  {isWriting || isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isWriting ? 'Confirm in Wallet...' : 'Confirming...'}
                    </>
                  ) : (
                    'Claim Selected Amount'
                  )}
                </Button>
              </div>
            )}
          </div>
          
          {isConnected && (
            <div className="text-xs text-center mt-2 space-y-1">
              <div className="text-green-600 dark:text-green-400">
                Connected: {address?.slice(0, 8)}...{address?.slice(-6)}
              </div>
              <div className={`${chainId === arbitrumSepolia.id ? 'text-green-500' : 'text-orange-500'}`}>
                Network: {chainId === arbitrumSepolia.id ? 'Arbitrum Sepolia ✓' : `Chain ${chainId} (will auto-switch)`}
              </div>
            </div>
          )}
          
          {isConfirmed && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-3">
              <p className="text-sm text-green-700 dark:text-green-300 text-center">
                ✅ Tokens claimed successfully! Transaction: {txHash?.slice(0, 10)}...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}