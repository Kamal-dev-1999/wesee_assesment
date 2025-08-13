# 🚀 Quick Setup Guide

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension

## 🏃‍♂️ Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd wesee
npm install
```

### 2. Start Local Blockchain
```bash
npm run node
```
Keep this terminal running - it starts Hardhat network on `http://127.0.0.1:8545`

### 3. Deploy Smart Contracts
Open a new terminal:
```bash
npm run deploy
```
This will:
- Deploy all smart contracts
- Create `.env` file with contract addresses
- Display deployment summary

### 4. Start Backend API
Open a new terminal:
```bash
npm run backend
```
Backend runs on `http://localhost:3000`

### 5. Start Indexer
Open a new terminal:
```bash
npm run indexer
```
Indexer runs on `http://localhost:3001`

### 6. Test Everything Works
Open a new terminal:
```bash
npm run test-api
```
This will test all API endpoints and show you if everything is working.

### 7. Open Frontend
Open `frontend/index.html` in your browser or serve it with a local server.

## 🎯 What You Can Do Now

### For Users (Frontend):
1. **Connect MetaMask** to the local network
2. **Add Dummy USDT** to your wallet (for testing)
3. **Purchase GT Tokens** using USDT (1:1 conversion)
4. **Create Matches** between players
5. **Submit Match Results** to award winners
6. **View Leaderboard** of top players

### For Developers (API):
- `GET /health` - Check if backend is running
- `GET /balance/:address` - Get GT balance for any address
- `GET /rate` - Get USDT to GT conversion rate
- `POST /add-dummy-usdt` - Add test USDT to any address
- `POST /purchase` - Purchase GT tokens with USDT
- `POST /match/start` - Create a new match
- `POST /match/result` - Submit match winner
- `GET /match/:matchId` - Get match information
- `GET /leaderboard` - Get top 10 players (from indexer)

## 🔧 Troubleshooting

### Common Issues:

1. **"Backend is not authorized"**
   - Make sure you ran `npm run deploy` after starting the node
   - Check that `.env` file was created with contract addresses

2. **"Contract not found"**
   - Ensure Hardhat node is running
   - Re-deploy contracts with `npm run deploy`

3. **"Insufficient USDT"**
   - Use the "Add Dummy USDT" feature in the frontend
   - Or call the API directly: `POST /add-dummy-usdt`

4. **"Insufficient allowance"**
   - The purchase endpoint handles this automatically
   - In a real scenario, users would approve USDT spending first

5. **Frontend not loading**
   - Check browser console for errors
   - Ensure MetaMask is connected to localhost:8545
   - Make sure backend and indexer are running

### Network Configuration:
- **Chain ID**: 1337 (Hardhat default)
- **RPC URL**: http://127.0.0.1:8545
- **Currency Symbol**: ETH

## 📊 Testing Flow

1. **Add USDT**: Use frontend or API to add dummy USDT
2. **Buy GT**: Purchase GT tokens with USDT
3. **Create Match**: Start a match between two players
4. **Stake Tokens**: Players stake GT tokens (frontend will handle this)
5. **Submit Result**: Backend submits winner
6. **Check Leaderboard**: See updated player rankings

## 🎉 Success Indicators

✅ **Backend**: Shows "Backend API server running on port 3000"
✅ **Indexer**: Shows "Gaming Indexer initialized successfully"
✅ **Test Script**: All tests pass with green checkmarks
✅ **Frontend**: Can connect wallet and see GT balance
✅ **Leaderboard**: Shows player data after matches

## 🚨 Emergency Reset

If something goes wrong:
```bash
# Stop all processes (Ctrl+C)
# Delete .env file
rm .env

# Restart from step 2
npm run node
npm run deploy
npm run backend
npm run indexer
```

## 📝 Notes

- This is a **test environment** - all tokens are dummy/test tokens
- **USDT to GT conversion** is 1:1 for simplicity
- **Match staking** requires players to have GT tokens first
- **Leaderboard** updates automatically when matches are settled
- **SQLite database** stores all player and match data locally

Happy gaming! 🎮
