import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Coins, Zap, Clock, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentSpin {
  id: string;
  playerName: string;
  playerAvatar?: string;
  isWin: boolean;
  tokenSymbol?: string;
  rewardAmount?: string;
  timestamp: string;
  isTemporary: boolean;
}

interface RecentSpinsResponse {
  spins: RecentSpin[];
  count: number;
}

export default function RecentSpins() {
  const { data: recentSpinsData, isLoading } = useQuery<RecentSpinsResponse>({
    queryKey: ['/api/recent-spins'],
    refetchInterval: 10000 // Refresh every 10 seconds for real-time feel
  });

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const spinTime = new Date(timestamp);
    const diffMs = now.getTime() - spinTime.getTime();
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

  const getSpinIcon = (isWin: boolean, tokenSymbol?: string) => {
    if (!isWin) return <Zap className="w-4 h-4 text-red-400" />;
    return <Trophy className="w-4 h-4 text-yellow-400" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recent Spins
          </h3>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <div className="w-6 h-6 bg-white/10 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-2 bg-white/10 rounded mb-1 w-16"></div>
                  <div className="h-1.5 bg-white/5 rounded w-12"></div>
                </div>
                <div className="w-8 h-4 bg-white/10 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const recentSpins = recentSpinsData?.spins || [];
  const winningSpins = recentSpins.filter(spin => spin.isWin);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Recent Spins
        </h3>
        {recentSpins.length > 0 && (
          <Badge variant="secondary" className="bg-white/10 text-white border-white/20 text-xs">
            {winningSpins.length} wins
          </Badge>
        )}
      </div>
      
      <div className="space-y-1 max-h-48 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {recentSpins.map((spin, index) => (
            <motion.div
              key={spin.id}
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
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/8 transition-all duration-200">
                {/* Player Avatar */}
                <div className="relative">
                  {spin.playerAvatar ? (
                    <img 
                      src={spin.playerAvatar} 
                      alt={spin.playerName}
                      className="w-6 h-6 rounded-full border border-white/20"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {spin.playerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Win/Loss indicator */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center ${
                    spin.isWin ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {spin.isWin ? (
                      <Trophy className="w-2 h-2 text-white" />
                    ) : (
                      <Zap className="w-2 h-2 text-white" />
                    )}
                  </div>
                </div>

                {/* Spin Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-xs font-medium truncate">
                      {spin.isTemporary ? `Player${spin.playerName.slice(-4)}` : spin.playerName}
                    </span>
                    {spin.isWin && spin.tokenSymbol && (
                      <Badge 
                        className={`bg-gradient-to-r ${getTokenColor(spin.tokenSymbol)} text-white text-xs px-1.5 py-0.5 h-4`}
                      >
                        {spin.tokenSymbol}
                      </Badge>
                    )}
                  </div>
                  <span className="text-white/50 text-xs">{formatTimeAgo(spin.timestamp)}</span>
                </div>

                {/* Reward Amount */}
                <div className="text-right">
                  {spin.isWin && spin.rewardAmount ? (
                    <span className="text-yellow-400 font-bold text-xs">
                      +{spin.rewardAmount}
                    </span>
                  ) : (
                    <span className="text-red-400 text-xs font-medium">
                      BUST
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {recentSpins.length === 0 && (
          <div className="text-center py-6 text-white/60">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-white/20" />
            <p className="text-xs">No recent spins yet</p>
          </div>
        )}
      </div>
    </div>
  );
}