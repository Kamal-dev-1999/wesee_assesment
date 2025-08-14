const { ethers } = require('hardhat');
require('dotenv').config();

async function checkGTBalance() {
    try {
        // Get the wallet address from command line argument
        const walletAddress = process.argv[2];
        
        if (!walletAddress) {
            console.log('❌ Please provide a wallet address!');
            console.log('Usage: node check-gt-balance.js <WALLET_ADDRESS>');
            console.log('Example: node check-gt-balance.js 0x1234...');
            return;
        }

        // Validate address
        if (!ethers.isAddress(walletAddress)) {
            console.log('❌ Invalid wallet address!');
            return;
        }

        console.log('🔍 Checking GT Token Balance...\n');
        console.log('Wallet Address:', walletAddress);
        console.log('Network:', process.env.RPC_URL?.includes('sepolia') ? 'Sepolia' : 'Local');
        console.log('GT Token Address:', process.env.GAME_TOKEN_ADDRESS);
        console.log('');

        // Connect to the network
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        
        // Create contract instance
        const gameTokenABI = [
            "function balanceOf(address account) external view returns (uint256)",
            "function decimals() external view returns (uint8)",
            "function symbol() external view returns (string)"
        ];
        
        const gameTokenContract = new ethers.Contract(
            process.env.GAME_TOKEN_ADDRESS,
            gameTokenABI,
            provider
        );

        // Get balance
        const balance = await gameTokenContract.balanceOf(walletAddress);
        const decimals = await gameTokenContract.decimals();
        const symbol = await gameTokenContract.symbol();
        const formattedBalance = ethers.formatUnits(balance, decimals);

        console.log('📊 Balance Results:');
        console.log('==================');
        console.log(`Token: ${symbol}`);
        console.log(`Raw Balance: ${balance.toString()}`);
        console.log(`Formatted Balance: ${formattedBalance} ${symbol}`);
        console.log(`Decimals: ${decimals}`);
        
        if (balance > 0) {
            console.log('\n✅ You have GT tokens in your wallet!');
        } else {
            console.log('\n❌ No GT tokens found in this wallet.');
            console.log('💡 You can purchase GT tokens using the /purchase endpoint.');
        }

    } catch (error) {
        console.error('❌ Error checking balance:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure your backend is running: npm run backend');
        console.log('2. Check if .env file has correct contract addresses');
        console.log('3. Verify the wallet address is correct');
    }
}

checkGTBalance();
