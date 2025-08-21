import { createRoot } from "react-dom/client";
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from "./lib/queryClient";
import { config } from './lib/wagmi';
import App from "./App";
import "./index.css";

// Polyfill buffer for browser compatibility with ethers/wagmi
if (typeof global === 'undefined') {
  (window as any).global = globalThis;
}

// Initialize Farcaster SDK immediately to prevent splash screen
const initializeFarcasterSDK = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    console.log('🔄 Initializing Farcaster SDK...');
    
    // Import Farcaster SDK
    const { sdk } = await import('@farcaster/miniapp-sdk');
    console.log('📱 SDK imported successfully');
    
    // Call ready() with timeout to prevent hanging
    const readyPromise = sdk.actions.ready();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('ready() timeout')), 3000)
    );
    
    console.log('📱 Calling sdk.actions.ready()...');
    await Promise.race([readyPromise, timeoutPromise]);
    
    console.log('✅ Farcaster SDK ready() completed - splash screen should be hidden');
    
    // Log additional context if available
    if (sdk.context) {
      console.log('📱 Farcaster context:', {
        hasContext: true,
        location: sdk.context.location || 'unknown'
      });
    }
    
  } catch (error) {
    console.log('⚠️ Farcaster SDK error:', error.message);
    
    // Try multiple fallback approaches
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      
      // Try immediate ready() call
      sdk.actions.ready();
      console.log('🔄 Attempted immediate ready() call as fallback');
      
      // Also try after a brief delay
      setTimeout(() => {
        try {
          sdk.actions.ready();
          console.log('🔄 Attempted delayed ready() call');
        } catch (e) {
          console.log('⚠️ Delayed ready() failed:', e.message);
        }
      }, 100);
      
    } catch (fallbackError) {
      console.log('ℹ️ Not running in Farcaster environment (expected)');
    }
  }
};

// Call immediately - don't wait for DOM ready to prevent splash screen delay
initializeFarcasterSDK();

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
