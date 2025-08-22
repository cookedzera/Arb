import { useState, useCallback, useMemo, memo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { type GameStats, type SpinResult } from "@shared/schema";
import { useGameState } from "@/hooks/use-game-state";
import SpinWheelSimple from "@/components/spin-wheel-simple";
import CountdownTimer from "@/components/countdown-timer";
import Navigation from "@/components/navigation";
import TokenVoting from "@/components/token-voting";
import { WalletConnectCompact } from "@/components/wallet-connect-compact";
import { useFarcaster } from "@/hooks/use-farcaster";
import { formatUnits } from "viem";
import { AudioManager } from "@/lib/audio-manager";
import aidogeLogo from "@assets/aidoge_1755435810322.png";
import boopLogo from "@assets/boop_1755435810327.png";
// Removed unused imports to optimize bundle size
import newLogo from "@assets/Adobe Express - file (1)_1755685145766.png";
import officialArbLogo from "@assets/Adobe Express - file_1755685469543.png";

// Typewriter animation component for alternating text
const TypewriterText = memo(() => {
  const [displayText, setDisplayText] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(300);
  
  const words = useMemo(() => ["SPIN", "GAMES"], []);
  
  useEffect(() => {
    const handleType = () => {
      const currentWord = words[currentWordIndex];
      
      if (isDeleting) {
        setDisplayText(prev => prev.slice(0, -1));
        setTypingSpeed(120); // Slower deletion
      } else {
        setDisplayText(prev => currentWord.slice(0, prev.length + 1));
        setTypingSpeed(300); // Slower typing
      }
      
      if (!isDeleting && displayText === currentWord) {
        setTimeout(() => setIsDeleting(true), 3500); // Longer pause before deleting
      } else if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
        setTypingSpeed(600); // Pause before starting new word
      }
    };
    
    const timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentWordIndex, typingSpeed, words]);
  
  return (
    <span className="relative text-blue-400 select-none">
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }}
        className="inline-block ml-1 select-none"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        |
      </motion.span>
      {/* Bold underline specifically for the typewriter text */}
      <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-400 rounded-full select-none" style={{ pointerEvents: 'none' }}></div>
    </span>
  );
});

// Audio is now managed globally in App.tsx via GlobalAudio component

interface TokenBalances {
  token1: string;
  token2: string;
  token3: string;
  canClaim: boolean;
  totalValueUSD: string;
}

// Optimized floating particles using CSS animations instead of JS
const FloatingParticles = memo(() => {
  const particles = useMemo(() => 
    Array.from({ length: 4 }, (_, i) => ({ // Reduced from 6 to 4
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 4 + Math.random() * 2, // Increased duration for smoother animation
      delay: Math.random() * 3
    })), []
  );
  
  return (
    <div className="fixed inset-0 pointer-events-none will-change-transform">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-20 animate-pulse"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animation: `float ${particle.duration}s infinite ${particle.delay}s ease-out`,
            transform: 'translateZ(0)' // Force hardware acceleration
          }}
        />
      ))}

    </div>
  );
});

// Memoized styles to prevent recreation
const BACKGROUND_STYLE = {
  background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
};

const NOISE_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
};

const RADIAL_STYLE = {
  background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%)'
};

// Audio is now handled globally via GlobalAudio component in App.tsx

