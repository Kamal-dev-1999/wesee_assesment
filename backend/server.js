const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

// Debug: Check environment variables
console.log('Environment variables loaded:');
console.log('RPC_URL:', process.env.RPC_URL);
console.log('BACKEND_PRIVATE_KEY:', process.env.BACKEND_PRIVATE_KEY ? 'LOADED' : 'MISSING');
console.log('PLAY_GAME_ADDRESS:', process.env.PLAY_GAME_ADDRESS);
console.log('TOKEN_STORE_ADDRESS:', process.env.TOKEN_STORE_ADDRESS);
console.log('GAME_TOKEN_ADDRESS:', process.env.GAME_TOKEN_ADDRESS);

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Contract ABIs (simplified for this example)
const PLAY_GAME_ABI = [
    "function createMatch(bytes32 matchId, address p1, address p2, uint256 stake) external",
    "function commitResult(bytes32 matchId, address winner) external",
    "function stake(bytes32 matchId) external",
    "function refund(bytes32 matchId) external",
    "function getMatch(bytes32 matchId) external view returns (address player1, address player2, uint256 stake, uint8 status, uint256 startTime, bool player1Staked, bool player2Staked)",
    "function owner() external view returns (address)",
    "function gameToken() external view returns (address)",
    "function matches(bytes32) external view returns (address player1, address player2, uint256 stake, uint8 status, uint256 startTime, bool player1Staked, bool player2Staked)",
    "function TIMEOUT_PERIOD() external view returns (uint256)"
];

const TOKEN_STORE_ABI = [
    "function buy(uint256 usdtAmount) external",
    "function gtPerUsdt() external view returns (uint256)",
    "function owner() external view returns (address)"
];

const GAME_TOKEN_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function mint(address to, uint256 amount) external",
    "function owner() external view returns (address)"
];

const MOCK_USDT_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

// Contract instances
const playGameContract = new ethers.Contract(
    process.env.PLAY_GAME_ADDRESS,
    PLAY_GAME_ABI,
    wallet
);

const tokenStoreContract = new ethers.Contract(
    process.env.TOKEN_STORE_ADDRESS,
    TOKEN_STORE_ABI,
    wallet
);

const gameTokenContract = new ethers.Contract(
    process.env.GAME_TOKEN_ADDRESS,
    GAME_TOKEN_ABI,
    wallet
);

const mockUSDTContract = new ethers.Contract(
    process.env.MOCK_USDT_ADDRESS,
    MOCK_USDT_ABI,
    wallet
);

// Verify backend is authorized
async function verifyAuthorization() {
    try {
        console.log('🔍 Checking PlayGame contract authorization...');
        console.log('Contract address:', process.env.PLAY_GAME_ADDRESS);
        console.log('Backend wallet address:', wallet.address);
        
        // First, check if the contract exists and is deployed
        const code = await provider.getCode(process.env.PLAY_GAME_ADDRESS);
        if (code === '0x') {
            console.error('❌ PlayGame contract not deployed at the specified address!');
            console.error('Please run npm run deploy to deploy the contracts');
            process.exit(1);
        }
        
        console.log('✅ PlayGame contract found at address');
        
        // Try to get the owner
        try {
            const owner = await playGameContract.owner();
            console.log('Contract owner:', owner);
            console.log('Backend wallet:', wallet.address);
            
            if (owner !== wallet.address) {
                console.error("❌ Backend is not authorized to operate PlayGame contract!");
                console.error("Expected owner:", wallet.address);
                console.error("Actual owner:", owner);
                console.error("Please make sure you're using the correct private key");
                process.exit(1);
            }
            console.log("✅ Backend authorization verified");
        } catch (ownerError) {
            console.error('❌ Error calling owner() function:', ownerError.message);
            console.log('🔧 This might mean the contract was not deployed correctly');
            console.log('🔧 Or there might be an ABI mismatch');
            console.log('🔧 Trying alternative approach...');
            
            // Try to call a simple function to see if contract is working
            try {
                const gameTokenAddress = await playGameContract.gameToken();
                console.log('✅ Contract is working, gameToken address:', gameTokenAddress);
                console.log('⚠️  Skipping owner verification for now');
                console.log('⚠️  Make sure the backend private key matches the deployer');
            } catch (gameTokenError) {
                console.error('❌ Contract is not responding correctly');
                console.error('Please re-deploy the contracts: npm run deploy');
                process.exit(1);
            }
        }
    } catch (error) {
        console.error("❌ Failed to verify authorization:", error);
        console.error("Please check your .env file and contract deployment");
        process.exit(1);
    }
}

