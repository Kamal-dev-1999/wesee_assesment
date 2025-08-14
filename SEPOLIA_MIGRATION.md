# 🚀 Sepolia Testnet Migration Guide

## **Overview**
This guide will help you migrate your dApp from local Hardhat network to the public Sepolia testnet.

## **Prerequisites**
- ✅ Sepolia RPC URL from Alchemy or Infura
- ✅ MetaMask wallet with Sepolia network added
- ✅ Some Sepolia ETH (get from faucets)
- ✅ Your .env file updated with Sepolia configuration

## **Phase 1: Deploy Contracts to Sepolia**

### **Step 1: Deploy Smart Contracts**
```bash
npm run deploy:sepolia
```

**Expected Output:**
```
🚀 Deploying contracts to Sepolia testnet...
📝 Deploying contracts with account: 0x...
💰 Account balance: ...
🔸 Deploying GameToken...
✅ GameToken deployed to: 0x...
🔸 Deploying TokenStore...
✅ TokenStore deployed to: 0x...
🔸 Deploying PlayGame...
✅ PlayGame deployed to: 0x...
🔧 Setting up contract permissions...
✅ Granted minting role to TokenStore
✅ Transferred PlayGame ownership to deployer
🎉 Deployment completed successfully!
```

### **Step 2: Update .env File**
Copy the new contract addresses to your `.env` file:
```bash
GAME_TOKEN_ADDRESS=0x... # New Sepolia address
TOKEN_STORE_ADDRESS=0x... # New Sepolia address
PLAY_GAME_ADDRESS=0x... # New Sepolia address
```

## **Phase 2: Test the Migration**

### **Step 1: Restart Backend**
```bash
npm run backend
```

**Look for these indicators:**
- ✅ "NETWORK: SEPOLIA" in console
- ✅ "Backend authorization verified"
- ✅ No contract deployment errors

### **Step 2: Test Basic Connectivity**
```bash
curl http://localhost:3000/health
curl http://localhost:3000/test
```

**Expected Response:**
```json
{
  "network": "SEPOLIA",
  "note": "Running on Sepolia testnet - some features may require user wallet interaction"
}
```

### **Step 3: Test Token Purchase Flow**
```bash
# First, give backend some USDT
curl -X POST http://localhost:3000/give-backend-usdt \
  -H "Content-Type: application/json" \
  -d '{"amount":"100"}'

# Then test purchase
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_METAMASK_ADDRESS","usdtAmount":"10"}'
```

## **Phase 3: MetaMask Integration**

### **Step 1: Add Sepolia Network to MetaMask**
1. Open MetaMask
2. Click network dropdown
3. Select "Add network"
4. Add Sepolia with these details:
   - **Network Name**: Sepolia
   - **RPC URL**: Your Sepolia RPC URL
   - **Chain ID**: 11155111
   - **Currency Symbol**: ETH
   - **Block Explorer**: https://sepolia.etherscan.io

### **Step 2: Import GT Token**
1. In MetaMask, click "Import tokens"
2. Paste your GameToken contract address
3. **Token Symbol**: GT
4. **Token Decimal**: 18
5. Click "Add Custom Token"

### **Step 3: Get Sepolia ETH**
- **Alchemy Faucet**: https://sepoliafaucet.com/
- **Infura Faucet**: https://www.infura.io/faucet/sepolia
- **Chainlink Faucet**: https://faucets.chain.link/sepolia

## **Phase 4: Verify Full Functionality**

### **Test Complete Flow:**
1. **Create Match**: `POST /match/start`
2. **Check Match**: `GET /match/:matchId`
3. **Submit Result**: `POST /match/result`
4. **View Balance**: `GET /balance/:address`

### **Expected Behavior on Sepolia:**
- ✅ All contract interactions work
- ✅ Transactions appear on Sepolia Etherscan
- ✅ GT tokens visible in MetaMask
- ✅ Match creation and result submission work
- ⚠️ Staking requires user wallet interaction (not backend impersonation)

## **Troubleshooting**

### **Common Issues:**

**1. "Insufficient funds for gas"**
- Get more Sepolia ETH from faucets
- Check your wallet has enough ETH for gas fees

**2. "Contract not deployed"**
- Verify contract addresses in .env file
- Check deployment was successful
- Ensure you're on Sepolia network

**3. "Transaction failed"**
- Check Sepolia Etherscan for error details
- Verify contract permissions are set correctly
- Check gas limits and prices

**4. "Backend not authorized"**
- Ensure PlayGame ownership was transferred to your wallet
- Check BACKEND_PRIVATE_KEY matches your wallet

### **Debug Commands:**
```bash
# Check contract deployment
npm run check-contracts

# Test API endpoints
npm run test-api

# View backend logs
npm run backend
```

## **Success Indicators**
- ✅ Backend starts without errors
- ✅ Health check returns "SEPOLIA" network
- ✅ Token purchase works and GT appears in MetaMask
- ✅ Match creation and result submission work
- ✅ All transactions visible on Sepolia Etherscan

## **Next Steps**
After successful migration:
1. Test with real users
2. Monitor gas costs and optimize
3. Consider upgrading to mainnet when ready
4. Implement proper user wallet integration for staking

---

**🎉 Congratulations! Your dApp is now running on Sepolia testnet!**
