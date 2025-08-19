import { useQuery } from "@tanstack/react-query";
import { useGameState } from "@/hooks/use-game-state";
import { type User } from "@shared/schema";

export default function Leaderboard() {
  const { user } = useGameState();
  
  const { data: leaderboard } = useQuery<User[]>({
    queryKey: ["/api/leaderboard"],
  });

  const getUserRank = () => {
    if (!user || !leaderboard) return null;
    const rank = leaderboard.findIndex(u => u.id === user.id);
    return rank !== -1 ? rank + 1 : null;
  };

  return (
    <div className="bg-card rounded-xl border border-border neon-border p-4">
      <h3 className="font-pixel text-yellow-400 text-sm mb-3 neon-yellow-text">
        🏆 LEADERBOARD
      </h3>
      <div className="space-y-2">
        {leaderboard?.slice(0, 5).map((player, index) => {
          const isCurrentUser = user?.id === player.id;
          return (
            <div
              key={player.id}
              className={`flex justify-between items-center py-2 border-b border-border last:border-b-0 ${
                isCurrentUser ? "bg-primary bg-opacity-20 rounded px-2 -mx-2" : ""
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className={`font-bold ${
                  index === 0 ? "text-yellow-400" : 
                  isCurrentUser ? "text-primary" : "text-muted-foreground"
                }`}>
                  {index + 1}.
                </span>
                <span className={`text-sm font-mono ${
                  isCurrentUser ? "text-primary font-medium" : ""
                }`}>
                  {isCurrentUser ? "You" : player.username}
                </span>
              </div>
              <span className="text-green-400 font-medium">
                {player.totalWins} wins
              </span>
            </div>
          );
        })}
        
        {/* Show current user if not in top 5 */}
        {user && getUserRank() && getUserRank()! > 5 && (
          <>
            <div className="text-center text-muted-foreground text-xs py-1">...</div>
            <div className="flex justify-between items-center py-2 bg-primary bg-opacity-20 rounded px-2 -mx-2">
              <div className="flex items-center space-x-2">
                <span className="text-primary font-bold">{getUserRank()}.</span>
                <span className="text-sm font-mono text-primary font-medium">You</span>
              </div>
              <span className="text-green-400 font-medium">{user.totalWins} wins</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
