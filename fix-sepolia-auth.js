const fs = require('fs');
require('dotenv').config();

// The deployer account that owns the PlayGame contract
const DEPLOYER_ADDRESS = '0x74e795799621E653bCd125fbA2B0549203A5c35e';

// Sepolia contract addresses from deployment
const SEPOLIA_ADDRESSES = {
  MOCK_USDT_ADDRESS: '0xA7F42A45a3B47635b6f094C90B479Cc173B66663',
  GAME_TOKEN_ADDRESS: '0xDBa0940104b42E25e199cBfc98dF9a4cdC790237',
  TOKEN_STORE_ADDRESS: '0x55b7CA60Ed69b69D692c7129580a9a7861577180',
  PLAY_GAME_ADDRESS: '0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C'
};

function fixSepoliaAuth() {
  console.log('🔧 Fixing Sepolia Authorization Issue...\n');
  
  // Check if METAMASK_PRIVATE_KEY exists in .env
  const metamaskPrivateKey = process.env.METAMASK_PRIVATE_KEY;
  
  if (!metamaskPrivateKey) {
    console.log('❌ METAMASK_PRIVATE_KEY not found in .env file!');
    console.log('📝 Please add your MetaMask private key to .env file:');
    console.log('   METAMASK_PRIVATE_KEY=your_private_key_here');
    console.log('\n🔑 To get your MetaMask private key:');
    console.log('   1. Open MetaMask');
    console.log('   2. Go to Account Details');
    console.log('   3. Export Private Key');
    console.log('   4. Copy the private key (without 0x prefix)');
    return;
  }

  // Create the .env content with correct configuration
  const envContent = `# Sepolia Network Configuration
RPC_URL=https://sepolia.infura.io/v3/a09f8457bacc402784cc8d3fda755754
CHAIN_ID=11155111

# Contract Addresses (Sepolia)
MOCK_USDT_ADDRESS=${SEPOLIA_ADDRESSES.MOCK_USDT_ADDRESS}
GAME_TOKEN_ADDRESS=${SEPOLIA_ADDRESSES.GAME_TOKEN_ADDRESS}
TOKEN_STORE_ADDRESS=${SEPOLIA_ADDRESSES.TOKEN_STORE_ADDRESS}
PLAY_GAME_ADDRESS=${SEPOLIA_ADDRESSES.PLAY_GAME_ADDRESS}

# Backend Configuration (Using deployer's private key)
BACKEND_PRIVATE_KEY=${metamaskPrivateKey}
BACKEND_ADDRESS=${DEPLOYER_ADDRESS}
BACKEND_PORT=3000

# Indexer Configuration
INDEXER_PORT=3001

# MetaMask Private Key (for deployment)
METAMASK_PRIVATE_KEY=${metamaskPrivateKey}

# Sepolia USDT (if you want to use real USDT instead of MockUSDT)
# SEPOLIA_USDT_ADDRESS=0x7169D38820dfd117C3FA1f22a697dBA58d90BA06
`;

  try {
    fs.writeFileSync('.env', envContent);
    console.log('✅ Updated .env file with correct Sepolia configuration!');
    console.log('\n📋 Sepolia Contract Addresses:');
    Object.entries(SEPOLIA_ADDRESSES).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log('\n🔑 Authorization Fixed:');
    console.log(`   Deployer Address: ${DEPLOYER_ADDRESS}`);
    console.log(`   Backend Address: ${DEPLOYER_ADDRESS}`);
    console.log('   ✅ Now using the same account for deployment and backend');
    console.log('\n🚀 You can now start the backend:');
    console.log('   npm run backend');
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
  }
}

fixSepoliaAuth();
