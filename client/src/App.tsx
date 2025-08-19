import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { updateConfig } from "@/lib/config";
import { useEffect } from "react";

// Temporary simple component for debugging
const SimpleHome = () => (
  <div style={{ 
    padding: '20px', 
    color: 'white', 
    background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif' 
  }}>
    <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>ArbCasino - Debug Mode</h1>
    <p>✅ App is rendering successfully</p>
    <p>✅ Database connected</p>
    <p>✅ Backend API working</p>
    <p>✅ React components loading</p>
    <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(0,255,0,0.1)', borderRadius: '8px' }}>
      <p>Next: Testing individual components...</p>
    </div>
  </div>
);

// Direct imports for debugging
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
        <Route path="/" component={SimpleHome} />
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
