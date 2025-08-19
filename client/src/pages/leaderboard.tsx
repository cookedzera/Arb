import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Crown } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/navigation";

interface LeaderboardEntry {
  id: string;
  username: string;
  walletAddress: string;
  farcasterUsername?: string;
  farcasterPfpUrl?: string;
  totalWins?: number;
  totalSpins?: number;
  totalRewards?: string;
  weeklyWins?: number;
  weeklySpins?: number;
  weeklyRewards?: string;
}

interface WeeklyEntry {
  userId: string;
  username: string;
  walletAddress: string;
  farcasterUsername?: string;
  farcasterPfpUrl?: string;
  weeklyWins: number;
  weeklySpins: number;
  weeklyRewards: string;
}

// Floating particles component matching homepage style
const FloatingParticles = memo(() => {
  const particles = useMemo(() => 
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 4 + Math.random() * 2,
      delay: Math.random() * 3
    })), []
  );
  
  return (
    <div className="fixed inset-0 pointer-events-none will-change-transform">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-20"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animation: `float ${particle.duration}s infinite ${particle.delay}s ease-out`,
            transform: 'translateZ(0)'
          }}
        />
      ))}
    </div>
  );
});

// Memoized styles matching homepage
const BACKGROUND_STYLE = {
  background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
};

const NOISE_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
};

const RADIAL_STYLE = {
  background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%)'
};

export default function Leaderboard() {
  // Only fetch wins leaderboard
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['/api/leaderboard', 'wins'],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboard?category=wins&limit=20`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json() as Promise<LeaderboardEntry[]>;
    }
  });

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return (
        <div className="relative">
          <Crown className="w-7 h-7 text-yellow-400" />
          <motion.div 
            className="absolute inset-0"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Crown className="w-7 h-7 text-yellow-300 opacity-50" />
          </motion.div>
        </div>
      );
      case 2: return <Medal className="w-6 h-6 text-gray-300" />;
      case 3: return <Award className="w-6 h-6 text-amber-500" />;
      default: return (
        <div className="w-7 h-7 flex items-center justify-center text-sm font-bold text-white/70 bg-gray-700/50 rounded-full border border-gray-600/50">
          #{position}
        </div>
      );
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'wins': return 'Most Wins';
      case 'spins': return 'Most Spins';
      case 'rewards': return 'Biggest Rewards';
      default: return 'Leaderboard';
    }
  };

  const getCategoryValue = (entry: LeaderboardEntry, cat: string) => {
    switch (cat) {
      case 'wins': return entry.totalWins || 0;
      case 'spins': return entry.totalSpins || 0;
      case 'rewards': return `${(parseFloat(entry.totalRewards || '0') / 1e18).toFixed(0)} tokens`;
      default: return 0;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden overscroll-contain gpu-accelerated" style={BACKGROUND_STYLE}>
        <FloatingParticles />
        <div className="absolute inset-0 opacity-[0.03]" style={NOISE_STYLE} />
        <div className="absolute inset-0" style={RADIAL_STYLE} />
        
        <div className="relative z-10 min-h-screen pb-20 px-4">
          <div className="max-w-md mx-auto pt-8">
            <div className="animate-pulse space-y-4">
              {[...Array(10)].map((_, i) => (
                <motion.div 
                  key={i} 
                  className="bg-gray-800/30 rounded-xl h-16 backdrop-blur-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                />
              ))}
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden overscroll-contain gpu-accelerated" style={BACKGROUND_STYLE}>
      <FloatingParticles />
      <div className="absolute inset-0 opacity-[0.03]" style={NOISE_STYLE} />
      <div className="absolute inset-0" style={RADIAL_STYLE} />
      
      <div className="relative z-10 min-h-screen pb-20 px-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <motion.div 
            className="text-center space-y-3 pt-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3">
              <motion.div
                animate={{ 
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Trophy className="w-8 h-8 text-yellow-400" />
              </motion.div>
              <h1 className="text-2xl font-bold text-white font-pixel">
                LEADERBOARD
              </h1>
            </div>
            <p className="text-gray-400 text-sm">
              Top players on Arbitrum Sepolia
            </p>
          </motion.div>

          {/* Simple Wins Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <LeaderboardList 
              title="Most Wins"
              data={leaderboard || []}
              category="wins"
              getRankIcon={getRankIcon}
              getCategoryValue={getCategoryValue}
              formatAddress={formatAddress}
            />
          </motion.div>
        </div>
      </div>
      <Navigation />
    </div>
  );
}

// Leaderboard list component with casino aesthetics
function LeaderboardList({ 
  title, 
  data, 
  category, 
  getRankIcon, 
  getCategoryValue, 
  formatAddress 
}: {
  title: string;
  data: LeaderboardEntry[];
  category: string;
  getRankIcon: (position: number) => JSX.Element;
  getCategoryValue: (entry: LeaderboardEntry, cat: string) => any;
  formatAddress: (address: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-3"
    >
      {data.length === 0 ? (
        <motion.div 
          className="text-center py-12 text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-lg font-medium">No players yet</p>
          <p className="text-sm">Start spinning to join the leaderboard!</p>
        </motion.div>
      ) : (
        data.map((entry, index) => (
          <motion.div 
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/70 transition-all duration-300 hover:bg-gray-800/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {getRankIcon(index + 1)}
                </div>
                <Avatar className="w-10 h-10 border-2 border-gray-600/50">
                  <AvatarImage src={entry.farcasterPfpUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-800 text-white text-sm">
                    {entry.farcasterUsername?.[0]?.toUpperCase() || entry.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-white font-medium text-sm">
                    {entry.farcasterUsername || entry.username}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {formatAddress(entry.walletAddress)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-sm">
                  {getCategoryValue(entry, category)}
                </div>
                {category !== 'rewards' && (
                  <div className="text-gray-400 text-xs">
                    {entry.totalSpins} spins
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))
      )}
    </motion.div>
  );
}