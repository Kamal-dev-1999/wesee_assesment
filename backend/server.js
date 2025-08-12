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
    "function mintTokens(address to, uint256 amount) external",
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

// Verify backend is authorized
async function verifyAuthorization() {
    try {
        const owner = await playGameContract.owner();
        if (owner !== wallet.address) {
            console.error("Backend is not authorized to operate PlayGame contract!");
            process.exit(1);
        }
        console.log("Backend authorization verified");
    } catch (error) {
        console.error("Failed to verify authorization:", error);
        process.exit(1);
    }
}

// API Routes

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
        
        // Create match on blockchain
        const tx = await playGameContract.createMatch(
            hashedMatchId,
            p1,
            p2,
            stakeWei
        );
        
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

// Approve tokens for staking
app.post('/approve-tokens', async (req, res) => {
    try {
        const { playerAddress, amount } = req.body;
        
        // Validate input
        if (!playerAddress) {
            return res.status(400).json({ error: 'Missing playerAddress' });
        }
        if (!ethers.isAddress(playerAddress)) {
            return res.status(400).json({ error: 'playerAddress must be a valid 0x address' });
        }
        
        const playerAddr = ethers.getAddress(playerAddress);
        const approveAmount = ethers.parseEther(amount || "1000"); // Default 1000 GT
        
        // Create a wallet for the player (this is for testing - in production, players would sign their own transactions)
        const playerWallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
        
        // Approve PlayGame contract to spend player's tokens
        const tx = await gameTokenContract.connect(playerWallet).approve(
            process.env.PLAY_GAME_ADDRESS,
            approveAmount
        );
        await tx.wait();
        
        res.json({
            message: 'Tokens approved for staking',
            player: playerAddr,
            approvedAmount: ethers.formatEther(approveAmount),
            playGameContract: process.env.PLAY_GAME_ADDRESS,
            transactionHash: tx.hash
        });
        
    } catch (error) {
        console.error('Error approving tokens:', error);
        const msg = error?.reason || error?.message || 'Failed to approve tokens';
        res.status(500).json({ error: msg });
    }
});

// Stake tokens for a match
app.post('/match/stake', async (req, res) => {
    try {
        const { matchId, playerAddress } = req.body;
        
        // Validate input
        if (!matchId || !playerAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!ethers.isAddress(playerAddress)) {
            return res.status(400).json({ error: 'playerAddress must be a valid 0x address' });
        }
        
        const playerAddr = ethers.getAddress(playerAddress);
        const hashedMatchId = ethers.id(matchId);
        
        // Get match data to verify player is part of the match
        const matchData = await playGameContract.getMatch(hashedMatchId);
        
        if (matchData.player1 === ethers.ZeroAddress) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        const p1 = ethers.getAddress(matchData.player1);
        const p2 = ethers.getAddress(matchData.player2);
        
        if (playerAddr !== p1 && playerAddr !== p2) {
            return res.status(400).json({ error: 'Address is not a player in this match' });
        }
        
        // Check if already staked
        if ((playerAddr === p1 && matchData.player1Staked) || 
            (playerAddr === p2 && matchData.player2Staked)) {
            return res.status(400).json({ error: 'Player has already staked' });
        }
        
        // Check if player has approved enough tokens
        const allowance = await gameTokenContract.allowance(playerAddr, process.env.PLAY_GAME_ADDRESS);
        if (allowance < matchData.stake) {
            return res.status(400).json({ 
                error: `Insufficient allowance. Player needs to approve at least ${ethers.formatEther(matchData.stake)} GT tokens. Use /approve-tokens endpoint first.` 
            });
        }
        
        // Stake tokens (this requires the player to have approved the contract)
        const tx = await playGameContract.stake(hashedMatchId);
        await tx.wait();
        
        res.json({
            message: 'Stake successful',
            matchId,
            player: playerAddr,
            transactionHash: tx.hash
        });
        
    } catch (error) {
        console.error('Error staking:', error);
        const msg = error?.reason || error?.message || 'Failed to stake';
        res.status(500).json({ error: msg });
    }
});

