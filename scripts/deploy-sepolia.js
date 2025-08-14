const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying contracts to Sepolia testnet...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Gas/fee overrides for Sepolia
  const priorityFeeGwei = process.env.SEPOLIA_PRIORITY_FEE_GWEI || "2"; // gwei
  const maxFeeGwei = process.env.SEPOLIA_MAX_FEE_GWEI || "40"; // gwei
  const overrides = {
    maxPriorityFeePerGas: ethers.parseUnits(priorityFeeGwei, "gwei"),
    maxFeePerGas: ethers.parseUnits(maxFeeGwei, "gwei"),
    gasLimit: 5_000_000n
  };
  console.log(`⛽ Using fees: priority=${priorityFeeGwei} gwei, maxFee=${maxFeeGwei} gwei, gasLimit=${overrides.gasLimit}`);

  // Resolve USDT address for Sepolia (from .env or fallback)
  let usdtAddress = process.env.MOCK_USDT_ADDRESS || "0x7169D38820dfd117C3FA1fDf4b2d1a6f6Ba9aa8B";
  console.log("💵 Initial USDT address candidate:", usdtAddress);

  // If the candidate address has no code on Sepolia, deploy MockUSDT
  try {
    const code = await deployer.provider.getCode(usdtAddress);
    if (!code || code === "0x") {
      console.log("⚠️  No contract code at provided USDT address. Deploying MockUSDT to Sepolia...");
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const mockUSDT = await MockUSDT.deploy({ ...overrides });
      console.log("MockUSDT tx:", mockUSDT.deploymentTransaction()?.hash);
      await mockUSDT.waitForDeployment();
      usdtAddress = await mockUSDT.getAddress();
      console.log("✅ MockUSDT deployed to:", usdtAddress);
    } else {
      console.log("✅ Detected contract code at USDT address");
    }
  } catch (err) {
    console.log("⚠️  Could not verify USDT address code, proceeding with candidate:", usdtAddress, "-", err?.message || err);
  }

  // Initial GT per USDT rate (1 USDT -> 1 GT with 18 decimals)
  const gtPerUsdt = ethers.parseEther("1"); // 1e18

  // Deploy GameToken first
  console.log("\n🔸 Deploying GameToken...");
  const GameToken = await ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy({ ...overrides });
  console.log("GameToken tx:", gameToken.deploymentTransaction()?.hash);
  await gameToken.waitForDeployment();
  const gameTokenAddress = await gameToken.getAddress();
  console.log("✅ GameToken deployed to:", gameTokenAddress);

  // Deploy TokenStore with (USDT, GameToken, gtPerUsdt)
  console.log("\n🔸 Deploying TokenStore...");
  const TokenStore = await ethers.getContractFactory("TokenStore");
  const tokenStore = await TokenStore.deploy(usdtAddress, gameTokenAddress, gtPerUsdt, { ...overrides });
  console.log("TokenStore tx:", tokenStore.deploymentTransaction()?.hash);
  await tokenStore.waitForDeployment();
  const tokenStoreAddress = await tokenStore.getAddress();
  console.log("✅ TokenStore deployed to:", tokenStoreAddress);

  // Configure GameToken to allow TokenStore to mint
  console.log("\n🔧 Configuring GameToken -> setTokenStoreContract...");
  const txSetMinter = await gameToken.setTokenStoreContract(tokenStoreAddress, { ...overrides });
  console.log("setTokenStoreContract tx:", txSetMinter.hash);
  await txSetMinter.wait(1);
  console.log("✅ TokenStore set as authorized minter on GameToken");

  // Deploy PlayGame with (GameToken)
  console.log("\n🔸 Deploying PlayGame...");
  const PlayGame = await ethers.getContractFactory("PlayGame");
  const playGame = await PlayGame.deploy(gameTokenAddress, { ...overrides });
  console.log("PlayGame tx:", playGame.deploymentTransaction()?.hash);
  await playGame.waitForDeployment();
  const playGameAddress = await playGame.getAddress();
  console.log("✅ PlayGame deployed to:", playGameAddress);

  // Transfer ownership of PlayGame to deployer (already owner by default, but explicit)
  console.log("\n🔧 Ensuring PlayGame ownership is deployer...");
  const currentOwner = await playGame.owner();
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    const txOwn = await playGame.transferOwnership(deployer.address, { ...overrides });
    console.log("transferOwnership tx:", txOwn.hash);
    await txOwn.wait(1);
    console.log("✅ Transferred PlayGame ownership to deployer");
  } else {
    console.log("✅ Deployer is already owner of PlayGame");
  }

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("USDT:", usdtAddress);
  console.log("GameToken:", gameTokenAddress);
  console.log("TokenStore:", tokenStoreAddress);
  console.log("PlayGame:", playGameAddress);
  
  console.log("\n🔑 Update your .env file with these addresses:");
  console.log(`MOCK_USDT_ADDRESS=${usdtAddress}`);
  console.log(`GAME_TOKEN_ADDRESS=${gameTokenAddress}`);
  console.log(`TOKEN_STORE_ADDRESS=${tokenStoreAddress}`);
  console.log(`PLAY_GAME_ADDRESS=${playGameAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
