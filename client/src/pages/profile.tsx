import { motion } from "framer-motion";
import { useGameState } from "@/hooks/use-game-state";
import { useFarcaster } from "@/hooks/use-farcaster";

import { Trophy, Zap, Target, Star, Award, Coins, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/navigation";
import { WalletConnectCompact } from "@/components/wallet-connect-compact";


export default function Profile() {
  const { user, isLoading: userLoading } = useGameState();
  const { user: farcasterUser, displayName, username, avatarUrl, isAuthenticated: isFarcasterAuthenticated, loading: farcasterLoading } = useFarcaster();

  // Render background immediately, show loading state for content only
  const shouldShowContent = !userLoading && user;

  // Only calculate when user data is available
  const winRate = user && (user.totalSpins || 0) > 0 ? ((user.totalWins || 0) / (user.totalSpins || 1) * 100) : 0;
  const level = user ? Math.floor((user.totalWins || 0) / 5) + 1 : 1;
  const nextLevelProgress = user ? ((user.totalWins || 0) % 5) / 5 * 100 : 0;

  // Calculate achievements - only when user data is available
  const achievements = user ? [
    {
      id: 'first_win',
      name: 'First Victory',
      description: 'Win your first spin',
      icon: Trophy,
      unlocked: (user.totalWins || 0) >= 1,
      color: 'text-yellow-400'
    },
    {
      id: 'lucky_streak',
      name: 'Lucky Seven',
      description: 'Win 7 times',
      icon: Star,
      unlocked: (user.totalWins || 0) >= 7,
      color: 'text-purple-400'
    },
    {
      id: 'spinner',
      name: 'Spin Master',
      description: 'Complete 50 spins',
      icon: Target,
      unlocked: (user.totalSpins || 0) >= 50,
      color: 'text-blue-400'
    },
    {
      id: 'high_roller',
      name: 'High Roller',
      description: 'Win 20 times',
      icon: Award,
      unlocked: (user.totalWins || 0) >= 20,
      color: 'text-green-400'
    }
  ] : [];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
    }}>
      {/* Subtle noise texture overlay */}
      <div className="fixed inset-0 opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }} />
      
      {/* Radial gradient overlay */}
      <div className="fixed inset-0" style={{
        background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%)'
      }} />

      {/* Floating particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, -100],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      {/* Compact Wallet Connect - Top Right */}
      <div className="fixed top-6 right-6 z-30">
        <WalletConnectCompact />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-4 pb-24">
        {!shouldShowContent ? (
          // Loading state with same background
          <div className="min-h-screen flex items-center justify-center -mt-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4 opacity-60"></div>
              <p className="text-white/60 text-sm">Loading profile...</p>
            </div>
          </div>
        ) : (
          <>
        {/* All profile content wrapped here */}

        {/* User Profile Header - Compact */}
        <motion.div 
          className="text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div 
            className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              boxShadow: '0 8px 25px rgba(139, 92, 246, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset',
              backdropFilter: 'blur(20px)'
            }}
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {!farcasterLoading && isFarcasterAuthenticated && avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              (!farcasterLoading && (displayName?.charAt(0) || username?.charAt(0))) || user?.username?.charAt(0) || 'P'
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-3 border-gray-900">
              <span className="text-white text-xs font-bold">{level}</span>
            </div>
          </motion.div>
          <div className="mb-2">
            <motion.h1 
              className="text-2xl font-bold text-white mb-1"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {!farcasterLoading && isFarcasterAuthenticated 
                ? (displayName || username || user?.username)
                : user?.username || "Loading..."
              }
            </motion.h1>
            {!farcasterLoading && isFarcasterAuthenticated && username && (
              <Badge className="mb-2 bg-purple-500/20 text-purple-400 border-purple-400/30 text-xs">
                @{username}
              </Badge>
            )}
            <div className="w-16 h-0.5 bg-blue-400 mx-auto mb-1 rounded-full"></div>
          </div>
          <h2 className="text-lg font-semibold text-white/80 mb-1">
            Level {level} Player
          </h2>
          
          {/* Level Progress */}
          <div className="max-w-xs mx-auto mt-3">
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span>Level {level}</span>
              <span>Level {level + 1}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div 
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${nextLevelProgress}%`,
                  background: 'linear-gradient(90deg, #ec4899 0%, #8b5cf6 100%)'
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Stats Grid - Compact */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Total Spins Card */}
          <motion.div
            className="rounded-2xl p-4 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transform: 'perspective(1000px) rotateX(2deg) rotateY(-1deg)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset'
            }}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            whileHover={{ 
              scale: 1.02, 
              y: -3,
              transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
              transition: { duration: 0.3 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                opacity: 0.9
              }}
            />
            {/* Top highlight */}
            <div 
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
              }}
            />
            <div className="relative z-10 text-center">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{user?.totalSpins || 0}</p>
              <p className="text-xs text-white/80 font-medium">Total Spins</p>
            </div>
          </motion.div>

          {/* Total Wins Card */}
          <motion.div
            className="rounded-2xl p-4 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transform: 'perspective(1000px) rotateX(-1deg) rotateY(1deg)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset'
            }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
            whileHover={{ 
              scale: 1.02, 
              y: -3,
              transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
              transition: { duration: 0.3 }
            }}
          >
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                opacity: 0.9
              }}
            />
            {/* Top highlight */}
            <div 
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
              }}
            />
            <div className="relative z-10 text-center">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{user?.totalWins || 0}</p>
              <p className="text-xs text-white/80 font-medium">Total Wins</p>
            </div>
          </motion.div>
        </div>

        {/* Performance Cards - Compact */}
        <div className="space-y-3 mb-4">
          {/* Win Rate Card */}
          <motion.div
            className="rounded-2xl p-4 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transform: 'perspective(1000px) rotateX(2deg) rotateY(-1deg)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset'
            }}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            whileHover={{ 
              scale: 1.02, 
              y: -3,
              transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
              transition: { duration: 0.3 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                opacity: 0.9
              }}
            />
            {/* Top highlight */}
            <div 
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">🎯 Performance</h3>
                    <p className="text-white/80 text-xs">Your success rate</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{winRate.toFixed(1)}%</p>
                  <p className="text-xs text-white/60">Win Rate</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Daily Spins Card */}
          <motion.div
            className="rounded-2xl p-4 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transform: 'perspective(1000px) rotateX(-1deg) rotateY(1deg)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset'
            }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            whileHover={{ 
              scale: 1.02, 
              y: -3,
              transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
              transition: { duration: 0.3 }
            }}
          >
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                opacity: 0.9
              }}
            />
            {/* Top highlight */}
            <div 
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Coins className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">⚡ Daily Challenge</h3>
                    <p className="text-white/80 text-xs">Spins remaining today</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{5 - (user?.spinsUsed || 0)}</p>
                  <p className="text-xs text-white/60">Spins Left</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>



        {/* Achievements Section - Compact */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-white">🏆 Achievements</h3>
            <span className="text-xs text-white/70">{achievements.filter(a => a.unlocked).length}/{achievements.length} unlocked</span>
          </div>
          
          {/* Achievement Grid */}
          <div className="grid grid-cols-2 gap-2">
            {achievements.map((achievement, index) => (
              <motion.div 
                key={achievement.id}
                className={`p-2 rounded-xl text-center ${
                  achievement.unlocked 
                    ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' 
                    : 'bg-white/5 border border-white/10'
                }`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <achievement.icon className={`w-5 h-5 mx-auto mb-1 ${
                  achievement.unlocked ? achievement.color : 'text-gray-500'
                }`} />
                <p className={`text-xs font-medium ${
                  achievement.unlocked ? 'text-white' : 'text-gray-400'
                }`}>
                  {achievement.name}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>


        </>
        )}
      </div>

      {/* Navigation */}
      <Navigation />
    </div>
  );
}