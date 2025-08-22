import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Vote, Plus, TrendingUp, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TokenVote {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress?: string;
  description?: string;
  votes: number;
  createdAt: string;
  lastVotedAt: string;
}

interface TokenVotingProps {
  userId?: string;
  isAuthenticated?: boolean;
}

export default function TokenVoting({ userId, isAuthenticated }: TokenVotingProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get popular token votes
  const { data: popularTokens, isLoading } = useQuery<{ tokens: TokenVote[], count: number }>({
    queryKey: ['/api/voting/popular'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (voteData: any) => {
      const response = await fetch('/api/voting/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...voteData })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Vote Recorded!",
        description: data.message || "Your vote has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/voting/popular'] });
      
      // Reset form if it was a new suggestion
      if (showAddForm) {
        setTokenName("");
        setTokenSymbol("");
        setTokenAddress("");
        setDescription("");
        setShowAddForm(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Vote Failed",
        description: error.message || "Failed to record vote",
        variant: "destructive",
      });
    },
  });

  const handleVoteForExisting = (tokenName: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Connect Required",
        description: "Please connect with Farcaster to vote for tokens",
        variant: "destructive",
      });
      return;
    }
    
    voteMutation.mutate({ tokenName });
  };

  const handleSubmitNewToken = () => {
    if (!isAuthenticated) {
      toast({
        title: "Connect Required", 
        description: "Please connect with Farcaster to suggest new tokens",
        variant: "destructive",
      });
      return;
    }

    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast({
        title: "Required Fields",
        description: "Please enter both token name and symbol",
        variant: "destructive",
      });
      return;
    }

    voteMutation.mutate({
      tokenName: tokenName.trim(),
      tokenSymbol: tokenSymbol.trim().toUpperCase(),
      tokenAddress: tokenAddress.trim() || undefined,
      description: description.trim() || undefined
    });
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Vote className="h-5 w-5 text-blue-400" />
            Vote for Next Token
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Help choose which tokens get added to the spin wheel next!
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Popular Tokens */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-700/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : popularTokens && popularTokens.tokens.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Popular Suggestions
              </h4>
              <AnimatePresence>
                {popularTokens.tokens.slice(0, 5).map((token, index) => (
                  <motion.div
                    key={token.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{token.tokenName}</span>
                        <Badge variant="outline" className="text-xs">
                          {token.tokenSymbol}
                        </Badge>
                      </div>
                      {token.description && (
                        <p className="text-xs text-gray-400 mt-1">{token.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-sm font-medium text-blue-400">{token.votes}</div>
                        <div className="text-xs text-gray-500">votes</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVoteForExisting(token.tokenName)}
                        disabled={voteMutation.isPending}
                        className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                        data-testid={`button-vote-${token.tokenSymbol.toLowerCase()}`}
                      >
                        {voteMutation.isPending ? "..." : "+1"}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">
              No token suggestions yet. Be the first to suggest one!
            </div>
          )}

          {/* Add New Token Button */}
          <div className="pt-2 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700/50"
              data-testid="button-suggest-token"
            >
              <Plus className="h-4 w-4 mr-2" />
              Suggest New Token
            </Button>
          </div>

          {/* Add New Token Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Token Name *
                    </label>
                    <Input
                      placeholder="e.g., Arbitrum"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      className="bg-gray-800 border-gray-600"
                      data-testid="input-token-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Symbol *
                    </label>
                    <Input
                      placeholder="e.g., ARB"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      className="bg-gray-800 border-gray-600"
                      maxLength={10}
                      data-testid="input-token-symbol"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Contract Address (optional)
                  </label>
                  <Input
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    className="bg-gray-800 border-gray-600"
                    data-testid="input-token-address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <Textarea
                    placeholder="Why should this token be added?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-gray-800 border-gray-600 resize-none"
                    rows={2}
                    maxLength={200}
                    data-testid="input-token-description"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSubmitNewToken}
                    disabled={voteMutation.isPending || !tokenName.trim() || !tokenSymbol.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    data-testid="button-submit-token"
                  >
                    {voteMutation.isPending ? (
                      <>
                        <Coins className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Coins className="h-4 w-4 mr-2" />
                        Submit Suggestion
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    className="border-gray-600"
                    data-testid="button-cancel-token"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}