// Submit match result
app.post('/match/result', async (req, res) => {
    try {
        const { matchId, winner } = req.body;
        
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
        
        if (matchData.player1 === ethers.ZeroAddress && matchData.player2 === ethers.ZeroAddress) {
            return res.status(404).json({ error: 'Match not found (did you create this match with the same matchId?)' });
        }
        if (matchData.status !== 1) { // 0=PENDING, 1=STAKED, 2=SETTLED, 3=REFUNDED
            return res.status(400).json({ error: 'Match is not staked by both players yet' });
        }
        if (winnerAddr !== ethers.getAddress(matchData.player1) && winnerAddr !== ethers.getAddress(matchData.player2)) {
            return res.status(400).json({ error: 'Winner must be one of the match players' });
        }
        
        // Commit result on blockchain
        const tx = await playGameContract.commitResult(hashedMatchId, winnerAddr);
        await tx.wait();
        
        res.json({
            message: 'Match result committed successfully',
            matchId,
            hashedMatchId,
            winner: winnerAddr,
            transactionHash: tx.hash
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
        
        // Hash the matchId to bytes32 format for consistency
        const hashedMatchId = ethers.id(matchId);
        
        // Get match details from blockchain
        const matchData = await playGameContract.getMatch(hashedMatchId);
        
        // Convert status enum to string
        const statusNames = ['PENDING', 'STAKED', 'SETTLED', 'REFUNDED'];
        const statusName = statusNames[matchData.status] || 'UNKNOWN';
        
        res.json({
            matchId,
            hashedMatchId,
            player1: matchData.player1,
            player2: matchData.player2,
            stake: ethers.formatEther(matchData.stake),
            status: statusName,
            statusCode: matchData.status,
            startTime: matchData.startTime.toString(),
            player1Staked: matchData.player1Staked,
            player2Staked: matchData.player2Staked
        });
        
    } catch (error) {
        console.error('Error getting match:', error);
        res.status(500).json({ error: 'Failed to get match info' });
    }
});

// Get tokens for testing (simple approach)
app.post('/get-test-tokens', async (req, res) => {
    try {
        const { address, amount } = req.body;
        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        
        const playerAddr = ethers.getAddress(address);
        const tokenAmount = ethers.parseEther(amount || "100");
        
        // Give player some USDT first (1 USDT)
        const mockUSDTAddress = process.env.MOCK_USDT_ADDRESS;
        const mockUSDTABI = [
            "function transfer(address to, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)"
        ];
        
        const mockUSDTContract = new ethers.Contract(mockUSDTAddress, mockUSDTABI, wallet);
        const usdtAmount = ethers.parseUnits("1", 6); // 1 USDT
        
        // Give player USDT
        const usdtTx = await mockUSDTContract.transfer(playerAddr, usdtAmount);
        await usdtTx.wait();
        
        res.json({
            message: 'USDT given to player. Player can now buy GT tokens using the TokenStore.',
            address: playerAddr,
            usdtAmount: ethers.formatUnits(usdtAmount, 6),
            instructions: 'Player should now call TokenStore.buy() with their USDT to get GT tokens'
        });
    } catch (error) {
        console.error('Error giving USDT:', error);
        const msg = error?.reason || error?.message || 'Failed to give USDT';
        res.status(500).json({ error: msg });
    }
});

// Give tokens to players (for testing) - uses backend's existing balance
app.post('/give-tokens', async (req, res) => {
    try {
        const { address, amount } = req.body;
        if (!ethers.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        
        const playerAddr = ethers.getAddress(address);
        const tokenAmount = ethers.parseEther(amount || "100");
        
        // Check backend's current balance
        const backendBalance = await gameTokenContract.balanceOf(wallet.address);
        if (backendBalance < tokenAmount) {
            return res.status(400).json({ 
                error: `Backend has insufficient tokens. Current balance: ${ethers.formatEther(backendBalance)} GT, requested: ${ethers.formatEther(tokenAmount)} GT` 
            });
        }
        
        // Transfer tokens from backend to player
        const tx = await gameTokenContract.transfer(playerAddr, tokenAmount);
        await tx.wait();
        
        res.json({
            message: 'Tokens transferred',
            address: playerAddr,
            amount: ethers.formatEther(tokenAmount),
            transactionHash: tx.hash
        });
    } catch (error) {
        console.error('Error giving tokens:', error);
        const msg = error?.reason || error?.message || 'Failed to give tokens';
        res.status(500).json({ error: msg });
    }
});



// Check backend's token balance
app.get('/backend-balance', async (req, res) => {
    try {
        const balance = await gameTokenContract.balanceOf(wallet.address);
        const decimals = await gameTokenContract.decimals();
        const formattedBalance = ethers.formatUnits(balance, decimals);
        
        res.json({
            address: wallet.address,
            balance: formattedBalance,
            rawBalance: balance.toString()
        });
    } catch (error) {
        console.error('Error getting backend balance:', error);
        res.status(500).json({ error: 'Failed to get backend balance' });
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
            'GET /backend-balance',
            'POST /get-test-tokens',
            'POST /give-tokens',
            'POST /approve-tokens',
            'POST /match/start',
            'POST /match/stake',
            'POST /match/result',
            'GET /match/:matchId',
            'GET /balance/:address',
            'GET /rate'
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: process.env.RPC_URL,
        backendAddress: wallet.address
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
