import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { type Token } from "@shared/schema";

export default function Admin() {
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [newRewardAmount, setNewRewardAmount] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tokens } = useQuery<Token[]>({
    queryKey: ["/api/tokens"],
  });

  const updateTokenMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Token> }) => {
      const response = await apiRequest("PUT", `/api/tokens/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setEditingToken(null);
      setNewRewardAmount("");
      toast({
        title: "Token Updated",
        description: "Token settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update token settings.",
        variant: "destructive",
      });
    }
  });

  const handleRewardAmountUpdate = (tokenId: string) => {
    const amount = parseFloat(newRewardAmount);
    if (isNaN(amount)) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid number.",
        variant: "destructive",
      });
      return;
    }

    // Convert to wei (multiply by 10^18)
    const amountInWei = Math.floor(amount * Math.pow(10, 18));
    
    updateTokenMutation.mutate({
      id: tokenId,
      updates: { rewardAmount: amountInWei }
    });
  };

  const toggleTokenActive = (tokenId: string, isActive: boolean) => {
    updateTokenMutation.mutate({
      id: tokenId,
      updates: { isActive }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 space-y-6">
      <header className="text-center py-4 border-b border-border">
        <h1 className="font-pixel text-primary text-xl neon-text mb-2">🔧 Token Admin</h1>
        <p className="text-muted-foreground">Manage token rewards and settings</p>
      </header>

      <div className="max-w-4xl mx-auto space-y-4">
        {tokens?.map((token) => (
          <Card key={token.id} className="bg-card border border-border neon-border">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-primary neon-text">{token.symbol}</CardTitle>
                  <CardDescription>{token.name}</CardDescription>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {token.address}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`active-${token.id}`} className="text-sm">Active</Label>
                  <Switch
                    id={`active-${token.id}`}
                    checked={token.isActive}
                    onCheckedChange={(checked) => toggleTokenActive(token.id, checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Current Reward</Label>
                  <div className="text-lg font-bold text-green-400">
                    {(Number(token.rewardAmount) / Math.pow(10, 18)).toFixed(6)} tokens
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ({token.rewardAmount.toLocaleString()} wei)
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Decimals</Label>
                  <div className="text-lg font-bold">{token.decimals}</div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                {editingToken === token.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`reward-${token.id}`}>New Reward Amount (in tokens)</Label>
                      <Input
                        id={`reward-${token.id}`}
                        type="number"
                        step="0.000001"
                        placeholder="0.000050"
                        value={newRewardAmount}
                        onChange={(e) => setNewRewardAmount(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter amount in readable format (e.g., 0.000050 for very small rewards)
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleRewardAmountUpdate(token.id)}
                        disabled={updateTokenMutation.isPending}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingToken(null);
                          setNewRewardAmount("");
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setEditingToken(token.id);
                      setNewRewardAmount((Number(token.rewardAmount) / Math.pow(10, 18)).toString());
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Edit Reward Amount
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-8">
        <Button
          onClick={() => window.history.back()}
          variant="outline"
          className="neon-border"
        >
          ← Back to Casino
        </Button>
      </div>
    </div>
  );
}