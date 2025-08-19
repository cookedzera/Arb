import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Coins, Zap, Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatUnits } from "ethers";

interface TokenBalanceCardProps {
  userId: string;
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

export function TokenBalanceCard({ userId }: TokenBalanceCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: balances, isLoading } = useQuery<TokenBalances>({
    queryKey: ['/api/user', userId, 'balances'],
    enabled: !!userId,
  });

  const { data: claims } = useQuery<TokenClaim[]>({
    queryKey: ['/api/user', userId, 'claims'],
    enabled: !!userId,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/claim', {
        method: 'POST',
        body: JSON.stringify({ userId }),
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
      queryClient.invalidateQueries({ queryKey: ['/api/user', userId, 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user', userId, 'claims'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim tokens",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-gray-900/80 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-400" />
            Token Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatTokenAmount = (amount: string, decimals = 18) => {
    try {
      const parsed = parseFloat(formatUnits(amount, decimals));
      if (parsed >= 1000) {
        return `+${(parsed / 1000).toFixed(1)}K`;
      } else if (parsed >= 1) {
        return `+${parsed.toFixed(0)}`;
      }
      return "+0";
    } catch {
      return "+0";
    }
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
  const totalValueUSD = balances?.totalValueUSD || "0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Token Collection Header */}
      <div className="flex items-center gap-2 mb-4">
        <Coins className="h-5 w-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-white">Token Collection</h3>
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {tokenData.map((token) => {
          const Icon = token.icon;
          const formattedAmount = formatTokenAmount(token.amount);
          const hasBalance = BigInt(token.amount) > 0;
          
          return (
            <motion.div
              key={token.symbol}
              className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
              whileHover={{ scale: 1.01 }}
              data-testid={`balance-${token.symbol.toLowerCase()}`}
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
                      🔒 2h 14min
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${hasBalance ? 'text-green-400' : 'text-gray-500'}`}>
                    {formattedAmount}
                  </div>
                </div>
              </div>

              {/* Individual claim button */}
              {hasBalance && (
                <motion.div 
                  className="mt-3 pt-3 border-t border-gray-700/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button
                    onClick={() => claimMutation.mutate()}
                    disabled={!hasBalance || claimMutation.isPending}
                    size="sm"
                    className="w-full bg-gray-700/50 hover:bg-gray-600/50 text-white border border-gray-600/50 hover:border-gray-500/50"
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
      </div>

      {/* Global Claim Button */}
      {hasTokens && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
            data-testid="button-claim-tokens"
          >
            {claimMutation.isPending ? (
              "Processing..."
            ) : canClaim ? (
              "Claim All Tokens"
            ) : (
              "Minimum $1.00 required"
            )}
          </Button>
        </motion.div>
      )}

      {/* No tokens message */}
      {!hasTokens && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center py-8"
        >
          <Coins className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Tokens Yet</h3>
          <p className="text-gray-500 text-sm">
            Start spinning to earn tokens and build your collection!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}