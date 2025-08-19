import { useState } from "react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { motion } from "framer-motion";

// Working version of home page with core casino features
export default function HomeWorking() {
  const [showSpinWheel, setShowSpinWheel] = useState(false);

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
    }}>
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-6xl font-bold text-white mb-6"
          >
            ARB<span className="text-blue-400">CASINO</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-gray-300 text-lg mb-8"
          >
            Spin the Wheel of Fortune on Arbitrum
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <Button 
              onClick={() => setShowSpinWheel(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 text-xl font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              🎰 SPIN TO WIN
            </Button>
          </motion.div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20"
            >
              <h3 className="text-white font-bold text-lg mb-2">Daily Spins</h3>
              <p className="text-gray-400">Get 5 free spins every 24 hours</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.8 }}
              className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20"
            >
              <h3 className="text-white font-bold text-lg mb-2">Real Tokens</h3>
              <p className="text-gray-400">Win AIDOGE, BOOP, and ARB tokens</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.9, duration: 0.8 }}
              className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20"
            >
              <h3 className="text-white font-bold text-lg mb-2">Blockchain Powered</h3>
              <p className="text-gray-400">Smart contracts on Arbitrum</p>
            </motion.div>
          </div>
        </div>
      </div>
      
      {showSpinWheel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4"
          >
            <h2 className="text-2xl font-bold text-white text-center mb-6">Spin Wheel</h2>
            <p className="text-gray-400 text-center mb-6">
              Connect your wallet to start spinning!
            </p>
            <div className="flex gap-4">
              <Button 
                onClick={() => setShowSpinWheel(false)}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Connect Wallet
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}