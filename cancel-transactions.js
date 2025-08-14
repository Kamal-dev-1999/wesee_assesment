import { ethers } from 'ethers';

// Configuration
const RPC_URL = 'https://sepolia.infura.io/v3/a09f8457bacc402784cc8d3fda755754';
const PRIVATE_KEY = 'YOUR_PRIVATE_KEY_HERE'; 

async function cancelPendingTransactions() {
    try {
        // Connect to network
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        
        console.log(`Wallet address: ${wallet.address}`);
        
        // Get current nonce
        const currentNonce = await provider.getTransactionCount(wallet.address, "latest");
        console.log(`Current nonce: ${currentNonce}`);
        
        // Get pending nonce (includes pending transactions)
        const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");
        console.log(`Pending nonce: ${pendingNonce}`);
        
        if (pendingNonce > currentNonce) {
            console.log(`Found ${pendingNonce - currentNonce} pending transactions`);
            
            // Cancel each pending transaction
            for (let nonce = currentNonce; nonce < pendingNonce; nonce++) {
                console.log(`Cancelling transaction with nonce ${nonce}...`);
                
                // Create cancellation transaction (0 ETH to self)
                const cancelTx = {
                    to: wallet.address,
                    value: 0,
                    nonce: nonce,
                    gasLimit: 21000,
                    gasPrice: await provider.getFeeData().then(fee => fee.gasPrice * 120n / 100n) // 20% higher
                };
                
                // Send cancellation
                const tx = await wallet.sendTransaction(cancelTx);
                console.log(`Cancellation sent: ${tx.hash}`);
                
                // Wait for confirmation
                await tx.wait();
                console.log(`Cancellation confirmed: ${tx.hash}`);
            }
            
            console.log('All pending transactions cancelled!');
        } else {
            console.log('No pending transactions found');
        }
        
    } catch (error) {
        console.error('Error cancelling transactions:', error);
    }
}

// Run the function
cancelPendingTransactions();
