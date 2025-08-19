import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { updateConfig } from "@/lib/config";
import { useEffect, lazy, Suspense } from "react";

// Code splitting - lazy load pages for better performance
const Home = lazy(() => import("@/pages/home"));
const Profile = lazy(() => import("@/pages/profile"));
const TokenCollection = lazy(() => import("@/pages/token-collection"));
const Admin = lazy(() => import("@/pages/admin"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Leaderboard = lazy(() => import("@/pages/leaderboard"));


// Preload commonly accessed pages after initial load
const preloadComponents = () => {
  // Preload most commonly used pages in background
  import("@/pages/profile");
  import("@/pages/leaderboard");
};

// Minimal loading component for instant navigation feel
const PageLoader = () => (
  <div className="min-h-screen page-transition gpu-accelerated" style={{
    background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
  }}>
    {/* No loading spinner for instant feel */}
  </div>
);

function Router() {
  return (
    <div className="page-transition gpu-accelerated">
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/tokens" component={TokenCollection} />
          <Route path="/profile" component={Profile} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/admin" component={Admin} />

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Load contract configuration from API on app start
    updateConfig();
    
    // Preload commonly used components after a short delay for instant navigation
    const timer = setTimeout(preloadComponents, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <TooltipProvider>
      <div className="app-container gpu-accelerated will-change-transform">
        <Router />
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
