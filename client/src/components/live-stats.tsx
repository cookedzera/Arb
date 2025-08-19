import { type GameStats } from "@shared/schema";

interface LiveStatsProps {
  stats?: GameStats;
}

export default function LiveStats({ stats }: LiveStatsProps) {
  return (
    <div className="bg-card rounded-xl border border-border neon-border p-4">
      <h3 className="font-pixel text-primary text-sm mb-3 neon-text">📊 LIVE STATS</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">🔥 Total Claims Today:</span>
          <span className="font-bold text-green-400 neon-green-text">
            {stats?.totalClaims?.toLocaleString() || "0"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">⚡ Contract TXs Today:</span>
          <span className="font-bold text-primary neon-text">
            {stats?.contractTxs?.toLocaleString() || "0"}
          </span>
        </div>
      </div>
    </div>
  );
}
