const axios = require('axios');

const API_BASE = 'http://localhost:3000';
const API_KEY = 'dev';

async function testMatchConfirmation() {
  console.log('🧪 Testing Match Confirmation Flow...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthRes = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', healthRes.data);
    
    // Test 2: Create a test match
    console.log('\n2. Creating test match...');
    const matchId = `test-confirmation-${Date.now()}`;
    const player1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const player2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const stake = '1.0';
    
    const createRes = await axios.post(`${API_BASE}/match/start`, {
      matchId,
      player1,
      player2,
      stake
    }, { headers: { 'X-API-KEY': API_KEY } });
    
    console.log('✅ Match creation initiated:', createRes.data);
    
    // Test 3: Poll for confirmation
    console.log('\n3. Polling for match confirmation...');
    let confirmed = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!confirmed && attempts < maxAttempts) {
      attempts++;
      console.log(`   Attempt ${attempts}/${maxAttempts}...`);
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      try {
        const summaryRes = await axios.get(`${API_BASE}/match/summary/${matchId}`);
        const summary = summaryRes.data;
        
        console.log(`   Status: exists=${summary.exists}, status=${summary.status}`);
        
        if (summary.exists && summary.status === 'PENDING') {
          confirmed = true;
          console.log('✅ Match confirmed on blockchain!');
        }
      } catch (error) {
        console.log(`   Error polling: ${error.message}`);
      }
    }
    
    if (confirmed) {
      console.log('\n🎉 Match confirmation test PASSED!');
      console.log('The backend is correctly creating and confirming matches on the blockchain.');
    } else {
      console.log('\n❌ Match confirmation test FAILED!');
      console.log('The match was not confirmed within the expected time.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testMatchConfirmation();