export default function Home() {
  const queryClient = useQueryClient();
  const { user, farcasterUser, isFarcasterAuthenticated, isLoading: userLoading } = useGameState();
  // Extract Farcaster data from user database record
  const displayName = user?.farcasterDisplayName || user?.farcasterUsername || user?.username || 'Player';
  const username = user?.farcasterUsername || user?.username || '';
  const avatarUrl = user?.farcasterPfpUrl || '';
  const farcasterLoading = userLoading;
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioManager] = useState(() => AudioManager.getInstance());

  // Initialize audio and manage mute state
  useEffect(() => {
    audioManager.init();
    setIsMuted(audioManager.getMuted());
  }, [audioManager]);

  const toggleMute = useCallback(() => {
    const newMutedState = audioManager.toggleMute();
    setIsMuted(newMutedState);
  }, [audioManager]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showSpinWheel) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showSpinWheel]);



  
  const { data: stats } = useQuery<GameStats>({
    queryKey: ["/api/stats"],
  });

  // Get token balances for real data
  const { data: balances, isLoading: balancesLoading } = useQuery<TokenBalances>({
    queryKey: ['/api/user', user?.id, 'claimable'],
    enabled: !!user?.id,
  });





  // Memoize expensive token formatting function to match ClaimModal display
  const formatTokenAmount = useCallback((amount: string, decimals = 18) => {
    try {
      const parsed = parseFloat(formatUnits(BigInt(amount), decimals));
      if (parsed >= 1000) {
        return `${(parsed / 1000).toFixed(1)}K`;
      } else if (parsed >= 1) {
        return `${parsed.toFixed(0)}`;
      } else if (parsed > 0) {
        return `${parsed.toFixed(2)}`;
      }
      return "0";
    } catch {
      return "0";
    }
  }, []);

  // Memoize token data to prevent recreation - MUST be before early return
  const tokenData = useMemo(() => [
    { name: 'AIDOGE', icon: aidogeLogo, amount: balances?.token1 || '0', time: '2h 14 min', emoji: '🐕' },
    { name: 'BOOP', icon: boopLogo, amount: balances?.token2 || '0', time: '5h 22 min', emoji: '🎭' },
    { name: 'ARB', icon: officialArbLogo, amount: balances?.token3 || '0', time: '1h 8 min', emoji: '🔷' }
  ], [balances?.token1, balances?.token2, balances?.token3]);

  // Show minimal loading state while preserving background
  if (userLoading) {
    return (
      <div className="min-h-screen relative" style={{
        background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
      }}>
        {/* Loading spinner */}
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative will-change-scroll"
      style={{
        ...BACKGROUND_STYLE,
        transform: 'translateZ(0)', // Hardware acceleration
        backfaceVisibility: 'hidden'
      }}
    >
      {/* Background Music handled globally via GlobalAudio in App.tsx */}
      
      {/* Subtle noise texture overlay */}
      <div className="fixed inset-0 opacity-10 will-change-transform" style={{...NOISE_STYLE, transform: 'translateZ(0)'}} />
      
      {/* Radial gradient overlay */}
      <div className="fixed inset-0 will-change-transform" style={{...RADIAL_STYLE, transform: 'translateZ(0)'}} />
      
      {/* Floating particles - memoized */}
      <FloatingParticles />
      


      {/* Music Button with Dancing Cat Above - Top Left */}
      <div className="fixed top-4 left-4 z-50">
        {/* Tiny Cute Dancing Cat - Above Button */}
        <motion.div
          className="flex justify-center mb-2"
          animate={!isMuted ? {
            y: [-2, 2, -2],
            rotate: [-4, 4, -4]
          } : {}}
          transition={{
            duration: 0.6,
            repeat: !isMuted ? Infinity : 0,
            repeatType: "reverse",
            ease: "easeInOut"
          }}
        >
          <svg 
            width="24" 
            height="20" 
            viewBox="0 0 24 20" 
            fill="none" 
            className={`drop-shadow-lg ${isMuted ? 'text-red-400' : 'text-emerald-400'}`}
          >
            {/* Tiny cat ears */}
            <path 
              d="M7 7 L8 3 L9 7 Z" 
              fill="currentColor"
              stroke="white"
              strokeWidth="1"
            />
            <path 
              d="M15 7 L16 3 L17 7 Z" 
              fill="currentColor"
              stroke="white"
              strokeWidth="1"
            />
            
            {/* Small cute head */}
            <circle 
              cx="12" 
              cy="10" 
              r="5" 
              fill="currentColor" 
              stroke="white"
              strokeWidth="1.2"
              opacity="0.95"
            />
            
            {/* Cute face - bigger eyes */}
            <circle cx="10" cy="9" r="0.8" fill="white"/>
            <circle cx="14" cy="9" r="0.8" fill="white"/>
            <path d="M12 11 L11 12 L12 12.5 L13 12 Z" fill="white" opacity="0.9"/>
            
            {/* Tiny dancing legs */}
            <motion.ellipse 
              cx="9" 
              cy="15" 
              rx="1" 
              ry="1.5" 
              fill="currentColor"
              stroke="white"
              strokeWidth="0.8"
              animate={!isMuted ? { 
                rotate: [-10, 10, -10],
                x: [-0.8, 0.8, -0.8]
              } : {}}
              transition={{ duration: 0.4, repeat: !isMuted ? Infinity : 0, delay: 0 }}
            />
            <motion.ellipse 
              cx="15" 
              cy="15" 
              rx="1" 
              ry="1.5" 
              fill="currentColor"
              stroke="white"
              strokeWidth="0.8"
              animate={!isMuted ? { 
                rotate: [10, -10, 10],
                x: [0.8, -0.8, 0.8]
              } : {}}
              transition={{ duration: 0.4, repeat: !isMuted ? Infinity : 0, delay: 0.2 }}
            />
          </svg>
        </motion.div>

        <div className="relative">
          {/* Music Button */}
          <motion.button
            onClick={toggleMute}
            className={`relative p-3 rounded-2xl transition-all duration-300 backdrop-blur-sm ${
              isMuted 
                ? 'bg-red-900/80 border border-red-400/50 shadow-lg shadow-red-400/20' 
                : 'bg-emerald-900/80 border border-emerald-400/50 shadow-lg shadow-emerald-400/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-mute-music"
          >
            {/* Animated Equalizer Bars */}
            <div className="flex items-end justify-center space-x-0.5">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1.5 rounded-full ${
                    isMuted ? 'bg-red-400/50' : 'bg-emerald-400'
                  }`}
                  style={{ height: '12px' }}
                  animate={!isMuted ? {
                    scaleY: [0.3, 1.5, 0.3],
                    opacity: [0.5, 1, 0.5]
                  } : { scaleY: 0.3 }}
                  transition={{
                    duration: 0.7,
                    repeat: !isMuted ? Infinity : 0,
                    delay: i * 0.1,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>

            {/* Mute indicator when disabled */}
            {isMuted && (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="text-red-400 text-lg font-bold">🔇</div>
              </motion.div>
            )}
          </motion.button>
        </div>
      </div>

      {/* Compact Wallet Connect - Top Right */}
      <div className="fixed top-6 right-6 z-30">
        <WalletConnectCompact />
      </div>


      {/* Main Content */}
      <div className="relative z-10 px-6 py-8 pb-24">
        {/* User Profile - Compact */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="w-16 h-16 mx-auto mb-2 flex items-center justify-center"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.img 
              src={newLogo} 
              alt="ARBSPIN Logo" 
              className="w-full h-full object-contain"
              animate={{ rotate: 360 }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>
          <div className="mb-2">
            <motion.h1 
              className="text-2xl font-bold text-white mb-1"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              ARB<TypewriterText />
            </motion.h1>
          </div>
          <h2 className="text-lg font-semibold text-white">
            {farcasterLoading ? (
              "Hello, Player!"
            ) : (
              `Hello, ${displayName}!`
            )}
          </h2>
          {!farcasterLoading && username && username !== displayName && (
            <p className="text-sm text-white/60 mt-1">
              @{username}
            </p>
          )}
          
          {/* Fun-only mode indicator - check for temporary users */}
          {(user?.isTemporary || user?.id?.startsWith('temp_')) && (
            <motion.div 
              className="mt-3 px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center space-x-1"
              style={{
                background: 'rgba(255, 165, 0, 0.15)',
                border: '1px solid rgba(255, 165, 0, 0.3)',
                color: '#ffa500'
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <span>🎮</span>
              <span>Fun Mode - Results Not Saved</span>
            </motion.div>
          )}
        </motion.div>

        {/* Main Action Cards - Compact */}
        <div className="space-y-6 mb-6">
          {/* Spin Challenge Card */}
          <motion.div
            className="rounded-2xl p-6 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              transform: 'perspective(1000px) rotateX(2deg) rotateY(-1deg)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset',
              border: 'none',
              outline: 'none'
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
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)',
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
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" key="casino-wheel-bright">
                    {/* Bright outline casino wheel */}
                    <circle cx="12" cy="12" r="10" stroke="#FFEB3B" strokeWidth="2" fill="none"/>
                    <circle cx="12" cy="12" r="6" stroke="#FF5722" strokeWidth="1.5" fill="none"/>
                    <circle cx="12" cy="12" r="1.5" fill="#FFEB3B"/>
                    {/* Bright colored segments - just outlines */}
                    <path d="M12 2 L12 6" stroke="#FF5722" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M22 12 L18 12" stroke="#2196F3" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M12 22 L12 18" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M2 12 L6 12" stroke="#FF9800" strokeWidth="3" strokeLinecap="round"/>
                    {/* Diagonal spokes */}
                    <path d="M18.36 5.64 L15.54 8.46" stroke="#E91E63" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M18.36 18.36 L15.54 15.54" stroke="#9C27B0" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M5.64 18.36 L8.46 15.54" stroke="#00BCD4" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M5.64 5.64 L8.46 8.46" stroke="#8BC34A" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <h2 className="text-lg font-bold">Spin a Wheel</h2>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" key="tokens-bright">
                    {/* Bright outline tokens */}
                    <circle cx="9" cy="8" r="5" stroke="#FFEB3B" strokeWidth="2.5" fill="none"/>
                    <circle cx="15" cy="16" r="5" stroke="#FF5722" strokeWidth="2.5" fill="none"/>
                    <circle cx="9" cy="8" r="2" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                    <circle cx="15" cy="16" r="2" stroke="#FF9800" strokeWidth="1.5" fill="none"/>
                    {/* Bright sparkle lines */}
                    <path d="M9 4 L9 12" stroke="#FFEB3B" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M5 8 L13 8" stroke="#FFEB3B" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M15 12 L15 20" stroke="#FF5722" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M11 16 L19 16" stroke="#FF5722" strokeWidth="2" strokeLinecap="round"/>
                    {/* Dollar signs */}
                    <path d="M8 6 Q9 5.5 10 6 Q9 8.5 8 6" stroke="#FFC107" strokeWidth="1.5" fill="none"/>
                    <path d="M14 14 Q15 13.5 16 14 Q15 16.5 14 14" stroke="#FF9800" strokeWidth="1.5" fill="none"/>
                  </svg>
                  <p className="text-teal-100 text-sm">Win meme tokens daily</p>
                </div>
                <div className="text-xs text-teal-100">
                  <CountdownTimer />
                </div>
              </div>
              <div className="relative z-20">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-2">
                  <motion.svg 
                    className="w-6 h-6 text-white" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    {/* Outer wheel circle */}
                    <circle 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      fill="none"
                    />
                    {/* Inner segments */}
                    <path 
                      d="M12 2 L12 12 L22 12" 
                      stroke="currentColor" 
                      strokeWidth="1" 
                      fill="rgba(255,255,255,0.1)"
                    />
                    <path 
                      d="M12 12 L22 12 L12 22" 
                      stroke="currentColor" 
                      strokeWidth="1" 
                      fill="rgba(255,255,255,0.05)"
                    />
                    <path 
                      d="M12 12 L12 22 L2 12" 
                      stroke="currentColor" 
                      strokeWidth="1" 
                      fill="rgba(255,255,255,0.1)"
                    />
                    <path 
                      d="M12 12 L2 12 L12 2" 
                      stroke="currentColor" 
                      strokeWidth="1" 
                      fill="rgba(255,255,255,0.05)"
                    />
                    {/* Center circle */}
                    <circle 
                      cx="12" 
                      cy="12" 
                      r="2" 
                      fill="currentColor"
                    />
                    {/* Pointer/indicator */}
                    <polygon 
                      points="12,1 10,4 14,4" 
                      fill="currentColor"
                    />
                  </motion.svg>
                </div>
                <div className="flex flex-col items-center">
                  <button
                    className="bg-black text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white/20 cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => setShowSpinWheel(true)}
                  >
                    <svg 
                      className="w-5 h-5 text-white" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M5 12H19M19 12L12 5M19 12L12 19" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <p className="text-xs text-white/80 mt-1 font-medium">
                    Spin
                  </p>
                </div>
              </div>
            </div>
            </div>
          </motion.div>

          {/* Rewards Card */}
          <motion.div
            className="rounded-2xl p-6 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              transform: 'perspective(1000px) rotateX(-1deg) rotateY(1deg)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 1px 8px rgba(255, 255, 255, 0.1) inset',
              border: 'none',
              outline: 'none'
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
              className="absolute inset-0 rounded-3xl"
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
            <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15L8 19H16L12 15Z" fill="currentColor"/>
                    <path d="M7 9V4C7 3.45 7.45 3 8 3H16C16.55 3 17 3.45 17 4V9L19 11V12H5V11L7 9Z" fill="currentColor"/>
                    <rect x="8" y="13" width="8" height="2" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base">🏆 Total Wins</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="text-lg font-bold text-white">
                      {user?.totalWins || 0}
                    </div>
                    <span className="text-xs text-white/60">winning spins</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        </div>

        {/* Daily Spins Section */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div 
            className="rounded-xl p-5 text-white relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              transform: 'perspective(1000px) rotateX(1deg) rotateY(-0.5deg)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2), 0 1px 8px rgba(255, 255, 255, 0.1) inset',
              border: 'none',
              outline: 'none'
            }}
            whileHover={{ 
              scale: 1.01, 
              y: -2,
              transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
              transition: { duration: 0.3 }
            }}
          >
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #2D374B 0%, #4A90E2 50%, #96BEDC 100%)',
                opacity: 0.9
              }}
            />
            <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">🎯 Daily Spins ({user?.spinsUsed || 0}/3 used)</h4>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <div className="flex items-center space-x-2 mb-1">
              <div className="flex-1 bg-white/30 rounded-full h-1.5">
                <div 
                  className="bg-white rounded-full h-1.5 transition-all duration-500"
                  style={{ width: `${((typeof user?.spinsUsed === 'string' ? parseInt(user.spinsUsed, 10) || 0 : user?.spinsUsed || 0) / 3) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-medium">{(((typeof user?.spinsUsed === 'string' ? parseInt(user.spinsUsed, 10) || 0 : user?.spinsUsed || 0) / 3) * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs text-white/80">
              {3 - (typeof user?.spinsUsed === 'string' ? parseInt(user.spinsUsed, 10) || 0 : user?.spinsUsed || 0) > 0 
                ? `${3 - (typeof user?.spinsUsed === 'string' ? parseInt(user.spinsUsed, 10) || 0 : user?.spinsUsed || 0)} spins remaining today! 🎮 Good luck!`
                : 'All daily spins used - check back tomorrow for more!'
              }
            </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Token Voting Section - Replace Token Collection */}
        <TokenVoting 
          userId={user?.id} 
          isAuthenticated={user && !user.isTemporary}
        />


      </div>

      {/* Navigation */}
      <Navigation />




      
      {/* Spin Wheel Modal */}
      <AnimatePresence>
        {showSpinWheel && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSpinWheel(false)}
            style={{ 
              touchAction: 'none',
              transform: 'translateZ(0)', // Hardware acceleration
              overflow: 'hidden'
            }}
          >
            <motion.div
              className="absolute top-8 left-4 right-4 rounded-3xl max-w-md mx-auto relative flex flex-col will-change-transform overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 1px 8px rgba(255, 255, 255, 0.1) inset',
                maxHeight: '90vh',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                border: 'none',
                outline: 'none',
                width: 'calc(100% - 32px)',
                maxWidth: '400px'
              }}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
                {/* Top highlight */}
                <div 
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
                  }}
                />
                
                {/* Fixed Header - Outside of scrollable area */}
                <div className="flex items-center justify-between p-6 pb-4 rounded-t-3xl"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                       borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                     }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                        <path d="M12 2 L12 12 L22 12" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.2)"/>
                        <path d="M12 12 L22 12 L12 22" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)"/>
                        <path d="M12 12 L12 22 L2 12" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.2)"/>
                        <path d="M12 12 L2 12 L12 2" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)"/>
                        <circle cx="12" cy="12" r="2" fill="currentColor"/>
                        <polygon points="12,1 10,4 14,4" fill="currentColor"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold">
                      <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">ARB</span>
                      <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">SPIN</span>
                      <span className="text-white/60 text-base ml-2 font-normal">- Wheel of Fortune</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowSpinWheel(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 group"
                  >
                    <span className="text-white/80 group-hover:text-white text-lg">✕</span>
                  </button>
                </div>

                {/* Scrollable Content Area */}
                <div 
                  className="flex-1 p-6 pt-2 overflow-y-auto overflow-x-hidden"
                  style={{
                    transform: 'translateZ(0)', // Hardware acceleration for smooth scroll
                    WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
                    maxHeight: 'calc(90vh - 100px)' // Account for header height
                  }}
                >
                  <SpinWheelSimple 
                    userSpinsUsed={typeof user?.spinsUsed === 'string' ? parseInt(user.spinsUsed, 10) || 0 : user?.spinsUsed || 0}
                    userId={user?.id || ''}
                    userAccumulated={balances ? {
                      AIDOGE: balances.token1,
                      BOOP: balances.token2,
                      ARB: balances.token3
                    } : undefined}
                    onSpinComplete={(result) => {
                      // Refresh user data to update balances without full page reload
                      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
                    }}
                  />
                </div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
