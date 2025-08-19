// Simple contract check script without hardhat dependency
const https = require('https');

const CONTRACT_ADDRESS = '0x4be6dd3897fd6fbc8a619c69fa6f4bd94531d90a';
const RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';

function callRPC(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    });

    const options = {
      hostname: 'sepolia-rollup.arbitrum.io',
      port: 443,
      path: '/rpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

async function checkContract() {
  console.log('Checking contract at:', CONTRACT_ADDRESS);
  
  try {
    // Check if contract exists
    const codeResult = await callRPC('eth_getCode', [CONTRACT_ADDRESS, 'latest']);
    console.log('Contract code exists:', codeResult.result !== '0x');
    
    if (codeResult.result === '0x') {
      console.log('ERROR: No contract found at this address!');
      return;
    }

    // Try to read totalSpins (if it's a simple contract)
    const totalSpinsCall = await callRPC('eth_call', [
      {
        to: CONTRACT_ADDRESS,
        data: '0x7e6b6062' // totalSpins() selector
      },
      'latest'
    ]);
    
    console.log('totalSpins call result:', totalSpinsCall.result);
    
    if (totalSpinsCall.result && totalSpinsCall.result !== '0x') {
      const totalSpins = parseInt(totalSpinsCall.result, 16);
      console.log('Total spins from contract:', totalSpins);
    }

    console.log('Contract check completed successfully!');
    
  } catch (error) {
    console.error('Error checking contract:', error);
  }
}

checkContract();