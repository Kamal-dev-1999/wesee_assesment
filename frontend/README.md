# Gaming Staking dApp Frontend

This is the React frontend for the Gaming Staking dApp.

## Features

- 🔗 **MetaMask Wallet Integration** - Connect your Ethereum wallet
- 💰 **Token Balance Display** - View your GT token balance
- 🎯 **Match Management** - Start new matches and submit results
- 🏆 **Leaderboard** - View top players and their statistics
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Prerequisites

- Node.js 16+ and npm
- MetaMask browser extension
- Backend API running on port 3000
- Indexer running on port 3001

## Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Connect Wallet**: Click "Connect MetaMask" to connect your Ethereum wallet
2. **View Balance**: Check your GT token balance
3. **Start Match**: Create a new match with players and stake amount
4. **Submit Results**: Report match winners
5. **View Leaderboard**: See top players and their stats

## API Endpoints

The frontend connects to:
- **Backend API**: `http://localhost:3000` (proxy configured)
- **Indexer API**: `http://localhost:3001` (direct connection)

## Building for Production

```bash
npm run build
```

This creates a `build` folder with optimized production files.

## Troubleshooting

- Make sure MetaMask is installed and connected to the correct network
- Ensure the backend and indexer services are running
- Check browser console for any error messages
- Verify contract addresses in the backend configuration
