import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { formatUnits } from "ethers";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift } from "lucide-react";
import { useSimpleSpin } from "@/hooks/use-simple-spin";
import JackpotCelebration from "./jackpot-celebration";
import aidogeLogo from "@assets/aidoge_1755435810322.png";
import boopLogo from "@assets/boop_1755435810327.png";
import arbLogo from "@assets/Adobe Express - file_1755685469543.png";

const WHEEL_SEGMENTS = [
  { name: 'AIDOGE', color: '#3B82F6', reward: '1' },
  { name: 'BUST', color: '#EF4444', reward: '0' },
  { name: 'BOOP', color: '#10B981', reward: '2' },
  { name: 'BONUS', color: '#F59E0B', reward: '2x' },
  { name: 'ARB', color: '#8B5CF6', reward: '0.5' },
  { name: 'BUST', color: '#EF4444', reward: '0' },
  { name: 'AIDOGE', color: '#3B82F6', reward: '1' },
  { name: 'JACKPOT', color: '#F97316', reward: '10x' },
];

// Map server segment names to display names
const SEGMENT_MAPPING: { [key: string]: string } = {
  'AIDOGE': 'AIDOGE',
  'ARB': 'ARB',
  'BOOP': 'BOOP',
  'BUST': 'BUST',
  'BONUS': 'BONUS',
  'JACKPOT': 'JACKPOT'
};

// Server-side spinning only (no contract dependencies)

interface SpinResult {
  segment: string;
  isWin: boolean;
  reward?: string;
  rewardAmount?: string;
  tokenAddress?: string;
  transactionHash?: string;
  tokenType?: string;
}

interface SpinWheelSimpleProps {
  onSpinComplete?: (result: SpinResult) => void;
  userSpinsUsed: number;
  userId?: string;
  userAccumulated?: {
    AIDOGE: string;
    BOOP: string;
    ARB: string;
  };
}

