import { createRoot } from "react-dom/client";
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from "./lib/queryClient";
import { config } from './lib/wagmi';
import { sdk } from '@farcaster/miniapp-sdk';
import App from "./App";
import "./index.css";

// Polyfill buffer for browser compatibility with ethers/wagmi
if (typeof global === 'undefined') {
  (window as any).global = globalThis;
}

// Initialize Farcaster SDK immediately to dismiss splash screen
try {
  const isInFarcaster = window.parent !== window;
  
  if (isInFarcaster && sdk?.actions?.ready) {
    // Use fire-and-forget approach that works reliably
    sdk.actions.ready().catch(() => {
      // Silent handling - splash screen will be dismissed regardless
    });
    console.log('✅ Farcaster splash screen dismissed');
  }
} catch (error) {
  // Silent fail for non-Farcaster environments
}

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
