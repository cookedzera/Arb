import { motion } from "framer-motion";
import { Coins, Zap, Award, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function TokenCollection() {
  // This page now shows auto-transfer status instead of claimable balances
  
  const tokenData = [
    {
      symbol: "AIDOGE",
      name: "AiDoge",
      icon: Coins,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
    {
      symbol: "BOOP", 
      name: "Boop",
      icon: Zap,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      symbol: "ARB",
      name: "Arbitrum",
      icon: Award,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-8 pb-4"
        >
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              <Coins className="inline-block w-6 h-6 mr-2 text-green-400" />
              Auto Transfer Status
            </h1>
            <p className="text-gray-400 text-sm">Your winnings are automatically transferred</p>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
            <Coins className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-green-400 mb-2">
            🎉 Automatic Transfers Active!
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            When you win tokens by spinning the wheel, they're automatically sent to your connected Farcaster wallet. 
            No claiming required - instant rewards!
          </p>
        </motion.div>

        {/* Token List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Available Reward Tokens</h3>
          {tokenData.map((token, index) => {
            const Icon = token.icon;
            
            return (
              <motion.div
                key={token.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${token.bgColor}`}>
                      <Icon className={`h-5 w-5 ${token.color}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-base">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        {token.name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-400 flex items-center gap-1">
                      ⚡ Auto-transfer
                    </div>
                    <div className="text-xs text-gray-500">
                      Direct to wallet
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gray-800/50 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">How Auto-Transfer Works</h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-xs font-bold">1</span>
              </div>
              <p>Spin the wheel and win tokens</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-xs font-bold">2</span>
              </div>
              <p>Tokens are automatically sent to your Farcaster wallet</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-xs font-bold">3</span>
              </div>
              <p>Use your tokens immediately - no claiming needed!</p>
            </div>
          </div>
        </motion.div>

        {/* Back to spinning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="pt-4"
        >
          <Link href="/">
            <Button 
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all duration-200"
            >
              Start Spinning & Earning
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}