import { useState } from "react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";

// Simple test version of home page
export default function HomeSimple() {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 50%, #2c2c2e 100%)'
    }}>
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            ARB<span className="text-blue-400">CASINO</span>
          </h1>
          
          <p className="text-white mb-8">
            Welcome to the Arbitrum Wheel of Fortune
          </p>
          
          <Button 
            onClick={() => setClickCount(c => c + 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
          >
            Test Button (Clicked: {clickCount})
          </Button>
          
          <div className="mt-8 text-white">
            <p>✅ Navigation loaded</p>
            <p>✅ Buttons working</p>
            <p>✅ State management active</p>
            <p>🎰 Ready for full casino features</p>
          </div>
        </div>
      </div>
    </div>
  );
}