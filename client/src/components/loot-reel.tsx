import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import aidogeLogo from "@assets/photo_2023-04-18_14-25-28_1754468465899.jpg";
import boopLogo from "@assets/Boop_resized_1754468548333.webp";
import catchLogo from "@assets/Logomark_colours_1754468507462.webp";

interface MemeReelProps {
  symbol: string;
  isSpinning: boolean;
  delay?: number;
}

const memeTokens = [
  {
    id: '0x09e18590e8f76b6cf471b3cd75fe1a1a9d2b2c2b',
    name: 'AIDOGE',
    image: aidogeLogo,

    color: '#FF6B35',
    gradient: 'linear-gradient(135deg, #FF6B35, #F7931E)'
  },
  {
    id: '0x13a7dedb7169a17be92b0e3c7c2315b46f4772b3',
    name: 'BOOP',
    image: boopLogo,

    color: '#4ECDC4',
    gradient: 'linear-gradient(135deg, #4ECDC4, #44A08D)'
  },
  {
    id: '0xbc4c97fb9befaa8b41448e1dfcc5236da543217f',
    name: 'CATCH',
    image: catchLogo,

    color: '#45B7D1',
    gradient: 'linear-gradient(135deg, #45B7D1, #96C93D)'
  }
];

const getMemeToken = (tokenAddress: string) => {
  return memeTokens.find(token => token.id === tokenAddress) || memeTokens[0];
};

export default function MemeReel({ symbol, isSpinning, delay = 0 }: MemeReelProps) {
  const [displaySymbol, setDisplaySymbol] = useState(symbol);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'spinning' | 'stopping' | 'complete'>('idle');

  const currentMeme = getMemeToken(displaySymbol);

  useEffect(() => {
    if (isSpinning) {
      setTimeout(() => {
        setAnimationPhase('spinning');
        
        // Fast meme cycling
        const fastInterval = setInterval(() => {
          const randomMeme = memeTokens[Math.floor(Math.random() * memeTokens.length)];
          setDisplaySymbol(randomMeme.id);
        }, 60);

        // Slow down phase
        setTimeout(() => {
          clearInterval(fastInterval);
          setAnimationPhase('stopping');
          
          const slowInterval = setInterval(() => {
            const randomMeme = memeTokens[Math.floor(Math.random() * memeTokens.length)];
            setDisplaySymbol(randomMeme.id);
          }, 150);

          // Final reveal
          setTimeout(() => {
            clearInterval(slowInterval);
            setDisplaySymbol(symbol);
            setAnimationPhase('complete');
          }, 600);
        }, 1200);
      }, delay);
    } else {
      setAnimationPhase('idle');
    }
  }, [isSpinning, symbol, delay]);

  const getAnimationVariants = () => {
    switch (animationPhase) {
      case 'spinning':
        return {
          y: [0, -200, 0, -200, 0],
          rotateX: [0, 180, 360, 540, 720],
          scale: [1, 0.8, 1, 0.8, 1],
          transition: {
            duration: 1.5,
            ease: "linear",
            repeat: Infinity
          }
        };
      case 'stopping':
        return {
          y: [0, -100, 0],
          rotateX: [0, 180, 360],
          scale: [1, 0.9, 1],
          transition: {
            duration: 0.8,
            ease: "easeOut"
          }
        };
      case 'complete':
        return {
          scale: [0.8, 1.2, 1],
          rotateX: [360, 0],
          transition: {
            duration: 0.6,
            ease: "backOut"
          }
        };
      default:
        return {};
    }
  };

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      {/* Main Reel Content */}
      <motion.div
        className="w-full h-full flex flex-col items-center justify-center relative"
        animate={getAnimationVariants()}
        style={{
          filter: animationPhase === 'spinning' ? "blur(2px)" : "none",
          background: animationPhase === 'spinning' 
            ? 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.1))'
            : 'transparent'
        }}
      >
        {/* Token Image with Glass Effect */}
        <div 
          className="w-12 h-12 rounded-xl overflow-hidden mb-1 relative"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)',
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}
        >
          <img 
            src={currentMeme.image} 
            alt={currentMeme.name}
            className="w-full h-full object-cover"
            style={{
              filter: animationPhase === 'spinning' 
                ? "blur(1px) brightness(1.3) saturate(1.2)" 
                : "brightness(1.1) contrast(1.1) saturate(1.1)"
            }}
          />
          
          {/* Overlay Glow */}
          <div 
            className="absolute inset-0 rounded-xl opacity-40"
            style={{
              background: animationPhase === 'spinning' 
                ? currentMeme.gradient
                : 'transparent',
              mixBlendMode: 'overlay'
            }}
          />
        </div>

        {/* Token Name with Modern Typography */}
        <div 
          className="text-xs font-bold text-center px-1 leading-tight"
          style={{ 
            fontSize: '8px',
            color: animationPhase === 'complete' ? currentMeme.color : '#e2e8f0',
            textShadow: animationPhase === 'complete' 
              ? `0 0 8px ${currentMeme.color}40`
              : '0 1px 2px rgba(0,0,0,0.8)',
            fontWeight: '800',
            letterSpacing: '0.5px'
          }}
        >
          {currentMeme.name}
        </div>

        {/* Completion Effects */}
        <AnimatePresence>
          {animationPhase === 'complete' && (
            <>
              {/* Victory Particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: currentMeme.color,
                    left: `${30 + (i % 3) * 20}%`,
                    top: `${25 + Math.floor(i / 3) * 30}%`,
                    boxShadow: `0 0 4px ${currentMeme.color}`
                  }}
                  initial={{ opacity: 0, scale: 0, rotate: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 2, 0],
                    rotate: [0, 180],
                    y: [0, -10, 0]
                  }}
                  transition={{
                    duration: 1,
                    delay: i * 0.1
                  }}
                  exit={{ opacity: 0 }}
                >
                </motion.div>
              ))}
              
              {/* Glow Ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 opacity-60"
                style={{
                  borderColor: currentMeme.color,
                  boxShadow: `0 0 20px ${currentMeme.color}40`
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [0.8, 1.1, 1],
                  opacity: [0, 0.8, 0]
                }}
                transition={{
                  duration: 1.5,
                  times: [0, 0.4, 1]
                }}
                exit={{ opacity: 0 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Spinning Effects */}
        {animationPhase === 'spinning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}