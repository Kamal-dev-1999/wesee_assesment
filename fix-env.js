const fs = require('fs');

// Hardhat default private keys (Account #0 and #1)
const PRIVATE_KEYS = {
  account0: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  account1: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
};

function fixEnvFile() {
  try {
    // Read current .env file
    let envContent = '';
    if (fs.existsSync('.env')) {
      envContent = fs.readFileSync('.env', 'utf8');
    }

    // Replace undefined private key with actual private key
    if (envContent.includes('BACKEND_PRIVATE_KEY=undefined')) {
      envContent = envContent.replace(
        'BACKEND_PRIVATE_KEY=undefined',
        `BACKEND_PRIVATE_KEY=${PRIVATE_KEYS.account0}`
      );
      
      fs.writeFileSync('.env', envContent);
      console.log('✅ Fixed .env file!');
      console.log(`📝 Set BACKEND_PRIVATE_KEY to Account #0: ${PRIVATE_KEYS.account0}`);
      console.log(`📍 Account address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`);
    } else if (envContent.includes('BACKEND_PRIVATE_KEY=')) {
      console.log('✅ .env file already has a private key set');
    } else {
      console.log('❌ No BACKEND_PRIVATE_KEY found in .env file');
      console.log('Please run npm run deploy first');
    }

    console.log('\n🔑 Available private keys:');
    console.log(`Account #0: ${PRIVATE_KEYS.account0}`);
    console.log(`Account #1: ${PRIVATE_KEYS.account1}`);

  } catch (error) {
    console.error('❌ Error fixing .env file:', error.message);
  }
}

fixEnvFile();
