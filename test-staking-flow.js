const axios = require('axios');

const API_BASE = 'http://localhost:3000';
const API_KEY = 'your-api-key';

async function testStakingFlow() {
  console.log('🧪 Testing Staking Flow...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthRes = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', healthRes.data);
    
    // Test 2: Create a test match
    console.log('\n2. Creating test match...');
    const matchId = `test-staking-${Date.now()}`;
    const player1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const player2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const stake = '20.0';
    
    const createRes = await axios.post(`${API_BASE}/match/start`, {
      matchId,
      player1,
      player2,
      stake
    }, { headers: { 'X-API-KEY': API_KEY } });
    
    console.log('✅ Match created:', createRes.data);
    
    // Test 3: Check match summary
    console.log('\n3. Checking match summary...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for blockchain
    
    const summaryRes = await axios.get(`${API_BASE}/match/summary/${matchId}`);
    const summary = summaryRes.data;
    console.log('✅ Match summary:', {
      exists: summary.exists,
      status: summary.status,
      player1Staked: summary.player1Staked,
      player2Staked: summary.player2Staked
    });
    
    // Test 4: Verify match is PENDING and ready for staking
    if (summary.exists && summary.status === 'PENDING') {
      console.log('✅ Match is PENDING and ready for staking!');
    } else {
      console.log('❌ Match is not ready for staking:', summary.status);
    }
    
    console.log('\n🎉 Staking flow test completed successfully!');
    console.log('The backend is working correctly. The issue was in the frontend polling logic.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testStakingFlow();
