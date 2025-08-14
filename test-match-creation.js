import axios from 'axios';

const API_BASE = 'http://localhost:3000';
const API_KEY = 'dev';

async function testMatchCreation() {
    try {
        console.log('🧪 Testing match creation process...\n');
        
        // Test 1: Check backend health
        console.log('1. Checking backend health...');
        const healthResponse = await axios.get(`${API_BASE}/health`);
        console.log('✅ Backend is healthy:', healthResponse.data.status);
        
        // Test 2: Create a test match
        console.log('\n2. Creating test match...');
        const testMatchId = `test-${Date.now()}`;
        const testData = {
            matchId: testMatchId,
            player1: '0x4d5099A625C13caEE0Ec5414e702B5Bf30a09AC3',
            player2: '0x8495E0540b571925aED87E1ca2F936fF1573Af43',
            stake: '1'
        };
        
        console.log('📝 Test match data:', testData);
        
        try {
            const createResponse = await axios.post(`${API_BASE}/match/start`, testData, {
                headers: { 'X-API-KEY': API_KEY }
            });
            console.log('✅ Match creation response:', createResponse.data);
        } catch (createError) {
            console.log('❌ Match creation failed:', createError.response?.data || createError.message);
            return;
        }
        
        // Test 3: Check match status
        console.log('\n3. Checking match status...');
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`   Attempt ${attempts}/${maxAttempts}...`);
            
            try {
                const statusResponse = await axios.get(`${API_BASE}/match/summary/${testMatchId}`);
                const status = statusResponse.data;
                console.log('   📊 Match status:', status);
                
                if (status.exists && status.status === 'PENDING') {
                    console.log('✅ Match is PENDING - ready for staking!');
                    break;
                } else if (status.exists && status.status === 'STAKED') {
                    console.log('✅ Match is already STAKED!');
                    break;
                } else {
                    console.log('   ⏳ Waiting for match to be ready...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (statusError) {
                console.log('   ❌ Error checking status:', statusError.response?.data || statusError.message);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        console.log('\n🎯 Test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMatchCreation();
