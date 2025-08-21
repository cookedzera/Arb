import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Check if we're at the reset point (midnight UTC)
      if (hours === 23 && minutes === 59 && seconds >= 58) {
        setIsResetting(true);
      } else if (isResetting && hours < 23) {
        setIsResetting(false);
      }

      setTimeLeft({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000); // Update every second for smoother animation

    return () => clearInterval(interval);
  }, [isResetting]);

  return (
    <div className="inline-flex items-center gap-2">
      {/* Clock icon */}
      <svg className="w-3 h-3 text-teal-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
        <path d="M12 6 L12 12 L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      
      {/* Modern timer display */}
      <div className="inline-flex items-center gap-1">
        <motion.span 
          className="text-xs text-teal-300 font-medium"
          animate={isResetting ? { scale: [1, 1.1, 1], opacity: [1, 0.7, 1] } : {}}
          transition={{ duration: 1, repeat: isResetting ? Infinity : 0 }}
        >
          Reset in:
        </motion.span>
        
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-md backdrop-blur-sm border border-white/20">
          <AnimatePresence mode="wait">
            <motion.span
              key={`${timeLeft.hours}-${timeLeft.minutes}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs font-bold text-white"
            >
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}
            </motion.span>
          </AnimatePresence>
          
          {/* Blinking seconds indicator */}
          <motion.div
            className="w-1 h-1 bg-teal-300 rounded-full"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          />
        </div>
      </div>
      
      {/* Reset notification */}
      <AnimatePresence>
        {isResetting && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-400/20 border border-yellow-400/30 rounded-full"
          >
            <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 4 L11 14 L21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-xs text-yellow-400 font-medium">Resetting soon!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
