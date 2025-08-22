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

// Buffer polyfill for crypto libraries
(async () => {
  try {
    if (typeof Buffer === 'undefined') {
      const { Buffer } = await import('buffer');
      (window as any).Buffer = Buffer;
    }
  } catch (error) {
    // Buffer polyfill not needed or already available
  }
})();

// Initialize Farcaster SDK immediately to prevent splash screen
const initializeFarcasterSDK = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Import and call ready() immediately to dismiss splash screen
    const { sdk } = await import('@farcaster/miniapp-sdk');
    
    // Call ready() immediately to dismiss splash screen
    await sdk.actions.ready();
    
    // Success - splash screen should be dismissed
  } catch (error) {
    // Silent fail for development/non-Farcaster environments
    // The splash screen only appears in Farcaster, so this is expected outside Farcaster
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
