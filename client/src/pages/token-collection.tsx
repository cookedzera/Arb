import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, Zap, Award, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatUnits } from "ethers";

interface User {
  id: string;
  username: string;
  walletAddress?: string;
  farcasterFid?: number;
  farcasterUsername?: string;
  farcasterDisplayName?: string;
  farcasterPfpUrl?: string;
  spinsUsed: number;
  totalWins: number;
  totalSpins: number;
  lastSpinDate?: string;
}

interface TokenBalances {
  token1: string;
  token2: string;
  token3: string;
  canClaim: boolean;
  totalValueUSD: string;
}

interface TokenClaim {
  id: string;
  userId: string;
  token1Amount: string;
  token2Amount: string;
  token3Amount: string;
  totalValueUSD: string;
  transactionHash: string | null;
  status: string;
  timestamp: string;
}

export default function TokenCollection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user data
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Get token balances
  const { data: balances, isLoading: balancesLoading } = useQuery<TokenBalances>({
    queryKey: ['/api/user', user?.id, 'balances'],
    enabled: !!user?.id,
  });

  // Get recent claims
  const { data: claims } = useQuery<TokenClaim[]>({
    queryKey: ['/api/user', user?.id, 'claims'],
    enabled: !!user?.id,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/claim', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim tokens');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Tokens Claimed!",
        description: data.message || "Tokens claimed successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user', user?.id, 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user', user?.id, 'claims'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim tokens",
        variant: "destructive",
      });
    },
  });

  const formatTokenAmount = (amount: string, decimals = 18) => {
    try {
      const parsed = parseFloat(formatUnits(amount, decimals));
      if (parsed >= 1000) {
        return `+${(parsed / 1000).toFixed(1)}K`;
      }
      return `+${parsed.toFixed(0)}`;
    } catch {
      return "0";
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ${diffInMinutes % 60}m`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ${diffInHours % 24}h ${diffInMinutes % 60}m`;
  };

  const tokenData = [
    {
      symbol: "AIDOGE",
      name: "AiDoge",
      amount: balances?.token1 || "0",
      icon: Coins,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
    {
      symbol: "BOOP", 
      name: "Boop",
      amount: balances?.token2 || "0",
      icon: Zap,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      symbol: "CATCH",
      name: "Catch",
      amount: balances?.token3 || "0",
      icon: Award,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
  ];

  const hasTokens = tokenData.some(token => BigInt(token.amount) > 0);
  const canClaim = balances?.canClaim || false;

  if (userLoading || balancesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-md mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-700 rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-8 pb-4"
        >
          <h1 className="text-2xl font-bold text-white mb-2">
            <Coins className="inline-block w-6 h-6 mr-2 text-yellow-400" />
            Token Collection
          </h1>
          <p className="text-gray-400 text-sm">Manage your earned tokens</p>
        </motion.div>

        {/* Token List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {tokenData.map((token, index) => {
            const Icon = token.icon;
            const formattedAmount = formatTokenAmount(token.amount);
            const hasBalance = BigInt(token.amount) > 0;
            const recentClaim = claims?.find(claim => 
              (token.symbol === "AIDOGE" && BigInt(claim.token1Amount || "0") > 0) ||
              (token.symbol === "BOOP" && BigInt(claim.token2Amount || "0") > 0) ||
              (token.symbol === "CATCH" && BigInt(claim.token3Amount || "0") > 0)
            );
            
            return (
              <motion.div
                key={token.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${token.bgColor}`}>
                      <Icon className={`h-5 w-5 ${token.color}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-base">
                        {token.symbol}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {recentClaim ? formatTimeAgo(recentClaim.timestamp) : "Never"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${hasBalance ? 'text-green-400' : 'text-gray-500'}`}>
                      {formattedAmount}
                    </div>
                  </div>
                </div>

                {/* Individual token claim button */}
                {hasBalance && (
                  <motion.div 
                    className="mt-3 pt-3 border-t border-gray-700/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <Button
                      onClick={() => claimMutation.mutate()}
                      disabled={!hasBalance || claimMutation.isPending}
                      size="sm"
                      className={`w-full ${token.bgColor} ${token.color} border border-gray-600/50 hover:border-gray-500/50 bg-gray-700/50 hover:bg-gray-600/50`}
                    >
                      {claimMutation.isPending ? (
                        "Processing..."
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Global Claim Button */}
        {hasTokens && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="pt-4"
          >
            <Button
              onClick={() => claimMutation.mutate()}
              disabled={!canClaim || claimMutation.isPending}
              className={`w-full py-3 ${
                canClaim 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' 
                  : 'bg-gray-700 cursor-not-allowed'
              } text-white transition-all duration-200`}
            >
              {claimMutation.isPending ? (
                "Processing..."
              ) : canClaim ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Claim All Tokens
                </>
              ) : (
                "Minimum $1.00 required"
              )}
            </Button>
          </motion.div>
        )}

        {/* No tokens message */}
        {!hasTokens && !balancesLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center py-12"
          >
            <Coins className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Tokens Yet</h3>
            <p className="text-gray-500 text-sm">
              Start spinning to earn tokens and build your collection!
            </p>
          </motion.div>
        )}

        {/* Recent Claims History */}
        {claims && claims.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card className="bg-gray-900/80 border-gray-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  Recent Claims
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claims.slice(0, 3).map((claim) => (
                  <div
                    key={claim.id}
                    className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg"
                  >
                    <div className="text-xs text-gray-400">
                      {formatTimeAgo(claim.timestamp)} ago
                    </div>
                    <div className="text-xs font-mono text-green-400">
                      ${parseFloat(claim.totalValueUSD).toFixed(2)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}