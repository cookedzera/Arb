import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift } from "lucide-react";
import { useSimpleSpin } from "@/hooks/use-simple-spin";
import aidogeLogo from "@assets/aidoge_1755435810322.png";
import boopLogo from "@assets/boop_1755435810327.png";
import arbLogo from "@assets/arb-logo.png";

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
  'IARB': 'AIDOGE',
  'ABET': 'ARB', 
  'JUICE': 'BOOP',
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

export default function SpinWheelSimple({ onSpinComplete, userSpinsUsed, userId, userAccumulated }: SpinWheelSimpleProps) {
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [sessionSpinsUsed, setSessionSpinsUsed] = useState(userSpinsUsed);
  
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { isSpinning, triggerSpin, lastSpinResult, resetSpinResult } = useSimpleSpin();
  
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
      
      // To align the segment center with the top arrow (0°), we need to rotate the wheel
      // so that the segment center ends up at 0° (top position)
      // Since we want the segment center to be at top (0°), we rotate by negative of its angle
      const targetRotation = -segmentCenterAngle;
      
      const spins = 4; // 4 full rotations for dramatic effect
      const finalRotation = rotation + (spins * 360) + targetRotation;
      
      console.log(`🔄 Current rotation: ${rotation}°, Target: ${targetRotation}°, Final: ${finalRotation}°`);
      
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
          tokenType: lastSpinResult.tokenType
        };
        
        setResult(finalResult);
        
        // Center display shows winning result for 3-4 seconds
        
        // Update session spin count for server spins
        setSessionSpinsUsed(prev => prev + 1);
        
        if (onSpinComplete) {
          onSpinComplete(finalResult);
        }
        
        // Reset center display after 3.5 seconds
        const clearResultTimeout = setTimeout(() => {
          setResult(null);
          resetSpinResult(); // Clear the spin result from the hook
        }, 3500);
        
        return () => clearTimeout(clearResultTimeout);
      }, 4500); // Wait for wheel animation (4s) + small delay (0.5s)
      
      return () => clearTimeout(resultTimeout);
    }
  }, [lastSpinResult]); // Only depend on lastSpinResult



  const handleSpin = async () => {
    // Prevent multiple spins - check all blocking conditions
    if (userSpinsUsed >= 3 || isSpinning || result !== null) {
      return; // Don't allow spin if: daily limit reached, currently spinning, or result showing
    }

    // Check if user ID is available
    if (!userId) {
      return; // Don't show toast - user will see the wheel doesn't spin
    }

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
    <div className="flex flex-col items-center space-y-6">


      {/* Wheel Container */}
      <div className="relative">
        {/* Arrow Pointer - Points from outside TO the center circle border */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[50px] z-30">
          <div className="relative">
            {/* Main arrow body */}
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-yellow-400 drop-shadow-lg"></div>
            {/* Arrow tip highlight */}
            <div className="absolute top-[18px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[4px] border-l-transparent border-r-transparent border-b-yellow-300"></div>
            {/* Arrow shadow for depth */}
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-yellow-600/50 -z-10"></div>
          </div>
        </div>
        

        
        {/* Spinning Wheel */}
        <motion.div
          className="w-64 h-64 rounded-full relative overflow-hidden shadow-2xl border-4 border-yellow-400 wheel-container"
          animate={{ 
            rotate: rotation,
            scale: isSpinning ? 1.02 : 1
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

      {/* Spin Status */}
      <div className="text-center space-y-2">
        <div className="text-lg font-bold text-white">
          {hasSpinsRemaining 
            ? `🆓 Free Spins: ${3 - userSpinsUsed} remaining`
            : `⛽ Daily Limit Reached`
          }
        </div>
        <p className="text-sm text-gray-300">
          {hasSpinsRemaining 
            ? "No gas fees - rewards accumulate until claimed"
            : "Come back tomorrow for more spins!"
          }
        </p>
      </div>

      <Button
        onClick={handleSpin}
        disabled={userSpinsUsed >= 3 || isSpinning || result !== null}
        className="w-48 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-spin"
      >
        {userSpinsUsed >= 3 ? 'Daily Limit Reached' :
         isSpinning ? 'Spinning...' : 
         result !== null ? 'Processing...' :
         hasSpinsRemaining ? '🎰 FREE SPIN!' : 'No spins available'}
      </Button>
      

      
      {/* Spins Counter */}
      <div className="text-center">
        <p className="text-white/80 text-sm">
          Total daily spins: {userSpinsUsed}/3 used
        </p>
        <p className="text-white/60 text-xs">
          Server-side spins (no gas fees)
        </p>
      </div>

      {/* Accumulated Rewards Display - Modern Casino UI */}
      {userAccumulated && (
        (userAccumulated.AIDOGE && parseFloat(userAccumulated.AIDOGE) > 0) ||
        (userAccumulated.BOOP && parseFloat(userAccumulated.BOOP) > 0) ||
        (userAccumulated.ARB && parseFloat(userAccumulated.ARB) > 0)
      ) && (
        <div className="w-full max-w-md space-y-4">
          {/* Modern header with gradient background */}
          <div className="text-center p-4 rounded-2xl relative overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, rgba(139, 69, 19, 0.3) 100%)',
                 border: '1px solid rgba(255, 215, 0, 0.3)',
                 boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 215, 0, 0.2)'
               }}>
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent" />
            <div className="relative">
              <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2 mb-2">
                <Gift className="w-6 h-6 text-yellow-400" />
                <span className="bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                  Accumulated Rewards
                </span>
              </h3>
              <p className="text-sm text-yellow-200/80">
                {userSpinsUsed >= 3 ? "Your winnings are ready to claim!" : "Complete all spins to claim rewards!"}
              </p>
            </div>
          </div>

          {/* Modern token cards with gradients */}
          <div className="space-y-3">
            {userAccumulated?.AIDOGE && parseFloat(userAccumulated.AIDOGE) > 0 && (
              <div 
                className="relative p-4 rounded-xl overflow-hidden will-change-transform"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.1)',
                  transform: 'translateZ(0)' // Hardware acceleration
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-transparent" />
                <div className="relative flex items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-blue-600/80 backdrop-blur-sm rounded-full border border-blue-400/50">
                      <span className="text-white font-bold text-sm">AIDOGE</span>
                    </div>
                    <span className="font-mono text-white text-lg font-bold">
                      {parseFloat(userAccumulated.AIDOGE || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {userAccumulated?.BOOP && parseFloat(userAccumulated.BOOP) > 0 && (
              <div 
                className="relative p-4 rounded-xl overflow-hidden will-change-transform"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.1) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  boxShadow: '0 4px 16px rgba(34, 197, 94, 0.1)',
                  transform: 'translateZ(0)' // Hardware acceleration
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-transparent" />
                <div className="relative flex items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-green-600/80 backdrop-blur-sm rounded-full border border-green-400/50">
                      <span className="text-white font-bold text-sm">BOOP</span>
                    </div>
                    <span className="font-mono text-white text-lg font-bold">
                      {parseFloat(userAccumulated.BOOP || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {userAccumulated?.ARB && parseFloat(userAccumulated.ARB) > 0 && (
              <div 
                className="relative p-4 rounded-xl overflow-hidden will-change-transform"
                style={{
                  background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2) 0%, rgba(126, 34, 206, 0.1) 100%)',
                  border: '1px solid rgba(147, 51, 234, 0.3)',
                  boxShadow: '0 4px 16px rgba(147, 51, 234, 0.1)',
                  transform: 'translateZ(0)' // Hardware acceleration
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-transparent" />
                <div className="relative flex items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-purple-600/80 backdrop-blur-sm rounded-full border border-purple-400/50">
                      <span className="text-white font-bold text-sm">ARB</span>
                    </div>
                    <span className="font-mono text-white text-lg font-bold">
                      {parseFloat(userAccumulated.ARB || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Claim All Button - Only show when all spins are used */}
          {userSpinsUsed >= 3 && (
            <div className="pt-2">
              <Button 
                className="w-full h-14 text-lg font-bold relative overflow-hidden group will-change-transform hover:scale-105 transition-transform duration-200" 
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transform: 'translateZ(0)' // Hardware acceleration
                }}
                onClick={handleBatchClaim}
                data-testid="button-claim-all"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Coins className="w-6 h-6 mr-3" />
                <span>Claim All Rewards</span>
              </Button>
              <p className="text-xs text-gray-400 text-center mt-2">
                One transaction to claim all your winnings
              </p>
            </div>
          )}
          
          {/* Pending spins message - Modern design */}
          {userSpinsUsed < 3 && (
            <div 
              className="text-center p-4 rounded-xl relative overflow-hidden will-change-transform"
              style={{
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                boxShadow: '0 4px 16px rgba(251, 191, 36, 0.1)',
                transform: 'translateZ(0)' // Hardware acceleration
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent" />
              <div className="relative">
                <p className="text-yellow-200 text-sm font-bold mb-1">
                  🎰 Complete {3 - userSpinsUsed} more spin{3 - userSpinsUsed !== 1 ? 's' : ''} to unlock claiming
                </p>
                <p className="text-yellow-300/80 text-xs">
                  Save gas fees by claiming all rewards together
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Display */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`p-4 rounded-xl border-2 ${result.isWin ? 'border-green-400 bg-green-400/20' : 'border-red-400 bg-red-400/20'} text-center`}
          >
            <h3 className={`text-xl font-bold ${result.isWin ? 'text-green-400' : 'text-red-400'}`}>
              {result.isWin ? '🎉 Winner!' : '💀 Better Luck Next Time!'}
            </h3>
            <p className="text-white mt-2">
              You landed on <span className="font-bold">{result.segment}</span>
              {result.isWin && (
                <span className="block text-sm text-white/80 mt-1">
                  Reward: {result.reward || result.rewardAmount} tokens
                </span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}