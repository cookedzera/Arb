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

// Optimize Farcaster SDK loading - lazy load and error boundary
const initializeFarcasterSDK = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Use dynamic import for better code splitting
    const { sdk } = await import('@farcaster/miniapp-sdk');
    await sdk.actions.ready();
    console.log('Farcaster SDK initialized successfully');
  } catch (error) {
    // Silent fail for development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Farcaster SDK initialization failed - running in dev mode');
    }
  }
};

// Initialize after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFarcasterSDK);
} else {
  // DOM already loaded
  initializeFarcasterSDK();
}

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
