const { ethers } = require('ethers');
require('dotenv').config();

async function checkContracts() {
    console.log('🔍 Checking contract deployment status...\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    
    const contracts = [
        { name: 'MockUSDT', address: process.env.MOCK_USDT_ADDRESS },
        { name: 'GameToken', address: process.env.GAME_TOKEN_ADDRESS },
        { name: 'TokenStore', address: process.env.TOKEN_STORE_ADDRESS },
        { name: 'PlayGame', address: process.env.PLAY_GAME_ADDRESS }
    ];
    
    for (const contract of contracts) {
        try {
            const code = await provider.getCode(contract.address);
            if (code === '0x') {
                console.log(`❌ ${contract.name}: NOT DEPLOYED at ${contract.address}`);
            } else {
                console.log(`✅ ${contract.name}: DEPLOYED at ${contract.address}`);
            }
        } catch (error) {
            console.log(`❌ ${contract.name}: ERROR checking ${contract.address} - ${error.message}`);
        }
    }
    
    console.log('\n📋 Environment Variables:');
    console.log('RPC_URL:', process.env.RPC_URL);
    console.log('BACKEND_PRIVATE_KEY:', process.env.BACKEND_PRIVATE_KEY ? 'LOADED' : 'MISSING');
    console.log('CHAIN_ID:', process.env.CHAIN_ID);
    
    // Check if we can connect to the network
    try {
        const network = await provider.getNetwork();
        console.log('\n🌐 Network Info:');
        console.log('Chain ID:', network.chainId);
        console.log('Network name:', network.name);
    } catch (error) {
        console.log('\n❌ Cannot connect to network:', error.message);
    }
    
    // Check backend wallet
    if (process.env.BACKEND_PRIVATE_KEY) {
        try {
            const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
            const balance = await provider.getBalance(wallet.address);
            console.log('\n👛 Backend Wallet:');
            console.log('Address:', wallet.address);
            console.log('Balance:', ethers.formatEther(balance), 'ETH');
        } catch (error) {
            console.log('\n❌ Error with backend wallet:', error.message);
        }
    }
}

checkContracts().catch(console.error);
