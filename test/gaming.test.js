const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gaming Staking dApp", function () {
  let mockUSDT, gameToken, tokenStore, playGame;
  let owner, player1, player2, backend;
  let mockUSDTAddress, gameTokenAddress, tokenStoreAddress, playGameAddress;

  beforeEach(async function () {
    // Get signers
    [owner, player1, player2, backend] = await ethers.getSigners();

    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.deployed();
    mockUSDTAddress = mockUSDT.address;

    // Deploy GameToken
    const GameToken = await ethers.getContractFactory("GameToken");
    gameToken = await GameToken.deploy();
    await gameToken.deployed();
    gameTokenAddress = gameToken.address;

    // Deploy TokenStore
    const gtPerUsdt = ethers.utils.parseEther("1"); // 1 USDT = 1 GT
    const TokenStore = await ethers.getContractFactory("TokenStore");
    tokenStore = await TokenStore.deploy(
      mockUSDTAddress,
      gameTokenAddress,
      gtPerUsdt
    );
    await tokenStore.deployed();
    tokenStoreAddress = tokenStore.address;

    // Deploy PlayGame
    const PlayGame = await ethers.getContractFactory("PlayGame");
    playGame = await PlayGame.deploy(gameTokenAddress);
    await playGame.deployed();
    playGameAddress = playGame.address;

    // Set up permissions
    await gameToken.setTokenStoreContract(tokenStoreAddress);
  });

  describe("MockUSDT", function () {
    it("Should have correct decimals", async function () {
      expect(await mockUSDT.decimals()).to.equal(6);
    });

    it("Should mint initial supply to owner", async function () {
      const balance = await mockUSDT.balanceOf(owner.address);
      expect(balance).to.equal(ethers.utils.parseUnits("1000000", 6));
    });
  });

  describe("GameToken", function () {
    it("Should have correct name and symbol", async function () {
      expect(await gameToken.name()).to.equal("GameToken");
      expect(await gameToken.symbol()).to.equal("GT");
    });

    it("Should have 18 decimals", async function () {
      expect(await gameToken.decimals()).to.equal(18);
    });

    it("Should only allow TokenStore to mint", async function () {
      const amount = ethers.utils.parseEther("100");
      
      // Should fail if called by non-TokenStore
      await expect(
        gameToken.connect(player1).mint(player1.address, amount)
      ).to.be.revertedWith("Only TokenStore can mint");

      // Should succeed if called by TokenStore
      await expect(
        tokenStore.connect(player1).buy(ethers.utils.parseUnits("100", 6))
      ).to.not.be.reverted;
    });
  });

  describe("TokenStore", function () {
    it("Should have correct conversion rate", async function () {
      const rate = await tokenStore.gtPerUsdt();
      expect(rate).to.equal(ethers.utils.parseEther("1"));
    });

    it("Should allow token purchase", async function () {
      const usdtAmount = ethers.utils.parseUnits("100", 6);
      const expectedGT = ethers.utils.parseEther("100");

      // Transfer USDT to player1
      await mockUSDT.transfer(player1.address, usdtAmount);

      // Approve TokenStore to spend USDT
      await mockUSDT.connect(player1).approve(tokenStoreAddress, usdtAmount);

      // Purchase GT tokens
      await tokenStore.connect(player1).buy(usdtAmount);

      // Check GT balance
      const gtBalance = await gameToken.balanceOf(player1.address);
      expect(gtBalance).to.equal(expectedGT);
    });

    it("Should emit Purchase event", async function () {
      const usdtAmount = ethers.utils.parseUnits("50", 6);
      
      await mockUSDT.transfer(player1.address, usdtAmount);
      await mockUSDT.connect(player1).approve(tokenStoreAddress, usdtAmount);

      await expect(tokenStore.connect(player1).buy(usdtAmount))
        .to.emit(tokenStore, "Purchase")
        .withArgs(player1.address, usdtAmount, ethers.utils.parseEther("50"));
    });
  });

  describe("PlayGame", function () {
    it("Should allow owner to create match", async function () {
      const matchId = ethers.utils.id("test-match-1");
      const stake = ethers.utils.parseEther("10");

      await expect(
        playGame.createMatch(matchId, player1.address, player2.address, stake)
      ).to.emit(playGame, "MatchCreated")
        .withArgs(matchId, player1.address, player2.address, stake);
    });

    it("Should not allow non-owner to create match", async function () {
      const matchId = ethers.utils.id("test-match-2");
      const stake = ethers.utils.parseEther("10");

      await expect(
        playGame.connect(player1).createMatch(matchId, player1.address, player2.address, stake)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow players to stake", async function () {
      const matchId = ethers.utils.id("test-match-3");
      const stake = ethers.utils.parseEther("10");

      // Create match
      await playGame.createMatch(matchId, player1.address, player2.address, stake);

      // Give players some GT tokens
      await gameToken.mint(player1.address, stake);
      await gameToken.mint(player2.address, stake);

      // Approve PlayGame to spend GT
      await gameToken.connect(player1).approve(playGameAddress, stake);
      await gameToken.connect(player2).approve(playGameAddress, stake);

      // Stake tokens
      await expect(playGame.connect(player1).stake(matchId))
        .to.emit(playGame, "Staked")
        .withArgs(matchId, player1.address, stake);

      await expect(playGame.connect(player2).stake(matchId))
        .to.emit(playGame, "Staked")
        .withArgs(matchId, player2.address, stake);
    });

    it("Should allow owner to commit result", async function () {
      const matchId = ethers.utils.id("test-match-4");
      const stake = ethers.utils.parseEther("10");

      // Create and stake match
      await playGame.createMatch(matchId, player1.address, player2.address, stake);
      await gameToken.mint(player1.address, stake);
      await gameToken.mint(player2.address, stake);
      await gameToken.connect(player1).approve(playGameAddress, stake);
      await gameToken.connect(player2).approve(playGameAddress, stake);
      await playGame.connect(player1).stake(matchId);
      await playGame.connect(player2).stake(matchId);

      // Commit result
      await expect(playGame.commitResult(matchId, player1.address))
        .to.emit(playGame, "Settled")
        .withArgs(matchId, player1.address, stake.mul(2));
    });
  });

  describe("Integration", function () {
    it("Should complete full game flow", async function () {
      const matchId = ethers.utils.id("integration-test");
      const stake = ethers.utils.parseEther("5");

      // 1. Players buy GT tokens
      const usdtAmount = ethers.utils.parseUnits("10", 6);
      await mockUSDT.transfer(player1.address, usdtAmount);
      await mockUSDT.transfer(player2.address, usdtAmount);
      await mockUSDT.connect(player1).approve(tokenStoreAddress, usdtAmount);
      await mockUSDT.connect(player2).approve(tokenStoreAddress, usdtAmount);
      await tokenStore.connect(player1).buy(usdtAmount);
      await tokenStore.connect(player2).buy(usdtAmount);

      // 2. Create match
      await playGame.createMatch(matchId, player1.address, player2.address, stake);

      // 3. Players stake
      await gameToken.connect(player1).approve(playGameAddress, stake);
      await gameToken.connect(player2).approve(playGameAddress, stake);
      await playGame.connect(player1).stake(matchId);
      await playGame.connect(player2).stake(matchId);

      // 4. Commit result
      await playGame.commitResult(matchId, player1.address);

      // 5. Verify winner received prize
      const winnerBalance = await gameToken.balanceOf(player1.address);
      expect(winnerBalance).to.equal(ethers.utils.parseEther("15")); // 10 (purchased) + 5 (prize)
    });
  });
});
