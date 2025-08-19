import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useToast } from '@/hooks/use-toast'

export function useSimpleSpin() {
  const [isSpinning, setIsSpinning] = useState(false)
  const [lastSpinResult, setLastSpinResult] = useState<any>(null)
  
  // Function to reset spin result
  const resetSpinResult = useCallback(() => {
    setLastSpinResult(null);
  }, []);
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const triggerSpin = async (userId: string) => {
    if (isSpinning) return false; // Prevent double-spinning
    setIsSpinning(true)

    try {
      // Call server API for free spinning
      const response = await fetch('/api/spin-free', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          userAddress: address
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Spin failed');
      }


      
      setLastSpinResult({
        segment: data.segment,
        isWin: data.isWin,
        tokenType: data.tokenType,
        rewardAmount: data.rewardAmount,
        spinsRemaining: data.spinsRemaining
      })

      // Don't show toast - will show after wheel animation completes

      return true
    } catch (error: any) {
      
      let errorMessage = "Failed to execute spin"
      let errorTitle = "Spin Failed"
      
      if (error.message.includes('Daily spin limit')) {
        errorMessage = "Daily spin limit reached. Come back tomorrow!"
        errorTitle = "Daily Limit Reached"
      } else if (error.message.includes('User not found')) {
        errorMessage = "Please connect your wallet and try again"
        errorTitle = "User Not Found"
      } else {
        errorMessage = error.message || "An unexpected error occurred"
      }

      // Only show error toast for actual failures (not animation results)
      if (!error.message.includes('Daily spin limit')) {
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      return false
    } finally {
      // Don't set spinning false immediately - let animation complete (increased time for safety)
      setTimeout(() => setIsSpinning(false), 5000);
    }
  }


  return {
    isSpinning,
    triggerSpin,
    lastSpinResult,
    resetSpinResult,
    isConnected,
    userAddress: address
  }
}