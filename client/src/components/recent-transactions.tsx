import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Coins, Receipt, Clock, Activity, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentTransaction {
  id: string;
  transactionHash: string;
  type: 'spin' | 'claim';
  amount?: string;
  tokenSymbol?: string;
  isWin?: boolean;
  timestamp: Date;
  playerName?: string;
}

interface RecentTransactionsResponse {
  transactions: RecentTransaction[];
  count: number;
}

interface RecentTransactionsProps {
  userId?: string;
}

export default function RecentTransactions({ userId }: RecentTransactionsProps) {
  const { data: txData, isLoading } = useQuery<RecentTransactionsResponse>({
    queryKey: ['/api/user', userId, 'transactions'],
    enabled: !!userId,
    refetchInterval: 15000 // Refresh every 15 seconds
  });

  const formatTimeAgo = (timestamp: string | Date) => {
    const now = new Date();
    const txTime = new Date(timestamp);
    const diffMs = now.getTime() - txTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getTokenColor = (symbol?: string) => {
    switch (symbol) {
      case 'AIDOGE': return 'from-purple-500 to-pink-500';
      case 'BOOP': return 'from-blue-500 to-cyan-500';
      case 'BOBOTRUM': return 'from-green-500 to-teal-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    if (type === 'claim') return <Receipt className="w-3 h-3" />;
    return <Coins className="w-3 h-3" />;
  };

  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getArbiscanUrl = (txHash: string) => {
    return `https://sepolia.arbiscan.io/tx/${txHash}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Transactions
          </h3>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <div className="w-6 h-6 bg-white/10 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-2 bg-white/10 rounded mb-1 w-20"></div>
                  <div className="h-1.5 bg-white/5 rounded w-16"></div>
                </div>
                <div className="w-8 h-4 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const transactions = txData?.transactions || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Recent Transactions
        </h3>
        {transactions.length > 0 && (
          <Badge variant="secondary" className="bg-white/10 text-white border-white/20 text-xs">
            {transactions.length} txns
          </Badge>
        )}
      </div>
      
      <div className="space-y-1 max-h-48 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {transactions.map((tx, index) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ 
                delay: index * 0.03,
                type: "spring",
                stiffness: 400,
                damping: 25
              }}
            >
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/8 transition-all duration-200 group">
                {/* Transaction Type Icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  tx.type === 'claim' ? 'bg-green-500/20 text-green-400' : 
                  tx.isWin ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {getTransactionTypeIcon(tx.type)}
                </div>

                {/* Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-xs font-medium">
                      {tx.type === 'claim' ? 'Claim' : tx.isWin ? 'Win' : 'Spin'}
                    </span>
                    {tx.tokenSymbol && (
                      <Badge 
                        className={`bg-gradient-to-r ${getTokenColor(tx.tokenSymbol)} text-white text-xs px-1.5 py-0.5 h-4`}
                      >
                        {tx.tokenSymbol}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-white/40" />
                    <span className="text-white/50 text-xs">{formatTimeAgo(tx.timestamp)}</span>
                  </div>
                </div>

                {/* Transaction Hash Link */}
                <div className="flex items-center gap-2">
                  {tx.amount && (
                    <span className="text-xs text-yellow-400 font-medium">
                      +{tx.amount}
                    </span>
                  )}
                  <a
                    href={getArbiscanUrl(tx.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                    data-testid={`link-transaction-${tx.id}`}
                  >
                    <span className="font-mono">{formatTxHash(tx.transactionHash)}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {transactions.length === 0 && (
          <div className="text-center py-6 text-white/60">
            <Activity className="w-8 h-8 mx-auto mb-2 text-white/20" />
            <p className="text-xs">No recent transactions</p>
            <p className="text-xs text-white/40 mt-1">Start spinning to see blockchain activity!</p>
          </div>
        )}
      </div>
    </div>
  );
}