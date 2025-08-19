import { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Home, User, Gamepad2, Trophy } from "lucide-react";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  
  // Derive active tab directly from location to avoid state sync issues
  const activeTab = useMemo(() => {
    if (location === '/profile') return 'profile';
    if (location === '/leaderboard') return 'leaderboard';
    if (location === '/admin') return 'admin';
    return 'home';
  }, [location]);

  const handleNavigation = useCallback((path: string) => {
    setLocation(path);
  }, [setLocation]);

  // Memoize navigation items to prevent unnecessary re-renders
  const navItems = useMemo(() => [
    {
      key: 'home',
      path: '/',
      icon: Home,
      label: 'Home',
      isActive: activeTab === 'home',
      gradient: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)',
      shadowColor: 'rgba(74, 222, 128, 0.3)'
    },
    {
      key: 'leaderboard',
      path: '/leaderboard',
      icon: Trophy,
      label: 'Leaders',
      isActive: activeTab === 'leaderboard',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.3)'
    },
    {
      key: 'profile',
      path: '/profile',
      icon: User,
      label: 'Profile',
      isActive: activeTab === 'profile',
      gradient: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)',
      shadowColor: 'rgba(74, 222, 128, 0.3)'
    }
  ], [activeTab]);

  // Optimized animation variants for better performance
  const buttonVariants = {
    tap: { scale: 0.97 },
    hover: { scale: 1.02, y: -1 }
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 px-4 py-3 relative z-20 transform-gpu will-change-transform" 
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <div className="flex justify-center space-x-4">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <motion.button
              key={item.key}
              className={`nav-button flex flex-col items-center space-y-1 px-3 py-2 rounded-full gpu-accelerated ${
                item.isActive ? 'text-white' : 'text-white/60 hover:text-white/80'
              }`}
              style={item.isActive ? {
                background: item.gradient,
                boxShadow: `0 4px 15px ${item.shadowColor}`
              } : {}}
              variants={buttonVariants}
              whileTap="tap"
              whileHover={!item.isActive ? "hover" : undefined}
              transition={{ duration: 0.05, ease: "easeOut" }}
              onClick={() => handleNavigation(item.path)}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </motion.button>
          );
        })}
        
        {/* Coming Soon Games Button */}
        <motion.button
          className="flex flex-col items-center space-y-1 px-3 py-2 rounded-full text-white/40 cursor-not-allowed relative transform-gpu"
          disabled={true}
        >
          <div className="relative">
            <Gamepad2 className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 flex space-x-0.5">
              <span className="text-xs">🎮</span>
              <span className="text-xs">🃏</span>
            </div>
          </div>
          <span className="text-xs font-medium">Games</span>
          <span className="text-[10px] text-white/30 absolute -bottom-1">Coming Soon</span>
        </motion.button>
      </div>
    </div>
  );
}