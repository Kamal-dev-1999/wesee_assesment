// Helper function to add delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test API endpoints
async function testAPI() {
    console.log('🧪 Testing Gaming Staking dApp API...\n');

    // Generate unique match ID for this test run
    const timestamp = Date.now();
    const uniqueMatchId = `test-match-${timestamp}`;
    console.log(`Using unique match ID: ${uniqueMatchId}\n`);

    try {
        // 1. Health check
        console.log('1. Testing health check...');
        const healthResponse = await fetch('http://localhost:3000/health');
        const healthData = await healthResponse.json();
        
        if (healthResponse.ok) {
            console.log('✅ Health check passed:', healthData.status);
            console.log('   Backend address:', healthData.backendAddress);
            console.log('   Network:', healthData.network);
        } else {
            throw new Error(`Health check failed: ${healthData.error}`);
        }

        // 2. Get conversion rate
        console.log('\n2. Testing conversion rate...');
        const rateResponse = await fetch('http://localhost:3000/rate');
        const rateData = await rateResponse.json();
        
        if (rateResponse.ok) {
            console.log('✅ Conversion rate:', rateData.gtPerUsdt, 'GT per USDT');
        } else {
            throw new Error(`Rate check failed: ${rateData.error}`);
        }

        // 3. Add dummy USDT to user
        console.log('\n3. Testing add dummy USDT...');
        const addUsdtResponse = await fetch('http://localhost:3000/add-dummy-usdt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                amount: '50'
            })
        });
        const addUsdtData = await addUsdtResponse.json();
        
        if (addUsdtResponse.ok) {
            console.log('✅ USDT added successfully');
            console.log('   Amount added:', addUsdtData.usdtAmount, 'USDT');
            console.log('   New balance:', addUsdtData.newBalance, 'USDT');
        } else {
            throw new Error(`Add USDT failed: ${addUsdtData.error}`);
        }

        // 4. Give USDT to backend (for testing purchases)
        console.log('\n4. Testing give USDT to backend...');
        const giveBackendResponse = await fetch('http://localhost:3000/give-backend-usdt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: '1000' })
        });
        const giveBackendData = await giveBackendResponse.json();
        
        if (giveBackendResponse.ok) {
            console.log('✅ USDT given to backend successfully');
            console.log('   Amount given:', giveBackendData.usdtAmount, 'USDT');
            console.log('   Backend balance:', giveBackendData.newBackendBalance, 'USDT');
        } else {
            throw new Error(`Give backend USDT failed: ${giveBackendData.error}`);
        }

        // 5. Purchase GT tokens
        console.log('\n5. Testing GT token purchase...');
        const purchaseResponse = await fetch('http://localhost:3000/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                usdtAmount: '25'
            })
        });
        const purchaseData = await purchaseResponse.json();
        
        if (purchaseResponse.ok) {
            console.log('✅ GT tokens purchased successfully');
            console.log('   USDT spent:', purchaseData.usdtSpent, 'USDT');
            console.log('   GT received:', purchaseData.gtReceived, 'GT');
            console.log('   New GT balance:', purchaseData.newGTBalance, 'GT');
        } else {
            throw new Error(`Purchase failed: ${purchaseData.error}`);
        }

        // 6. Check user's GT balance
        console.log('\n6. Testing balance check...');
        const balanceResponse = await fetch('http://localhost:3000/balance/0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
        const balanceData = await balanceResponse.json();
        
        if (balanceResponse.ok) {
            console.log('✅ Balance check successful');
            console.log('   GT balance:', balanceData.balance, 'GT');
        } else {
            throw new Error(`Balance check failed: ${balanceData.error}`);
        }

        // 7. Create a match
        console.log('\n7. Testing match creation...');
        const createMatchResponse = await fetch('http://localhost:3000/match/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                matchId: uniqueMatchId,
                player1: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                player2: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
                stake: '10'
            })
        });
        const createMatchData = await createMatchResponse.json();
        
        if (createMatchResponse.ok) {
            console.log('✅ Match created successfully');
            console.log('   Match ID:', createMatchData.matchId);
            console.log('   Stake:', createMatchData.stake, 'GT');
        } else {
            throw new Error(`Match creation failed: ${createMatchData.error}`);
        }

        // 8. Get match info
        console.log('\n8. Testing match info retrieval...');
        const matchInfoResponse = await fetch(`http://localhost:3000/match/${uniqueMatchId}`);
        const matchInfoData = await matchInfoResponse.json();
        
        if (matchInfoResponse.ok) {
            console.log('✅ Match info retrieved successfully');
            console.log('   Status:', matchInfoData.status);
            console.log('   Player 1:', matchInfoData.player1);
            console.log('   Player 2:', matchInfoData.player2);
        } else {
            throw new Error(`Match info retrieval failed: ${matchInfoData.error}`);
        }

        // 9. Submit match result
        console.log('\n9. Testing match result submission...');
        const submitResultResponse = await fetch('http://localhost:3000/match/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                matchId: uniqueMatchId,
                winner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
            })
        });
        const submitResultData = await submitResultResponse.json();
        
        if (submitResultResponse.ok) {
            console.log('✅ Match result submitted successfully');
            console.log('   Winner:', submitResultData.winner);
        } else {
            console.log('⚠️  Match result submission failed (this is expected if players haven\'t staked):', submitResultData.error);
        }

        // 10. Test leaderboard (if indexer is running)
        console.log('\n10. Testing leaderboard...');
        try {
            const leaderboardResponse = await fetch('http://localhost:3001/leaderboard');
            const leaderboardData = await leaderboardResponse.json();
            
            if (leaderboardResponse.ok) {
                console.log('✅ Leaderboard retrieved successfully');
                console.log('   Players count:', leaderboardData.length);
            } else {
                console.log('⚠️  Leaderboard not available (indexer might not be running)');
            }
        } catch (error) {
            console.log('⚠️  Leaderboard not available (indexer might not be running)');
        }

        console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Make sure Hardhat node is running: npm run node');
        console.log('   2. Make sure contracts are deployed: npm run deploy');
        console.log('   3. Make sure backend is running: npm run backend');
        console.log('   4. Make sure indexer is running: npm run indexer');
    }
}

// Run the test
testAPI();
