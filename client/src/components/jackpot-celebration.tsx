import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Share2, Trophy, Zap, Sparkles, Crown } from "lucide-react";
import { useFarcaster } from "@/hooks/use-farcaster";
// @ts-ignore
import confetti from "canvas-confetti";

interface JackpotCelebrationProps {
  isVisible: boolean;
  rewardAmount: string;
  onClose: () => void;
  onShare: () => void;
}

export default function JackpotCelebration({ 
  isVisible, 
  rewardAmount, 
  onClose, 
  onShare 
}: JackpotCelebrationProps) {
  const [showShareCard, setShowShareCard] = useState(false);
  const [currentEffect, setCurrentEffect] = useState(0);
  const { displayName, username, isAuthenticated } = useFarcaster();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Epic fireworks animation
  const fireConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    // Multi-color explosion
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#FFD700', '#FF6B35', '#F7931E', '#FFE135']
    });
    fire(0.2, {
      spread: 60,
      colors: ['#FF1744', '#E91E63', '#9C27B0', '#673AB7']
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#00E676', '#1DE9B6', '#00BCD4', '#03A9F4']
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#FFD700', '#FFA000', '#FF8F00', '#FF6F00']
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#FF4081', '#E040FB', '#7C4DFF', '#536DFE']
    });
  };

  // Continuous fireworks
  useEffect(() => {
    if (isVisible) {
      // Initial big explosion
      setTimeout(() => fireConfetti(), 300);
      
      // Secondary explosions
      setTimeout(() => fireConfetti(), 1000);
      setTimeout(() => fireConfetti(), 1800);
      setTimeout(() => fireConfetti(), 2500);
      
      // Create epic jackpot sound (Web Audio API)
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Epic jackpot fanfare
        const playNote = (frequency: number, duration: number, delay: number) => {
          setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sawtooth';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
          }, delay);
        };

        // Epic ascending fanfare
        playNote(261.63, 0.3, 0);    // C4
        playNote(329.63, 0.3, 150);  // E4
        playNote(392.00, 0.3, 300);  // G4
        playNote(523.25, 0.8, 450);  // C5 (dramatic hold)
        playNote(659.25, 0.6, 800);  // E5
        playNote(783.99, 1.2, 1000); // G5 (epic finale)
        
      } catch (error) {
        console.log('Audio not available');
      }

      // Animate text effects
      const effectInterval = setInterval(() => {
        setCurrentEffect(prev => (prev + 1) % 6);
      }, 500);

      return () => clearInterval(effectInterval);
    }
  }, [isVisible]);

  // Generate share image URL for Farcaster
  const generateShareImage = () => {
    const params = new URLSearchParams({
      type: 'jackpot',
      amount: rewardAmount,
      player: displayName || username || 'Anonymous Player',
      timestamp: Date.now().toString()
    });
    return `${window.location.origin}/api/share-image?${params}`;
  };

  const handleShare = async () => {
    try {
      const shareImageUrl = generateShareImage();
      const shareText = `🎰💥 JACKPOT! 💥🎰\n\nJust won ${(parseFloat(rewardAmount) / 1e18).toFixed(1)} tokens on ArbCasino! \n\nFeeling lucky? Try your spin! 🍀`;
      
      // Generate Farcaster embed metadata
      const embedData = {
        version: "1",
        imageUrl: shareImageUrl,
        button: {
          title: "🎰 Spin for Jackpot",
          action: {
            type: "launch_miniapp",
            url: window.location.origin,
            name: "ArbCasino",
            splashImageUrl: `${window.location.origin}/logo-icon.png`,
            splashBackgroundColor: "#1a1a1a"
          }
        }
      };

      // Copy to clipboard for sharing
      await navigator.clipboard.writeText(shareText);
      
      setShowShareCard(true);
      onShare();
      
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const effects = [
    { text: "🎰 JACKPOT! 🎰", color: "text-yellow-300", shadow: "drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]" },
    { text: "💥 EPIC WIN! 💥", color: "text-orange-300", shadow: "drop-shadow-[0_0_20px_rgba(255,165,0,0.8)]" },
    { text: "🔥 LEGENDARY! 🔥", color: "text-red-300", shadow: "drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]" },
    { text: "⚡ AMAZING! ⚡", color: "text-blue-300", shadow: "drop-shadow-[0_0_20px_rgba(0,191,255,0.8)]" },
    { text: "✨ INCREDIBLE! ✨", color: "text-purple-300", shadow: "drop-shadow-[0_0_20px_rgba(138,43,226,0.8)]" },
    { text: "👑 CHAMPION! 👑", color: "text-green-300", shadow: "drop-shadow-[0_0_20px_rgba(0,255,127,0.8)]" }
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[9998]"
          onClick={onClose}
        >
          {/* Screen shake container */}
          <motion.div
            animate={{
              x: [0, -2, 2, -2, 2, 0],
              y: [0, -1, 1, -1, 1, 0],
            }}
            transition={{
              duration: 0.4,
              repeat: 3,
              ease: "easeInOut"
            }}
            className="w-full h-full relative"
          >
            
            {/* Pulsing background glow */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-radial from-yellow-500/20 via-orange-500/10 to-transparent"
            />

            {/* Main celebration content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              
              {/* Crown Icon */}
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -5, 5, 0],
                  scale: [1, 1.2, 1.1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="mb-6"
              >
                <Crown className="w-24 h-24 text-yellow-400" fill="currentColor" />
              </motion.div>

              {/* Animated Main Text */}
              <motion.h1
                key={currentEffect}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20 
                }}
                className={`text-6xl md:text-8xl font-black mb-4 ${effects[currentEffect].color} ${effects[currentEffect].shadow}`}
                style={{
                  textShadow: '0 0 30px currentColor',
                  fontFamily: 'Impact, Arial Black, sans-serif'
                }}
              >
                {effects[currentEffect].text}
              </motion.h1>

              {/* Reward Amount */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  textShadow: [
                    '0 0 20px rgba(255,215,0,0.8)',
                    '0 0 40px rgba(255,215,0,1)',
                    '0 0 20px rgba(255,215,0,0.8)'
                  ]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="text-4xl md:text-5xl font-bold text-yellow-300 mb-8"
              >
                +{(parseFloat(rewardAmount) / 1e18).toFixed(1)} TOKENS!
              </motion.div>

              {/* Player Name */}
              {(displayName || username) && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-xl text-white/80 mb-8"
                >
                  Congratulations, {displayName || username}! 🎉
                </motion.p>
              )}

              {/* Action Buttons */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                {/* Share Button */}
                <Button
                  onClick={handleShare}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-bold rounded-xl border-2 border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share Epic Win! 
                </Button>

                {/* Continue Button */}
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 px-8 py-4 text-lg font-bold rounded-xl"
                >
                  Continue Playing
                </Button>
              </motion.div>

              {/* Floating particles */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      y: [0, -100, -200],
                      x: [0, (Math.random() - 0.5) * 200],
                      opacity: [1, 0.8, 0],
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: 3 + Math.random() * 2,
                      delay: Math.random() * 2,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                    className="absolute"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${80 + Math.random() * 20}%`,
                    }}
                  >
                    {['💎', '🎰', '⚡', '🔥', '✨', '💰', '🏆'][Math.floor(Math.random() * 7)]}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Share Card Modal */}
          <AnimatePresence>
            {showShareCard && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-4 bg-gray-900 border-2 border-yellow-400 rounded-2xl p-6 flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Trophy className="w-16 h-16 text-yellow-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Share Your Epic Win!</h3>
                <p className="text-gray-300 text-center mb-6">
                  Share card copied to clipboard! Post it on Farcaster to flex your jackpot win! 💪
                </p>
                <Button
                  onClick={() => setShowShareCard(false)}
                  className="bg-yellow-400 text-black hover:bg-yellow-500"
                >
                  Awesome! 🎉
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}