-- Add test tokens for Arbitrum Sepolia testnet
-- These are simple test ERC20 contracts or well-known testnet tokens

-- Clear existing tokens first
DELETE FROM tokens;

-- Add testnet-friendly tokens
-- Using USDC Testnet and other common testnet tokens on Arbitrum Sepolia
INSERT INTO tokens (address, symbol, name, decimals, is_active, reward_amount) VALUES
  ('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', 'USDC', 'USD Coin (Testnet)', 6, true, 1000000), -- 1 USDC (6 decimals)
  ('0x3f770Ac673856F105b586bb393d122721265aD46', 'LINK', 'Chainlink Token (Testnet)', 18, true, 100000000000000000), -- 0.1 LINK
  ('0x12d8CE035c5DE3Ce39B1fDD4C1d5a745EAbA3b8C', 'WETH', 'Wrapped Ether (Testnet)', 18, true, 10000000000000000); -- 0.01 WETH

-- Verify tokens were added
SELECT * FROM tokens WHERE is_active = true;