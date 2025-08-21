import type { Express } from "express";

export function registerShareRoutes(app: Express) {
  
  // Generate dynamic share image for Farcaster
  app.get("/api/share-image", async (req, res) => {
    try {
      const { type, amount, player, timestamp } = req.query;
      
      if (type !== 'jackpot') {
        return res.status(400).json({ error: "Invalid share type" });
      }

      // Generate dynamic SVG image for jackpot share
      const tokenAmount = amount ? (parseFloat(amount as string) / 1e18).toFixed(1) : '0';
      const playerName = player || 'Anonymous Player';
      
      const svgImage = `
        <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
          <!-- Background Gradient -->
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#2d1b69;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#ffed4e;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#ffd700;stop-opacity:1" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- Background -->
          <rect width="600" height="400" fill="url(#bg)"/>
          
          <!-- Casino Pattern -->
          <circle cx="100" cy="100" r="30" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.3"/>
          <circle cx="500" cy="100" r="25" fill="none" stroke="#ff6b35" stroke-width="2" opacity="0.3"/>
          <circle cx="100" cy="300" r="35" fill="none" stroke="#ff6b35" stroke-width="2" opacity="0.3"/>
          <circle cx="500" cy="300" r="28" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.3"/>
          
          <!-- Main Title -->
          <text x="300" y="80" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="48" font-weight="900" fill="url(#goldGrad)" filter="url(#glow)">🎰 JACKPOT! 🎰</text>
          
          <!-- Amount -->
          <text x="300" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#fff">+${tokenAmount} TOKENS!</text>
          
          <!-- Player Name -->
          <text x="300" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#ffd700">${playerName}</text>
          
          <!-- Bottom Text -->
          <text x="300" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#fff">won big on</text>
          <text x="300" y="280" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="28" font-weight="bold" fill="url(#goldGrad)">ArbCasino</text>
          
          <!-- Call to Action -->
          <text x="300" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#ccc">Feeling lucky? Try your spin! 🍀</text>
          
          <!-- Decorative Elements -->
          <text x="50" y="360" font-size="24" fill="#ffd700">💎</text>
          <text x="550" y="360" font-size="24" fill="#ffd700">💰</text>
          <text x="30" y="50" font-size="20" fill="#ff6b35">🔥</text>
          <text x="570" y="50" font-size="20" fill="#ff6b35">⚡</text>
        </svg>
      `;

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(svgImage);
      
    } catch (error: any) {
      console.error("Share image generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate meta tags for sharing a specific jackpot
  app.get("/share/jackpot/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, player } = req.query;
      
      const tokenAmount = amount ? (parseFloat(amount as string) / 1e18).toFixed(1) : '0';
      const playerName = player || 'Anonymous Player';
      const shareImageUrl = `${req.protocol}://${req.get('host')}/api/share-image?type=jackpot&amount=${amount}&player=${encodeURIComponent(playerName as string)}&timestamp=${Date.now()}`;
      
      // Farcaster Mini App embed data
      const embedData = {
        version: "1",
        imageUrl: shareImageUrl,
        button: {
          title: "🎰 Spin for Jackpot",
          action: {
            type: "launch_miniapp",
            url: `${req.protocol}://${req.get('host')}`,
            name: "ArbCasino",
            splashImageUrl: `${req.protocol}://${req.get('host')}/logo-icon.png`,
            splashBackgroundColor: "#1a1a1a"
          }
        }
      };

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>🎰 ${playerName} won ${tokenAmount} tokens on ArbCasino!</title>
          <meta name="description" content="${playerName} just hit the JACKPOT and won ${tokenAmount} tokens! Feeling lucky? Try your spin on ArbCasino!">
          
          <!-- Farcaster Mini App Embed -->
          <meta name="fc:miniapp" content='${JSON.stringify(embedData)}' />
          <!-- Backward compatibility -->
          <meta name="fc:frame" content='${JSON.stringify({...embedData, button: {...embedData.button, action: {...embedData.button.action, type: "launch_frame"}}})}' />
          
          <!-- Open Graph -->
          <meta property="og:title" content="🎰 ${playerName} won ${tokenAmount} tokens on ArbCasino!">
          <meta property="og:description" content="Just hit the JACKPOT! Feeling lucky? Try your spin!">
          <meta property="og:image" content="${shareImageUrl}">
          <meta property="og:url" content="${req.protocol}://${req.get('host')}/share/jackpot/${id}">
          <meta property="og:type" content="website">
          
          <!-- Twitter -->
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="🎰 ${playerName} won ${tokenAmount} tokens on ArbCasino!">
          <meta name="twitter:description" content="Just hit the JACKPOT! Feeling lucky? Try your spin!">
          <meta name="twitter:image" content="${shareImageUrl}">
          
          <style>
            body {
              font-family: Arial, sans-serif;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d1b69 50%, #1a1a1a 100%);
              color: white;
              text-align: center;
              padding: 50px 20px;
              margin: 0;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .celebration {
              max-width: 600px;
              margin: 0 auto;
            }
            .title {
              font-size: 3em;
              font-weight: 900;
              color: #ffd700;
              text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
              margin-bottom: 20px;
              animation: pulse 2s infinite;
            }
            .amount {
              font-size: 2em;
              color: #fff;
              margin-bottom: 20px;
            }
            .player {
              font-size: 1.2em;
              color: #ffd700;
              margin-bottom: 30px;
            }
            .cta {
              font-size: 1.1em;
              margin-top: 30px;
              opacity: 0.8;
            }
            .link {
              display: inline-block;
              background: linear-gradient(45deg, #ffd700, #ff6b35);
              color: black;
              padding: 15px 30px;
              border-radius: 10px;
              text-decoration: none;
              font-weight: bold;
              margin-top: 20px;
              transition: transform 0.2s;
            }
            .link:hover {
              transform: scale(1.05);
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
          </style>
        </head>
        <body>
          <div class="celebration">
            <div class="title">🎰 JACKPOT! 🎰</div>
            <div class="amount">+${tokenAmount} TOKENS!</div>
            <div class="player">${playerName}</div>
            <div>won big on <strong style="color: #ffd700;">ArbCasino</strong></div>
            <div class="cta">Feeling lucky? Try your spin! 🍀</div>
            <a href="${req.protocol}://${req.get('host')}" class="link">🎰 Spin for Jackpot</a>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      
    } catch (error: any) {
      console.error("Share page generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}