// Helper function to format token amounts from Wei to human-readable
const formatTokenAmount = (amount: string, decimals = 18) => {
  try {
    const parsed = parseFloat(formatUnits(amount, decimals));
    if (parsed >= 1000000) {
      return `${(parsed / 1000000).toFixed(1)}M`;
    } else if (parsed >= 1000) {
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
};

export default function SpinWheelSimple({ onSpinComplete, userSpinsUsed, userId, userAccumulated }: SpinWheelSimpleProps) {
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [sessionSpinsUsed, setSessionSpinsUsed] = useState(userSpinsUsed);
  const [showJackpotCelebration, setShowJackpotCelebration] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { isSpinning, triggerSpin, lastSpinResult, resetSpinResult } = useSimpleSpin();

  // Prevent page scrollbars during spinning by managing body overflow
  useEffect(() => {
    if (isSpinning) {
      // Prevent page scrolling during spin animation
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore normal scrolling
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isSpinning]);
  
  // Audio context for wheel spinning sound
  const audioContextRef = useRef<AudioContext | null>(null);
  const wheelSoundRef = useRef<{
    oscillator?: OscillatorNode;
    gainNode?: GainNode;
    sources?: AudioBufferSourceNode[];
    isPlaying: boolean;
  }>({ isPlaying: false });

  // Initialize audio context
  useEffect(() => {
    const initAudio = () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Web Audio API not supported');
      }
    };

    // Initialize on first user interaction
    const handleUserInteraction = () => {
      if (!audioContextRef.current) {
        initAudio();
      }
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Create realistic casino wheel clicking sound with Android compatibility
  const playWheelSpinSound = () => {
    // Skip audio on mobile browsers that have issues
    if (!audioContextRef.current || wheelSoundRef.current.isPlaying) return;
    
    // Android compatibility check
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.includes('android') && userAgent.includes('chrome')) {
        // Skip audio on Android Chrome to prevent runtime errors
        return;
      }
    }

    try {
      const audioContext = audioContextRef.current;
      wheelSoundRef.current.isPlaying = true;
      
      // Create a series of "tick" sounds that slow down over time like a real wheel
      const createTick = (time: number, volume: number) => {
        // Create noise burst for tick sound
        const bufferSize = audioContext.sampleRate * 0.02; // 20ms tick
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate sharp tick sound with noise and quick decay
        for (let i = 0; i < bufferSize; i++) {
          const decay = Math.exp(-i / bufferSize * 15); // Quick decay
          data[i] = (Math.random() * 2 - 1) * decay * volume;
        }
        
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // High volume to cut through background music
        gainNode.gain.value = 0.7;
        
        source.start(time);
        
        return source;
      };
      
      // Create series of ticks that slow down over 4 seconds
      const startTime = audioContext.currentTime;
      let currentTime = startTime;
      let tickInterval = 0.08; // Start with 8 ticks per second (fast spinning)
      const sources: AudioBufferSourceNode[] = [];
      
      // Create ticks for 4 seconds, gradually slowing down
      while (currentTime - startTime < 4) {
        const progress = (currentTime - startTime) / 4;
        const volume = 1 - progress * 0.3; // Slightly reduce volume as it slows
        
        sources.push(createTick(currentTime, volume));
        
        // Gradually increase tick interval (slow down the wheel)
        tickInterval = 0.08 + (progress * progress * 0.15); // Exponential slowdown
        currentTime += tickInterval;
      }
      
      // Store references for cleanup
      wheelSoundRef.current = { 
        isPlaying: true,
        sources // Store sources instead of oscillator
      };
      
      // Stop after 4 seconds
      setTimeout(() => {
        if (wheelSoundRef.current.sources) {
          wheelSoundRef.current.sources.forEach(source => {
            try {
              source.stop();
            } catch (e) {
              // Source may already be stopped
            }
          });
        }
        wheelSoundRef.current.isPlaying = false;
      }, 4200); // Slightly longer to ensure all ticks complete
      
    } catch (error) {
      console.warn('Audio playback failed (mobile compatibility):', error);
      wheelSoundRef.current.isPlaying = false;
    }
  };

  // Stop wheel sound if needed
  const stopWheelSpinSound = () => {
    if (wheelSoundRef.current.isPlaying) {
      if (wheelSoundRef.current.oscillator) {
        wheelSoundRef.current.oscillator.stop();
      }
      if (wheelSoundRef.current.sources) {
        wheelSoundRef.current.sources.forEach(source => {
          try {
            source.stop();
          } catch (e) {
            // Source may already be stopped
          }
        });
      }
      wheelSoundRef.current.isPlaying = false;
    }
  };
  
  // Check if user has spins available (3 per day)
  const hasSpinsRemaining = userSpinsUsed < 3;
  
  // Update session spins when props change
  useEffect(() => {
    setSessionSpinsUsed(userSpinsUsed);
  }, [userSpinsUsed]);

  // Handle spin result from server-side spinning with improved animation
  useEffect(() => {
    if (lastSpinResult) {
      // Map server segment name to display segment name
      const displaySegmentName = SEGMENT_MAPPING[lastSpinResult.segment] || lastSpinResult.segment;
      
      // Find the segment in our wheel array
      const resultSegment = WHEEL_SEGMENTS.find(s => s.name === displaySegmentName);
      if (!resultSegment) {
        console.error('Segment not found:', displaySegmentName);
        return;
      }
      
      const segmentIndex = WHEEL_SEGMENTS.indexOf(resultSegment);
      const segmentAngle = 360 / WHEEL_SEGMENTS.length;
      
      // Calculate exact rotation to land arrow on center of winning segment
      console.log(`🎯 Targeting segment: ${displaySegmentName} (server: ${lastSpinResult.segment}) at index ${segmentIndex}`);
      
      // Each segment is 45 degrees (360/8)
      const segmentCenterAngle = (segmentIndex * segmentAngle) + (segmentAngle / 2);
      console.log(`📐 Segment center angle: ${segmentCenterAngle}°`);
      
      // Calculate current effective position (where the wheel currently points)
      const currentEffectivePosition = rotation % 360;
      console.log(`🔄 Current effective position: ${currentEffectivePosition}°`);
      
      // To align the segment center with the top arrow (0°), we need to calculate
      // the shortest path to the target position
      let targetRotation = -segmentCenterAngle;
      
      // Adjust target rotation to be relative to current position
      // We want to end up at targetRotation, starting from currentEffectivePosition
      let rotationDifference = targetRotation - currentEffectivePosition;
      
      // Normalize to take the shortest path (avoid unnecessary full rotations)
      if (rotationDifference > 180) {
        rotationDifference -= 360;
      } else if (rotationDifference < -180) {
        rotationDifference += 360;
      }
      
      const spins = 4; // 4 full rotations for dramatic effect
      const finalRotation = rotation + (spins * 360) + rotationDifference;
      
      console.log(`🔄 Current rotation: ${rotation}°, Difference needed: ${rotationDifference}°, Final: ${finalRotation}°`);
      
      // Start the wheel animation and sound
      setRotation(finalRotation);
      playWheelSpinSound();
      
      // Set the confirmed result after animation completes
      const resultTimeout = setTimeout(() => {
        const displaySegmentName = SEGMENT_MAPPING[lastSpinResult.segment] || lastSpinResult.segment;
        const finalResult = {
          segment: displaySegmentName,
          isWin: lastSpinResult.isWin,
          reward: lastSpinResult.rewardAmount || '0',
          tokenType: lastSpinResult.tokenType,
          txHash: lastSpinResult.txHash
        };
        
        // 🎰 TRIGGER EPIC JACKPOT CELEBRATION! 🎰
        if (displaySegmentName === 'JACKPOT') {
          setTimeout(() => {
            setShowJackpotCelebration(true);
          }, 1000); // Small delay after result shows
        }
        
        setResult(finalResult);
        
        // Center display shows winning result for 3-4 seconds
        
        // Update session spin count for server spins
        setSessionSpinsUsed(prev => prev + 1);
        
        if (onSpinComplete) {
          onSpinComplete(finalResult);
        }
        
        // Don't auto-clear result - let it persist until next spin
        // User requested that reward popup stays visible until they spin again
      }, 4500); // Wait for wheel animation (4s) + small delay (0.5s)
      
      return () => clearTimeout(resultTimeout);
    }
  }, [lastSpinResult]); // Only depend on lastSpinResult



  const handleSpin = async () => {
    // Prevent multiple spins - check all blocking conditions
    if (userSpinsUsed >= 3 || isSpinning) {
      return; // Don't allow spin if: daily limit reached or currently spinning
    }

    // Check if user ID is available
    if (!userId) {
      return; // Don't show toast - user will see the wheel doesn't spin
    }

    // Clear previous result when starting new spin
    setResult(null);
    resetSpinResult();

    // Use server-side spinning with the new hook
    await triggerSpin(userId);
  };





  const handleBatchClaim = async () => {
    if (!address || !userId) return;

    try {
      const response = await fetch('/api/claim-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userAddress: address
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Batch claim failed');
      }

      const claimResult = await response.json();
      
      toast({
        title: "🎉 All Tokens Claimed!",
        description: `All accumulated rewards sent to your wallet`,
      });

      // Refresh by calling parent callback
      if (onSpinComplete) {
        onSpinComplete({
          segment: 'CLAIM_ALL',
          isWin: true,
          rewardAmount: '0',
          tokenType: 'ALL'
        });
      }

    } catch (error: any) {
      toast({
        title: "Batch Claim Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  return (
    <div className="flex flex-col items-center space-y-4 max-h-full" style={{ maxHeight: '80vh' }}>

      {/* Wheel Container - Centered */}
      <div className="relative w-full flex justify-center">
        
        {/* Arrow Pointer */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20">
          <div style={{
            width: '0',
            height: '0',
            borderLeft: '18px solid transparent',
            borderRight: '18px solid transparent',
            borderTop: '28px solid #fbbf24',
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7))'
          }}></div>
        </div>

        {/* Spinning Wheel with Border */}
        <motion.div
          className="w-72 h-72 rounded-full relative overflow-hidden"
          style={{
            border: '4px solid #fbbf24',
            backgroundColor: 'transparent',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.4)'
          }}
          animate={{ 
            rotate: rotation,
            scale: isSpinning ? 1.01 : 1
          }}
          transition={{
            rotate: {
              duration: 4.5,
              ease: "easeInOut",
              type: "tween"
            },
            scale: {
              duration: 0.3,
              ease: "easeOut"
            }
          }}
        >
          {WHEEL_SEGMENTS.map((segment, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            
            return (
              <div
                key={index}
                className="absolute w-full h-full will-change-transform"
                style={{
                  backgroundColor: segment.color,
                  clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180)}%)`,
                  transform: 'translateZ(0)',
                  WebkitTransform: 'translateZ(0)'
                }}
              >
                <div 
                  className="absolute text-white font-bold text-sm"
                  style={{
                    left: `${50 + 35 * Math.cos((startAngle + segmentAngle/2 - 90) * Math.PI / 180)}%`,
                    top: `${50 + 35 * Math.sin((startAngle + segmentAngle/2 - 90) * Math.PI / 180)}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {segment.name}
                </div>
              </div>
            );
          })}
          
          {/* Center Circle - Dynamic display based on spin result */}
          <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gray-800 rounded-full border-3 ${
            isSpinning ? 'border-blue-400' : 
            result?.isWin ? 'border-green-400' : 
            result && !result.isWin ? 'border-red-400' : 'border-yellow-400'
          } flex flex-col items-center justify-center overflow-hidden transition-all duration-300`}>
            
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.4, type: "spring" }}
                  className="flex flex-col items-center justify-center text-center"
                >
                  {result.isWin ? (
                    <>
                      {/* Winner - show token logo and amount */}
                      <div className="w-8 h-8 mb-1">
                        {result.segment === 'AIDOGE' && (
                          <img src={aidogeLogo} alt="AIDOGE" className="w-8 h-8 rounded-full object-contain" />
                        )}
                        {result.segment === 'BOOP' && (
                          <img src={boopLogo} alt="BOOP" className="w-8 h-8 rounded-full object-contain" />
                        )}
                        {result.segment === 'ARB' && (
                          <img src={arbLogo} alt="ARB" className="w-8 h-8 object-contain" />
                        )}
                        {(result.segment === 'BONUS' || result.segment === 'JACKPOT') && (
                          <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-black">
                            {result.segment === 'BONUS' ? '2X' : '10X'}
                          </div>
                        )}
                      </div>
                      <div className="text-green-400 text-xs font-bold leading-none">
                        +{(parseFloat(result.rewardAmount || '0') / 1e18).toFixed(1)}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Bust - show skull emoji */}
                      <div className="text-xl mb-1">💀</div>
                      <div className="text-red-400 text-xs font-bold leading-none">BUST</div>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="w-12 h-12"
                >
                  <img 
                    src={arbLogo} 
                    alt="ARB" 
                    className="w-12 h-12 object-contain"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Modern Spin Controls */}
      <div className="w-full max-w-sm space-y-4">
        {/* Spin Status - Compact */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-full">
            <svg className="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 7H4L2 17H22L20 7Z" stroke="currentColor" strokeWidth="2" fill="rgba(59, 130, 246, 0.1)"/>
              <path d="M4 7L6 2H18L20 7" stroke="currentColor" strokeWidth="2" fill="none"/>
              <path d="M12 11V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-white font-medium text-sm">
              {hasSpinsRemaining ? `${3 - userSpinsUsed} Free Spins Left` : 'Daily Limit Reached'}
            </span>
          </div>
          {hasSpinsRemaining && (
            <p className="text-gray-400 text-xs mt-1">No gas fees</p>
          )}
        </div>

        {/* Main Spin Button */}
        <Button
          onClick={handleSpin}
          disabled={userSpinsUsed >= 3 || isSpinning || result !== null}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          data-testid="button-spin"
        >
          {userSpinsUsed >= 3 ? 'Come Back Tomorrow' :
           isSpinning ? (
             <span className="flex items-center gap-2">
               <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 {/* Animated spinning wheel */}
                 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="opacity-60"/>
                 <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" className="opacity-40"/>
                 <circle cx="12" cy="12" r="2" fill="currentColor"/>
                 {/* Dynamic segments that rotate */}
                 <g className="animate-pulse">
                   <path d="M12 2 L14 4 L12 6 L10 4 Z" fill="currentColor" className="opacity-90"/>
                   <path d="M22 12 L20 14 L18 12 L20 10 Z" fill="currentColor" className="opacity-70"/>
                   <path d="M12 22 L10 20 L12 18 L14 20 Z" fill="currentColor" className="opacity-90"/>
                   <path d="M2 12 L4 10 L6 12 L4 14 Z" fill="currentColor" className="opacity-70"/>
                 </g>
               </svg>
               Spinning...
             </span>
           ) : 
           result !== null ? 'Processing...' :
           hasSpinsRemaining ? (
             <span className="flex items-center gap-2">
               <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 {/* Modern casino wheel icon */}
                 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="opacity-80"/>
                 <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" className="opacity-60"/>
                 <circle cx="12" cy="12" r="2" fill="currentColor"/>
                 {/* Wheel segments */}
                 <path d="M12 2 L14 4 L12 6 L10 4 Z" fill="currentColor" className="opacity-70"/>
                 <path d="M22 12 L20 14 L18 12 L20 10 Z" fill="currentColor" className="opacity-70"/>
                 <path d="M12 22 L10 20 L12 18 L14 20 Z" fill="currentColor" className="opacity-70"/>
                 <path d="M2 12 L4 10 L6 12 L4 14 Z" fill="currentColor" className="opacity-70"/>
                 {/* Diagonal segments */}
                 <path d="M18.36 5.64 L19.77 7.05 L18.36 8.46 L16.95 7.05 Z" fill="currentColor" className="opacity-50"/>
                 <path d="M18.36 18.36 L16.95 16.95 L18.36 15.54 L19.77 16.95 Z" fill="currentColor" className="opacity-50"/>
                 <path d="M5.64 18.36 L7.05 16.95 L8.46 18.36 L7.05 19.77 Z" fill="currentColor" className="opacity-50"/>
                 <path d="M5.64 5.64 L7.05 7.05 L5.64 8.46 L4.23 7.05 Z" fill="currentColor" className="opacity-50"/>
               </svg>
               FREE SPIN!
             </span>
           ) : 'No Spins Available'}
        </Button>
      </div>

      {/* Rewards Section - Ultra Modern Design */}
      {userAccumulated && (
        (userAccumulated.AIDOGE && parseFloat(userAccumulated.AIDOGE) > 0) ||
        (userAccumulated.BOOP && parseFloat(userAccumulated.BOOP) > 0) ||
        (userAccumulated.ARB && parseFloat(userAccumulated.ARB) > 0)
      ) && (
        <div className="w-full max-w-sm mt-6">
          {/* Header - Clean & Minimal */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                <Gift className="w-3 h-3 text-white" />
              </div>
              <span className="text-white font-medium text-sm">Rewards</span>
            </div>
            <span className="text-xs text-gray-400">
              {userSpinsUsed >= 3 ? 'Ready' : `${3-userSpinsUsed} left`}
            </span>
          </div>

          {/* Token Display - Single Row Grid */}
          <div className="flex gap-2">
            {userAccumulated?.AIDOGE && parseFloat(formatUnits(userAccumulated.AIDOGE, 18)) > 0 && (
              <div className="flex-1 bg-blue-600/15 border border-blue-500/20 rounded-lg p-2 text-center">
                <div className="text-xs text-blue-400 font-medium">AIDOGE</div>
                <div className="text-white text-sm font-bold font-mono mt-1">
                  {formatTokenAmount(userAccumulated.AIDOGE)}
                </div>
              </div>
            )}

            {userAccumulated?.BOOP && parseFloat(formatUnits(userAccumulated.BOOP, 18)) > 0 && (
              <div className="flex-1 bg-green-600/15 border border-green-500/20 rounded-lg p-2 text-center">
                <div className="text-xs text-green-400 font-medium">BOOP</div>
                <div className="text-white text-sm font-bold font-mono mt-1">
                  {formatTokenAmount(userAccumulated.BOOP)}
                </div>
              </div>
            )}

            {userAccumulated?.ARB && parseFloat(formatUnits(userAccumulated.ARB, 18)) > 0 && (
              <div className="flex-1 bg-purple-600/15 border border-purple-500/20 rounded-lg p-2 text-center">
                <div className="text-xs text-purple-400 font-medium">ARB</div>
                <div className="text-white text-sm font-bold font-mono mt-1">
                  {formatTokenAmount(userAccumulated.ARB)}
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          {userSpinsUsed >= 3 ? (
            <Button 
              className="w-full h-9 text-sm font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 transition-all duration-200 mt-3"
              onClick={handleBatchClaim}
              data-testid="button-claim-all"
            >
              <Coins className="w-4 h-4 mr-2" />
              Claim All
            </Button>
          ) : (
            <div className="text-center mt-3">
              <span className="text-yellow-400 text-xs">
                Complete {3 - userSpinsUsed} more spin{3 - userSpinsUsed !== 1 ? 's' : ''} to claim
              </span>
            </div>
          )}
        </div>
      )}

      {/* Beautiful Reward Popup */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 500 }}
            className="fixed inset-x-4 bottom-24 z-50 max-w-sm mx-auto"
          >
            <div className={`relative overflow-hidden rounded-2xl border-2 backdrop-blur-xl ${
              result.isWin 
                ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-500/20 via-green-500/15 to-emerald-600/20' 
                : 'border-red-400/50 bg-gradient-to-br from-red-500/20 via-rose-500/15 to-red-600/20'
            } shadow-2xl shadow-black/40`}>
              
              {/* Animated Background Glow */}
              <div className={`absolute inset-0 opacity-30 ${
                result.isWin ? 'bg-emerald-400/10' : 'bg-red-400/10'
              }`}>
                <div className={`absolute inset-0 animate-pulse ${
                  result.isWin ? 'bg-emerald-300/20' : 'bg-red-300/20'
                }`} />
              </div>
              
              {/* Content */}
              <div className="relative p-6 text-center">
                {/* Icon and Title */}
                <div className="mb-4">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
                    result.isWin 
                      ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400/30' 
                      : 'bg-red-500/20 text-red-400 border-2 border-red-400/30'
                  } shadow-lg`}>
                    <span className="text-3xl">
                      {result.isWin ? '🎉' : '💀'}
                    </span>
                  </div>
                  
                  <h3 className={`text-2xl font-bold font-pixel ${
                    result.isWin ? 'text-emerald-400 neon-green-text' : 'text-red-400'
                  }`}>
                    {result.isWin ? 'EPIC WIN!' : 'BUST!'}
                  </h3>
                </div>

                {/* Segment Result */}
                <div className="mb-4 p-3 rounded-xl bg-black/30 border border-white/10">
                  <p className="text-white/80 text-sm mb-1">You landed on</p>
                  <p className="text-white font-bold text-xl font-pixel">
                    {result.segment}
                  </p>
                </div>

                {/* Reward Display */}
                {result.isWin && (
                  <div className="mb-4">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/30">
                      <p className="text-emerald-300 text-sm mb-1">Reward Amount</p>
                      <p className="text-white font-bold text-2xl font-mono">
                        {formatTokenAmount(result.reward || result.rewardAmount || "0")} 
                        <span className="text-emerald-400 text-lg ml-1">tokens</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Transaction Hash */}
                {result.isWin && result.txHash && (
                  <div className="mb-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-400/30">
                      <p className="text-blue-300 text-xs mb-2">Transaction Hash</p>
                      <div className="flex items-center justify-between">
                        <code className="text-white/70 text-xs font-mono bg-black/30 px-2 py-1 rounded">
                          {result.txHash.slice(0, 8)}...{result.txHash.slice(-6)}
                        </code>
                        <a
                          href={`https://sepolia.arbiscan.io/tx/${result.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 hover:text-blue-200 transition-all duration-200"
                          data-testid="link-explorer"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Message */}
                <div className="text-center">
                  <p className="text-white/60 text-sm">
                    {result.isWin 
                      ? "Tokens transferred to your wallet!" 
                      : "Spin again for another chance!"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎰 EPIC JACKPOT CELEBRATION 🎰 */}
      <JackpotCelebration
        isVisible={showJackpotCelebration}
        rewardAmount={result?.reward || result?.rewardAmount || '0'}
        onClose={() => setShowJackpotCelebration(false)}
        onShare={() => {
          toast({
            title: "🎉 Epic Win Shared!",
            description: "Your jackpot victory is ready to flex on Farcaster!",
          });
        }}
      />
    </div>
  );
}