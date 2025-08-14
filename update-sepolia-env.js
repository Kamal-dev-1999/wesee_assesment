const fs = require('fs');
const path = require('path');

// Sepolia contract addresses from deployment
const SEPOLIA_ADDRESSES = {
  MOCK_USDT_ADDRESS: '0xA7F42A45a3B47635b6f094C90B479Cc173B66663',
  GAME_TOKEN_ADDRESS: '0xDBa0940104b42E25e199cBfc98dF9a4cdC790237',
  TOKEN_STORE_ADDRESS: '0x55b7CA60Ed69b69D692c7129580a9a7861577180',
  PLAY_GAME_ADDRESS: '0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C'
};

// Sepolia network configuration
const SEPOLIA_CONFIG = {
  RPC_URL: 'https://sepolia.infura.io/v3/a09f8457bacc402784cc8d3fda755754', // Your Infura project ID
  CHAIN_ID: '11155111',
  BACKEND_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  BACKEND_ADDRESS: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  BACKEND_PORT: '3000',
  INDEXER_PORT: '3001'
};

function createSepoliaEnv() {
  const envContent = `# Sepolia Network Configuration
RPC_URL=${SEPOLIA_CONFIG.RPC_URL}
CHAIN_ID=${SEPOLIA_CONFIG.CHAIN_ID}

# Contract Addresses (Sepolia)
MOCK_USDT_ADDRESS=${SEPOLIA_ADDRESSES.MOCK_USDT_ADDRESS}
GAME_TOKEN_ADDRESS=${SEPOLIA_ADDRESSES.GAME_TOKEN_ADDRESS}
TOKEN_STORE_ADDRESS=${SEPOLIA_ADDRESSES.TOKEN_STORE_ADDRESS}
PLAY_GAME_ADDRESS=${SEPOLIA_ADDRESSES.PLAY_GAME_ADDRESS}

# Backend Configuration
BACKEND_PRIVATE_KEY=${SEPOLIA_CONFIG.BACKEND_PRIVATE_KEY}
BACKEND_ADDRESS=${SEPOLIA_CONFIG.BACKEND_ADDRESS}
BACKEND_PORT=${SEPOLIA_CONFIG.BACKEND_PORT}

# Indexer Configuration
INDEXER_PORT=${SEPOLIA_CONFIG.INDEXER_PORT}

# Sepolia USDT (if you want to use real USDT instead of MockUSDT)
# SEPOLIA_USDT_ADDRESS=0x7169D38820dfd117C3FA1f22a697dBA58d90BA06
`;

  try {
    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file with Sepolia configuration!');
    console.log('\n📋 Sepolia Contract Addresses:');
    Object.entries(SEPOLIA_ADDRESSES).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log('\n⚠️  IMPORTANT: You need to update RPC_URL with your Infura project ID!');
    console.log('   Get one at: https://infura.io/');
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
}

createSepoliaEnv();
