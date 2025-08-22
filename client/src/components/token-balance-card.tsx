import { motion } from "framer-motion";
import { Coins, Zap, Award } from "lucide-react";

interface TokenBalanceCardProps {
  userId: string;
}

export function TokenBalanceCard({ userId }: TokenBalanceCardProps) {
  // Since we have automatic transfers now, we don't need to show claimable balances
  // This component now just shows that auto-transfers are enabled
  
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Auto Transfer Status */}
      <div className="flex items-center gap-2 mb-4">
        <Coins className="h-5 w-5 text-green-400" />
        <h3 className="text-lg font-bold text-white">Auto Transfer Active</h3>
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {tokenData.map((token) => {
          const Icon = token.icon;
          
          return (
            <motion.div
              key={token.symbol}
              className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
              whileHover={{ scale: 1.01 }}
              data-testid={`token-${token.symbol.toLowerCase()}`}
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
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      ⚡ Auto-transfer enabled
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium text-green-400">
                    ✅ Direct to wallet
                  </div>
                </div>
              </div>

              {/* Auto transfer status */}
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="text-center text-xs text-green-400">
                  Winnings automatically transferred to your wallet
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Info message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center py-6 bg-gray-800/40 rounded-xl border border-gray-700/50"
      >
        <Coins className="w-12 h-12 mx-auto mb-3 text-green-400" />
        <h3 className="text-lg font-semibold text-green-400 mb-2">Automatic Transfers</h3>
        <p className="text-gray-400 text-sm px-4">
          When you win tokens by spinning, they're automatically sent to your connected wallet. No claiming needed!
        </p>
      </motion.div>
    </motion.div>
  );
}