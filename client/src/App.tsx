import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { updateConfig } from "@/lib/config";
import { useEffect } from "react";

// Direct imports - using simple home for testing
import HomeSimple from "@/pages/home-simple";
import Profile from "@/pages/profile";
import TokenCollection from "@/pages/token-collection";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import Leaderboard from "@/pages/leaderboard";


// No longer needed since we're not using lazy loading

function Router() {
  return (
    <div className="page-transition gpu-accelerated">
      <Switch>
        <Route path="/" component={HomeSimple} />
        <Route path="/tokens" component={TokenCollection} />
        <Route path="/profile" component={Profile} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Load contract configuration from API on app start
    updateConfig();
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