// Helper function to add delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to get latest nonce and create transaction with it
async function createTransactionWithLatestNonce(contract, methodName, args) {
    // Get the LATEST nonce from the blockchain
    const latestNonce = await provider.getTransactionCount(wallet.address, "latest");
    console.log(`Using latest nonce: ${latestNonce}`);
    
    // Build transaction object with fresh nonce
    const tx = await contract[methodName].populateTransaction(...args, {
        nonce: latestNonce
    });
    
    // Sign and send the transaction
    const signedTx = await wallet.sendTransaction(tx);
    return signedTx;
}

// Helper function to get latest nonce for deployer wallet
async function createDeployerTransactionWithLatestNonce(contract, methodName, args, deployerWallet) {
    // Get the LATEST nonce from the blockchain
    const latestNonce = await provider.getTransactionCount(deployerWallet.address, "latest");
    console.log(`Using latest nonce for deployer: ${latestNonce}`);
    
    // Build transaction object with fresh nonce
    const tx = await contract[methodName].populateTransaction(...args, {
        nonce: latestNonce
    });
    
    // Sign and send the transaction
    const signedTx = await deployerWallet.sendTransaction(tx);
    return signedTx;
}

// API Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: process.env.RPC_URL,
        backendAddress: wallet.address
    });
});

// Get user's GT balance
app.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const balance = await gameTokenContract.balanceOf(address);
        const decimals = await gameTokenContract.decimals();
        const formattedBalance = ethers.formatUnits(balance, decimals);
        
        res.json({
            address,
            balance: formattedBalance,
            rawBalance: balance.toString()
        });
    } catch (error) {
        console.error('Error getting balance:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

// Get token conversion rate
app.get('/rate', async (req, res) => {
    try {
        const rate = await tokenStoreContract.gtPerUsdt();
        res.json({
            gtPerUsdt: ethers.formatEther(rate)
        });
    } catch (error) {
        console.error('Error getting rate:', error);
        res.status(500).json({ error: 'Failed to get rate' });
    }
});

// NEW: Add dummy USDT to user's wallet (for testing)
app.post('/add-dummy-usdt', async (req, res) => {
    try {
        const { address, amount } = req.body;
        
        // Validate input
        if (!address || !ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        
        const userAddr = ethers.getAddress(address);
        const usdtAmount = ethers.parseUnits(amount || "100", 6); // Default 100 USDT
        
        // Get deployer account (account #0) to give USDT to user
        const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const deployerWallet = new ethers.Wallet(deployerPrivateKey, wallet.provider);
        
        const deployerUSDTContract = new ethers.Contract(process.env.MOCK_USDT_ADDRESS, MOCK_USDT_ABI, deployerWallet);
        
        // Check deployer's USDT balance
        const deployerUSDTBalance = await deployerUSDTContract.balanceOf(deployerWallet.address);
        console.log(`Deployer USDT balance: ${ethers.formatUnits(deployerUSDTBalance, 6)} USDT`);
        
        if (deployerUSDTBalance < usdtAmount) {
            return res.status(400).json({ 
                error: `Deployer has insufficient USDT. Balance: ${ethers.formatUnits(deployerUSDTBalance, 6)} USDT, trying to give: ${ethers.formatUnits(usdtAmount, 6)} USDT` 
            });
        }
        
        // Add delay and get fresh nonce
        console.log('Waiting 2 seconds before transaction...');
        await delay(2000);
        
        // Transfer USDT from deployer to user
        const tx = await createDeployerTransactionWithLatestNonce(deployerUSDTContract, 'transfer', [userAddr, usdtAmount], deployerWallet);
        await tx.wait();
        
        // Check new user USDT balance
        const newUserUSDTBalance = await deployerUSDTContract.balanceOf(userAddr);
        
        res.json({
            message: 'USDT added successfully',
            address: userAddr,
            usdtAmount: ethers.formatUnits(usdtAmount, 6),
            newBalance: ethers.formatUnits(newUserUSDTBalance, 6),
            transactionHash: tx.hash
        });
    } catch (error) {
        console.error('Error adding dummy USDT:', error);
        const msg = error?.reason || error?.message || 'Failed to add USDT';
        res.status(500).json({ error: msg });
    }
});

// NEW: Give USDT to backend (for testing)
app.post('/give-backend-usdt', async (req, res) => {
    try {
        const { amount } = req.body;
        
        const usdtAmount = ethers.parseUnits(amount || "1000", 6); // Default 1000 USDT
        
        // Get deployer account (account #0) to give USDT to backend
        const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const deployerWallet = new ethers.Wallet(deployerPrivateKey, wallet.provider);
        
        const deployerUSDTContract = new ethers.Contract(process.env.MOCK_USDT_ADDRESS, MOCK_USDT_ABI, deployerWallet);
        
        // Check deployer's USDT balance
        const deployerUSDTBalance = await deployerUSDTContract.balanceOf(deployerWallet.address);
        console.log(`Deployer USDT balance: ${ethers.formatUnits(deployerUSDTBalance, 6)} USDT`);
        
        if (deployerUSDTBalance < usdtAmount) {
            return res.status(400).json({ 
                error: `Deployer has insufficient USDT. Balance: ${ethers.formatUnits(deployerUSDTBalance, 6)} USDT, trying to give: ${ethers.formatUnits(usdtAmount, 6)} USDT` 
            });
        }
        
        // Add delay and get fresh nonce
        console.log('Waiting 2 seconds before transaction...');
        await delay(2000);
        
        // Transfer USDT from deployer to backend
        const tx = await createDeployerTransactionWithLatestNonce(deployerUSDTContract, 'transfer', [wallet.address, usdtAmount], deployerWallet);
        await tx.wait();
        
        // Check new backend USDT balance
        const newBackendUSDTBalance = await deployerUSDTContract.balanceOf(wallet.address);
        
        res.json({
            message: 'USDT given to backend successfully',
            backendAddress: wallet.address,
            usdtAmount: ethers.formatUnits(usdtAmount, 6),
            newBackendBalance: ethers.formatUnits(newBackendUSDTBalance, 6),
            transactionHash: tx.hash
        });
    } catch (error) {
        console.error('Error giving USDT to backend:', error);
        const msg = error?.reason || error?.message || 'Failed to give USDT to backend';
        res.status(500).json({ error: msg });
    }
});

// NEW: Purchase GT tokens with USDT (facilitates the purchase)
app.post('/purchase', async (req, res) => {
    try {
        const { address, usdtAmount } = req.body;
        
        // Validate input
        if (!address || !ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        if (!usdtAmount || Number(usdtAmount) <= 0) {
            return res.status(400).json({ error: 'Invalid USDT amount' });
        }
        
        const userAddr = ethers.getAddress(address);
        const usdtToSpend = ethers.parseUnits(usdtAmount.toString(), 6);
        
        // Check user's USDT balance
        const userUSDTBalance = await mockUSDTContract.balanceOf(userAddr);
        if (userUSDTBalance < usdtToSpend) {
            return res.status(400).json({ 
                error: `Insufficient USDT balance. User has ${ethers.formatUnits(userUSDTBalance, 6)} USDT, trying to spend ${ethers.formatUnits(usdtToSpend, 6)} USDT` 
            });
        }
        
        console.log(`Processing purchase for user ${userAddr}...`);
        
        // For testing purposes, we'll use a simplified approach
        // We'll use the backend's own USDT to buy GT tokens through TokenStore
        // This simulates the purchase process while respecting contract access controls
        
        // Check backend's USDT balance
        const backendUSDTBalance = await mockUSDTContract.balanceOf(wallet.address);
        if (backendUSDTBalance < usdtToSpend) {
            return res.status(400).json({ 
                error: `Backend has insufficient USDT. Balance: ${ethers.formatUnits(backendUSDTBalance, 6)} USDT, trying to spend: ${ethers.formatUnits(usdtToSpend, 6)} USDT` 
            });
        }
        
        // Add delay before transactions
        console.log('Waiting 2 seconds before transaction...');
        await delay(2000);
        
        // Check backend's USDT allowance for TokenStore
        const allowance = await mockUSDTContract.allowance(wallet.address, process.env.TOKEN_STORE_ADDRESS);
        console.log(`Backend USDT allowance for TokenStore: ${ethers.formatUnits(allowance, 6)} USDT`);
        
        // If allowance is insufficient, approve TokenStore to spend backend's USDT
        if (allowance < usdtToSpend) {
            console.log(`Approving TokenStore to spend ${ethers.formatUnits(usdtToSpend, 6)} USDT...`);
            const approveTx = await createTransactionWithLatestNonce(mockUSDTContract, 'approve', [process.env.TOKEN_STORE_ADDRESS, usdtToSpend]);
            await approveTx.wait();
            console.log(`USDT approval successful`);
            
            // Add delay after approval
            console.log('Waiting 2 seconds before transaction...');
            await delay(2000);
        }

        // Backend buys GT tokens through TokenStore (which will mint to backend)
        const buyTx = await createTransactionWithLatestNonce(tokenStoreContract, 'buy', [usdtToSpend]);
        await buyTx.wait();
        console.log(`Backend purchased GT tokens through TokenStore`);
        
        // Add delay after purchase
        console.log('Waiting 2 seconds before transaction...');
        await delay(2000);
        
        // Calculate GT amount (1:1 conversion rate)
        // USDT has 6 decimals, GT has 18 decimals, so we need to convert properly
        const gtAmount = ethers.parseEther(ethers.formatUnits(usdtToSpend, 6)); // Convert USDT amount to GT with proper decimals
        
        // Transfer GT tokens from backend to user
        const transferGTx = await createTransactionWithLatestNonce(gameTokenContract, 'transfer', [userAddr, gtAmount]);
        await transferGTx.wait();
        console.log(`Transferred ${ethers.formatEther(gtAmount)} GT tokens to user ${userAddr}`);
        
        // Check user's new GT balance
        const newGTBalance = await gameTokenContract.balanceOf(userAddr);
        
        res.json({
            message: 'GT tokens purchased successfully',
            address: userAddr,
            usdtSpent: ethers.formatUnits(usdtToSpend, 6),
            gtReceived: ethers.formatEther(gtAmount),
            newGTBalance: ethers.formatEther(newGTBalance),
            transactionHash: buyTx.hash,
            note: 'Purchase completed via TokenStore using backend USDT (testing mode)'
        });
        
    } catch (error) {
        console.error('Error purchasing GT tokens:', error);
        const msg = error?.reason || error?.message || 'Failed to purchase GT tokens';
        res.status(500).json({ error: msg });
    }
});

// Stake into a match (Hardhat testing only)
app.post('/match/stake', async (req, res) => {
	try {
		const { matchId, player } = req.body;
		if (!matchId || !player) {
			return res.status(400).json({ error: 'Missing required fields: matchId, player' });
		}
		if (!ethers.isAddress(player)) {
			return res.status(400).json({ error: 'player must be a valid 0x address' });
		}

		const playerAddr = ethers.getAddress(player);
		const hashedMatchId = ethers.id(matchId);

		// Fetch match data
		const matchData = await playGameContract.getMatch(hashedMatchId);
		if (matchData.player1 === ethers.ZeroAddress && matchData.player2 === ethers.ZeroAddress) {
			return res.status(404).json({ error: 'Match not found' });
		}
		if (playerAddr !== ethers.getAddress(matchData.player1) && playerAddr !== ethers.getAddress(matchData.player2)) {
			return res.status(400).json({ error: 'Player is not part of this match' });
		}
		if (Number(matchData.status) !== 0) { // 0=PENDING
			return res.status(400).json({ error: 'Match not in pending status' });
		}

		const requiredStake = matchData.stake;

		// Ensure player has enough GT
		const playerGtBalance = await gameTokenContract.balanceOf(playerAddr);
		if (playerGtBalance < requiredStake) {
			return res.status(400).json({
				error: `Insufficient GT balance. Player has ${ethers.formatEther(playerGtBalance)} GT, needs ${ethers.formatEther(requiredStake)} GT`
			});
		}

		// Check allowance to PlayGame
		const currentAllowance = await gameTokenContract.allowance(playerAddr, process.env.PLAY_GAME_ADDRESS);

		// Impersonate player (Hardhat only) to approve and stake
		await provider.send('hardhat_impersonateAccount', [playerAddr]);
		const playerSigner = await provider.getSigner(playerAddr);
		const playerGT = new ethers.Contract(process.env.GAME_TOKEN_ADDRESS, GAME_TOKEN_ABI, playerSigner);
		const playerPlayGame = new ethers.Contract(process.env.PLAY_GAME_ADDRESS, PLAY_GAME_ABI, playerSigner);

		// Approve if needed
		let approveHash = null;
		if (currentAllowance < requiredStake) {
			console.log(`Approving PlayGame to spend ${ethers.formatEther(requiredStake)} GT for ${playerAddr}...`);
			const approveTx = await playerGT.approve(process.env.PLAY_GAME_ADDRESS, requiredStake);
			await approveTx.wait();
			approveHash = approveTx.hash;
		}

		// Small delay
		await delay(500);

		// Stake
		console.log(`Staking for player ${playerAddr} into match ${matchId}...`);
		const stakeTx = await playerPlayGame.stake(hashedMatchId);
		await stakeTx.wait();

		// Stop impersonation
		await provider.send('hardhat_stopImpersonatingAccount', [playerAddr]);

		// Return updated match state
		const updated = await playGameContract.getMatch(hashedMatchId);
		const statusNames = ['PENDING', 'STAKED', 'SETTLED', 'REFUNDED'];
		return res.json({
			message: 'Stake successful',
			matchId,
			player: playerAddr,
			stake: ethers.formatEther(requiredStake),
			approvalTx: approveHash,
			stakeTx: stakeTx.hash,
			matchStatus: statusNames[Number(updated.status)],
			player1Staked: Boolean(updated.player1Staked),
			player2Staked: Boolean(updated.player2Staked)
		});
	} catch (error) {
		console.error('Error staking:', error);
		const msg = error?.shortMessage || error?.reason || error?.message || 'Failed to stake';
		res.status(500).json({ error: msg });
	}
});

// Start a new match
app.post('/match/start', async (req, res) => {
    try {
        const { matchId, player1, player2, stake } = req.body;
        
        // Validate input
        if (!matchId || !player1 || !player2 || !stake) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!ethers.isAddress(player1) || !ethers.isAddress(player2)) {
            return res.status(400).json({ error: 'player1/player2 must be valid 0x addresses' });
        }
        
        const p1 = ethers.getAddress(player1);
        const p2 = ethers.getAddress(player2);
        if (p1 === p2) {
            return res.status(400).json({ error: 'Players must be different' });
        }
        if (Number(stake) <= 0) {
            return res.status(400).json({ error: 'Stake must be > 0' });
        }
        
        // Convert stake to wei
        const stakeWei = ethers.parseEther(stake.toString());
        
        // Hash the matchId to bytes32 format
        const hashedMatchId = ethers.id(matchId);
        
        // Add delay before transaction
        console.log('Waiting 2 seconds before transaction...');
        await delay(2000);
        
        // Create match on blockchain with latest nonce
        const tx = await createTransactionWithLatestNonce(playGameContract, 'createMatch', [hashedMatchId, p1, p2, stakeWei]);
        await tx.wait();
        
        res.json({
            message: 'Match created successfully',
            matchId,
            hashedMatchId,
            player1: p1,
            player2: p2,
            stake: ethers.formatEther(stakeWei),
            transactionHash: tx.hash
        });
        
    } catch (error) {
        console.error('Error creating match:', error);
        const msg = error?.reason || error?.message || 'Failed to create match';
        res.status(500).json({ error: msg });
    }
});

// Submit match result (with preflight debug and optional dryRun)
app.post('/match/result', async (req, res) => {
	try {
		const { matchId, winner, dryRun } = req.body || {};
		
		// Validate input
		if (!matchId || !winner) {
			return res.status(400).json({ error: 'Missing required fields' });
		}
		if (!ethers.isAddress(winner)) {
			return res.status(400).json({ error: 'winner must be a valid 0x address' });
		}
		
		const winnerAddr = ethers.getAddress(winner);
		const hashedMatchId = ethers.id(matchId);
		
		// Preflight: fetch match data for clearer errors
		const matchData = await playGameContract.getMatch(hashedMatchId);
		
		// Build preflight diagnostic info
		const exists = !(matchData.player1 === ethers.ZeroAddress && matchData.player2 === ethers.ZeroAddress);
		const statusCode = Number(matchData.status); // 0=PENDING, 1=STAKED, 2=SETTLED, 3=REFUNDED
		const statusNames = ['PENDING', 'STAKED', 'SETTLED', 'REFUNDED'];
		const status = statusNames[statusCode] || 'UNKNOWN';
		const p1 = exists ? ethers.getAddress(matchData.player1) : ethers.ZeroAddress;
		const p2 = exists ? ethers.getAddress(matchData.player2) : ethers.ZeroAddress;
		const isParticipant = exists && (winnerAddr === p1 || winnerAddr === p2);
		const p1Staked = Boolean(matchData.player1Staked);
		const p2Staked = Boolean(matchData.player2Staked);
		const bothPlayersStaked = p1Staked && p2Staked;
		
		let decision = 'NOT_READY';
		let reason = '';
		if (!exists) {
			reason = 'Match not found';
		} else if (!isParticipant) {
			reason = 'Winner must be one of the match players';
		} else if (statusCode !== 1) {
			reason = `Match status is ${status}, must be STAKED`;
		} else {
			decision = 'READY';
			reason = 'Both players staked and match is STAKED';
		}
		
		const preflight = {
			matchId,
			hashedMatchId,
			exists,
			status,
			statusCode,
			player1: p1,
			player2: p2,
			winner: winnerAddr,
			isParticipant,
			player1Staked: p1Staked,
			player2Staked: p2Staked,
			bothPlayersStaked,
			decision,
			reason
		};
		
		console.log('Result preflight:', preflight);
		
		// If dryRun, return the preflight only
		if (dryRun) {
			const httpCode = decision === 'READY' ? 200 : 400;
			return res.status(httpCode).json({ preflight, note: 'dryRun=true, no transaction sent' });
		}
		
		// Enforce readiness before sending transaction
		if (decision !== 'READY') {
			return res.status(400).json({ error: reason, preflight });
		}
		
		// Add delay before transaction
		console.log('Preflight passed. Waiting 2 seconds before transaction...');
		await delay(2000);
		
		// Commit result on blockchain with latest nonce
		const tx = await createTransactionWithLatestNonce(playGameContract, 'commitResult', [hashedMatchId, winnerAddr]);
		await tx.wait();
		
		res.json({
			message: 'Match result committed successfully',
			matchId,
			hashedMatchId,
			winner: winnerAddr,
			transactionHash: tx.hash,
			preflight
		});
		
	} catch (error) {
		console.error('Error committing result:', error);
		// Surface revert reasons and provider errors to the client
		const msg = error?.shortMessage || error?.reason || error?.message || 'Failed to commit result';
		res.status(500).json({ error: msg });
	}
});

// Get match information
app.get('/match/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        
        console.log(`Getting match info for matchId: ${matchId}`);
        
        // Hash the matchId to bytes32 format for consistency
        const hashedMatchId = ethers.id(matchId);
        console.log(`Hashed matchId: ${hashedMatchId}`);
        
        // Get match details from blockchain
        console.log('Calling playGameContract.getMatch...');
        const matchData = await playGameContract.getMatch(hashedMatchId);
        console.log('Match data received:', matchData);
        
        // Check if match exists
        if (matchData.player1 === ethers.ZeroAddress && matchData.player2 === ethers.ZeroAddress) {
            return res.status(404).json({ 
                error: 'Match not found',
                matchId,
                hashedMatchId,
                note: 'This match was not created or the matchId is incorrect'
            });
        }
        
        // Convert status enum to string
        const statusNames = ['PENDING', 'STAKED', 'SETTLED', 'REFUNDED'];
        const statusName = statusNames[matchData.status] || 'UNKNOWN';
        
        // Convert BigInt values to strings to avoid serialization issues
        const response = {
            matchId,
            hashedMatchId,
            player1: matchData.player1,
            player2: matchData.player2,
            stake: ethers.formatEther(matchData.stake),
            status: statusName,
            statusCode: Number(matchData.status),
            startTime: matchData.startTime.toString(),
            player1Staked: Boolean(matchData.player1Staked),
            player2Staked: Boolean(matchData.player2Staked)
        };
        
        console.log('Sending response:', response);
        res.json(response);
        
    } catch (error) {
        console.error('Error getting match:', error);
        const msg = error?.reason || error?.message || 'Failed to get match info';
        res.status(500).json({ 
            error: msg,
            matchId: req.params.matchId,
            note: 'Check if the match was created successfully'
        });
    }
});

// Match summary with decision if result can be posted
app.get('/match/summary/:matchId', async (req, res) => {
	try {
		const { matchId } = req.params;
		const hashedMatchId = ethers.id(matchId);

		const matchData = await playGameContract.getMatch(hashedMatchId);

		const exists = !(matchData.player1 === ethers.ZeroAddress && matchData.player2 === ethers.ZeroAddress);
		if (!exists) {
			return res.status(404).json({
				matchId,
				hashedMatchId,
				exists: false,
				decision: 'NOT_READY: match not found'
			});
		}

		const statusNames = ['PENDING', 'STAKED', 'SETTLED', 'REFUNDED'];
		const statusCode = Number(matchData.status);
		const status = statusNames[statusCode] || 'UNKNOWN';
		const player1Staked = Boolean(matchData.player1Staked);
		const player2Staked = Boolean(matchData.player2Staked);
		const bothPlayersStaked = player1Staked && player2Staked;

		let decision = 'NOT_READY: both players must stake first';
		if (statusCode === 1 && bothPlayersStaked) {
			decision = 'READY: both players staked, you can post result';
		} else if (statusCode === 2) {
			decision = 'NOT_READY: match already settled';
		} else if (statusCode === 3) {
			decision = 'NOT_READY: match refunded';
		}

		return res.json({
			matchId,
			hashedMatchId,
			exists: true,
			player1: matchData.player1,
			player2: matchData.player2,
			stake: ethers.formatEther(matchData.stake),
			status,
			statusCode,
			startTime: matchData.startTime.toString(),
			player1Staked,
			player2Staked,
			bothPlayersStaked,
			decision
		});
	} catch (error) {
		console.error('Error getting match summary:', error);
		const msg = error?.reason || error?.message || 'Failed to get match summary';
		res.status(500).json({ error: msg });
	}
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({
        message: 'Backend is working!',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /health',
            'GET /test',
            'GET /balance/:address',
            'GET /rate',
            'POST /add-dummy-usdt',
            'POST /give-backend-usdt',
            'POST /purchase',
            'POST /match/start',
            'POST /match/result',
            'POST /match/stake',
            'GET /match/:matchId',
            'GET /match/summary/:matchId'
        ]
    });
});

// Start server
async function startServer() {
    await verifyAuthorization();
    
    app.listen(PORT, () => {
        console.log(`Backend API server running on port ${PORT}`);
        console.log(`Backend wallet address: ${wallet.address}`);
        console.log(`Network: ${process.env.RPC_URL}`);
    });
}

startServer().catch(console.error);
