import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Coins, Zap, Clock, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Spins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-3 bg-white/10 rounded mb-1 w-20"></div>
                    <div className="h-2 bg-white/5 rounded w-16"></div>
                  </div>
                  <div className="w-12 h-6 bg-white/10 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentSpins = recentSpinsData?.spins || [];
  const winningSpins = recentSpins.filter(spin => spin.isWin);

  return (
    <Card className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-white/10 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Spins
          </CardTitle>
          <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
            <Users className="w-3 h-3 mr-1" />
            {recentSpins.length}
          </Badge>
        </div>
        {winningSpins.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span>{winningSpins.length} recent wins!</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-1 max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {recentSpins.map((spin, index) => (
            <motion.div
              key={spin.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ 
                delay: index * 0.05,
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
              className="group"
            >
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 border border-transparent hover:border-white/10">
                {/* Player Avatar */}
                <div className="relative">
                  {spin.playerAvatar ? (
                    <img 
                      src={spin.playerAvatar} 
                      alt={spin.playerName}
                      className="w-8 h-8 rounded-full border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {spin.playerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Win/Loss indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                    spin.isWin ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {getSpinIcon(spin.isWin, spin.tokenSymbol)}
                  </div>
                </div>

                {/* Spin Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium truncate">
                      {spin.isTemporary ? `Player${spin.playerName.slice(-4)}` : spin.playerName}
                    </span>
                    {spin.isWin && spin.tokenSymbol && (
                      <Badge 
                        className={`bg-gradient-to-r ${getTokenColor(spin.tokenSymbol)} text-white text-xs px-2 py-0.5`}
                      >
                        {spin.tokenSymbol}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3 h-3 text-white/40" />
                    <span className="text-white/60">{formatTimeAgo(spin.timestamp)}</span>
                  </div>
                </div>

                {/* Reward Amount */}
                <div className="text-right">
                  {spin.isWin && spin.rewardAmount ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-yellow-400 font-bold text-sm"
                    >
                      +{spin.rewardAmount}
                    </motion.div>
                  ) : (
                    <div className="text-red-400 text-sm font-medium">
                      BUST
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {recentSpins.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-white/60"
          >
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-white/20" />
            <p className="text-sm">No recent spins yet...</p>
            <p className="text-xs text-white/40 mt-1">Be the first to spin!</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}