import { BrowserProvider, Contract, formatUnits, parseEther } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";

const CONFIG = {
  chainIdHex: "0xaa36a7",
  gameTokenAddress: "0xDBa0940104b42E25e199cBfc98dF9a4cdC790237",
  gameTokenAbi: [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ],
  apiBase: "http://localhost:3000"
};

const $ = (q) => document.querySelector(q);
const connectBtn = $("#connectBtn");
const findBtn = $("#findBtn");
const stakeInput = $("#stakeInput");
const addrEl = $("#addr");
const gtEl = $("#gtBalance");
const boardEl = $("#board");
const matchmakeSection = $("#matchmake");
const stakingSection = $("#staking");
const gameSection = $("#game");
const midEl = $("#mid");
const meAsEl = $("#meAs");
const turnEl = $("#turn");
const logBox = $("#logBox");
const stakeMatchIdEl = $("#stakeMatchId");
const stakeAmountEl = $("#stakeAmount");
const stakeStatusEl = $("#stakeStatus");
const approveBtn = $("#approveBtn");
const stakeBtn = $("#stakeBtn");
const walletStatusEl = $("#walletStatus");
const walletInfoEl = $("#walletInfo");
const loadingOverlay = $("#loadingOverlay");
const clearLogBtn = $("#clearLog");
const refreshLeaderboardBtn = $("#refreshLeaderboard");
const leaderboardList = $("#leaderboardList");
const tabBtns = document.querySelectorAll(".tab-btn");

const totalGamesEl = $("#totalGames");
const totalStakedEl = $("#totalStaked");
const activePlayersEl = $("#activePlayers");
const avgStakeEl = $("#avgStake");

let provider = null;
let signer = null;
let myAddress = null;
let token = null;
let socket = null;
let currentMatchId = null;
let hashedMatchId = null;
let mySymbol = null;
let currentTurn = null;
let currentTab = "wins";

const WALLET_STORAGE_KEY = 'ticTacToe_wallet_connected';

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function showLoading() { show(loadingOverlay); }
function hideLoading() { hide(loadingOverlay); }

function setBoard(values) {
  Array.from(boardEl.querySelectorAll("button")).forEach((btn, i) => {
    const v = values[i];
    btn.textContent = v ? v : "";
    btn.classList.remove("x", "o");
    if (v === "X") btn.classList.add("x");
    if (v === "O") btn.classList.add("o");
  });
}

function log(msg) { 
  const t = new Date().toLocaleTimeString(); 
  logBox.value = `[${t}] ${msg}\n` + logBox.value; 
}

function showToast(message, type = "info") {
  const toastContainer = $("#toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

function updateWalletStatus(connected = false) {
  const statusEl = walletStatusEl.querySelector("span");
  const iconEl = walletStatusEl.querySelector("i");
  
  if (connected) {
    statusEl.textContent = "Connected";
    walletStatusEl.classList.add("connected");
    iconEl.className = "fas fa-wallet";
  } else {
    statusEl.textContent = "Not Connected";
    walletStatusEl.classList.remove("connected");
    iconEl.className = "fas fa-wallet";
  }
}

async function loadLeaderboard(tab = "wins") {
  try {
    leaderboardList.innerHTML = `
      <div class="loading-placeholder">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Loading leaderboard...</span>
      </div>
    `;

    const response = await fetch(`${CONFIG.apiBase}/leaderboard`);
    if (!response.ok) throw new Error('Failed to load leaderboard');
    
    const data = await response.json();
    
    if (!data.players || data.players.length === 0) {
      leaderboardList.innerHTML = `
        <div class="loading-placeholder">
          <i class="fas fa-info-circle"></i>
          <span>No players found</span>
        </div>
      `;
      return;
    }

    let sortedPlayers = [...data.players];
    switch (tab) {
      case "wins":
        sortedPlayers.sort((a, b) => (b.wins || 0) - (a.wins || 0));
        break;
      case "earnings":
        sortedPlayers.sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0));
        break;
      case "games":
        sortedPlayers.sort((a, b) => (b.totalGames || 0) - (a.totalGames || 0));
        break;
    }

    updateStats(data);

    leaderboardList.innerHTML = sortedPlayers.map((player, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      
      let displayValue = '';
      switch (tab) {
        case "wins":
          displayValue = `${player.wins || 0} wins`;
          break;
        case "earnings":
          displayValue = `${(player.totalEarnings || 0).toFixed(2)} GT`;
          break;
        case "games":
          displayValue = `${player.totalGames || 0} games`;
          break;
      }

      return `
        <div class="leaderboard-item ${rankClass}">
          <div class="rank-number">${rank}</div>
          <div class="player-info">
            <div class="player-name">${player.address ? player.address.slice(0, 6) + '...' + player.address.slice(-4) : 'Unknown'}</div>
            <div class="player-stats">${player.totalGames || 0} games • ${player.wins || 0} wins</div>
          </div>
          <div class="player-score">${displayValue}</div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Leaderboard error:', error);
    leaderboardList.innerHTML = `
      <div class="loading-placeholder">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Failed to load leaderboard</span>
      </div>
    `;
  }
}

function updateStats(data) {
  const totalGames = data.players?.reduce((sum, p) => sum + (p.totalGames || 0), 0) || 0;
  const totalStaked = data.players?.reduce((sum, p) => sum + (p.totalStaked || 0), 0) || 0;
  const activePlayers = data.players?.length || 0;
  const avgStake = activePlayers > 0 ? (totalStaked / totalGames).toFixed(1) : 0;

  totalGamesEl.textContent = totalGames.toLocaleString();
  totalStakedEl.textContent = totalStaked.toFixed(0);
  activePlayersEl.textContent = activePlayers;
  avgStakeEl.textContent = avgStake;
}

async function getHashedMatchId() {
  if (!currentMatchId) return;
  
  try {
    log("Getting hashed matchId from backend...");
    const response = await fetch(`${CONFIG.apiBase}/match/${currentMatchId}`);
    const matchData = await response.json();
    
    if (matchData.hashedMatchId) {
      hashedMatchId = matchData.hashedMatchId;
      log(`✅ Got hashed matchId: ${hashedMatchId}`);
    } else {
      // Fallback: hash the matchId ourselves
      const { ethers } = await import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js");
      hashedMatchId = ethers.id(currentMatchId);
      log(`✅ Generated hashed matchId: ${hashedMatchId}`);
    }
  } catch (error) {
    console.error('Error getting hashed matchId:', error);
    // Fallback: hash the matchId ourselves
    const { ethers } = await import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js");
    hashedMatchId = ethers.id(currentMatchId);
    log(`✅ Generated hashed matchId (fallback): ${hashedMatchId}`);
  }
}



async function connectWallet() {
  if (!window.ethereum) { 
    showToast("MetaMask is required to play", "error");
    return; 
  }
  
  try {
    showLoading();
    provider = new BrowserProvider(window.ethereum);
    const chain = await provider.send("eth_chainId", []);
    if (chain !== CONFIG.chainIdHex) { 
      await provider.send("wallet_switchEthereumChain", [{ chainId: CONFIG.chainIdHex }]); 
    }
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    myAddress = await signer.getAddress();
    
    addrEl.textContent = myAddress;
    token = new Contract(CONFIG.gameTokenAddress, CONFIG.gameTokenAbi, provider);
    const [bal, dec, sym] = await Promise.all([
      token.balanceOf(myAddress), 
      token.decimals(), 
      token.symbol()
    ]);
    gtEl.textContent = `${formatUnits(bal, dec)} ${sym}`;
    
    show(matchmakeSection);
    show(walletInfoEl);
    updateWalletStatus(true);
    
    localStorage.setItem(WALLET_STORAGE_KEY, 'true');
    log("Wallet connected");
    showToast("Wallet connected successfully!", "success");
    
  } catch (error) {
    console.error('Wallet connection error:', error);
    showToast("Failed to connect wallet", "error");
    log(`Wallet connection failed: ${error.message}`);
  } finally {
    hideLoading();
  }
}

async function autoReconnectWallet() {
  if (!window.ethereum) return;
  
  const wasConnected = localStorage.getItem(WALLET_STORAGE_KEY) === 'true';
  if (!wasConnected) return;
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      return;
    }
    
    provider = new BrowserProvider(window.ethereum);
    const chain = await provider.send("eth_chainId", []);
    if (chain !== CONFIG.chainIdHex) { 
      await provider.send("wallet_switchEthereumChain", [{ chainId: CONFIG.chainIdHex }]); 
    }
    signer = await provider.getSigner();
    myAddress = await signer.getAddress();
    addrEl.textContent = myAddress;
    token = new Contract(CONFIG.gameTokenAddress, CONFIG.gameTokenAbi, provider);
    const [bal, dec, sym] = await Promise.all([
      token.balanceOf(myAddress), 
      token.decimals(), 
      token.symbol()
    ]);
    gtEl.textContent = `${formatUnits(bal, dec)} ${sym}`;
    
    show(matchmakeSection);
    show(walletInfoEl);
    updateWalletStatus(true);
    log("Wallet auto-reconnected");
    
    if (!socket) connectSocket();
  } catch (error) {
    console.log('Auto-reconnect failed:', error);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }
}

function connectSocket() {
  socket = io();
  
  socket.on("connect", () => {
    log("Connected to server");
    showToast("Connected to game server", "success");
  });
  
  socket.on("hello", ({ socketId }) => log(`Socket ready: ${socketId}`));
  
  socket.on("queued", ({ stakeAmount }) => {
    log(`Queued at stake ${stakeAmount}. Waiting...`);
    showToast(`Queued for match with ${stakeAmount} GT stake`, "info");
  });
  
  socket.on("errorMsg", ({ message }) => {
    log(`Error: ${message}`);
    showToast(message, "error");
  });
  
  socket.on("matchFound", (evt) => {
    currentMatchId = evt.matchId;
    midEl.textContent = evt.matchId;
    mySymbol = evt.playerX.toLowerCase() === myAddress.toLowerCase() ? "X" : "O";
    meAsEl.textContent = mySymbol;
    
    stakeMatchIdEl.textContent = evt.matchId;
    stakeAmountEl.textContent = evt.stakeAmount;
    stakeStatusEl.textContent = "⏳ Creating match on blockchain... Please wait.";
    show(stakingSection);
    hide(gameSection);
    approveBtn.disabled = true;
    stakeBtn.disabled = true;
    
    log("Match found! Creating match on blockchain... Please wait.");
    showToast("Match found! Creating on blockchain...", "info");
  });
  
  socket.on("matchReady", (evt) => {
    log("✅ Match created on blockchain! Please approve GT tokens first.");
    showToast("Match created! Please approve tokens first.", "success");
    
    // The server has already confirmed the match is on blockchain
    // So we can enable the approve button immediately
    stakeStatusEl.textContent = "✅ Match confirmed on blockchain! Please approve GT tokens first.";
    approveBtn.disabled = false;
    stakeBtn.disabled = true;
    
    // Get the hashed matchId from the backend for staking
    getHashedMatchId();
  });
  
  socket.on("statusUpdate", (evt) => {
    // Only show status updates if they're not the repetitive polling messages
    if (!evt.message.includes("Waiting for players to stake")) {
      log(evt.message);
      showToast(evt.message, "info");
    } else {
      // For polling messages, just update the status without showing toast
      stakeStatusEl.textContent = evt.message;
    }
  });
  
  socket.on("gameStart", ({ next, board, stakeAmount }) => {
    currentTurn = next;
    turnEl.textContent = next ?? "—";
    setBoard(board);
    show(gameSection);
    hide(stakingSection);
    log(`Game start, stake ${stakeAmount}`);
    showToast("Game started! Good luck!", "success");
  });
  
  socket.on("gameState", ({ board, next }) => { 
    currentTurn = next; 
    setBoard(board); 
    turnEl.textContent = next ?? "—"; 
  });
  
  socket.on("gameOver", (evt) => {
    if (evt.result === "WIN") { 
      const me = evt.winnerAddress?.toLowerCase() === myAddress.toLowerCase(); 
      log(me ? "You won!" : "You lost");
      showToast(me ? "🎉 You won!" : "You lost", me ? "success" : "error");
    } else if (evt.result === "DRAW") { 
      log("It's a draw!");
      showToast("It's a draw!", "warning");
    } else if (evt.result === "FORFEIT") { 
      const me = evt.winnerAddress?.toLowerCase() === myAddress.toLowerCase(); 
      log(me ? "Opponent forfeited" : "You forfeited");
      showToast(me ? "Opponent forfeited" : "You forfeited", me ? "success" : "error");
    }
    
    setTimeout(() => loadLeaderboard(currentTab), 2000);
  });
}

async function handleApprove() {
  if (!signer || !currentMatchId) return;
  
  try {
    showLoading();
    approveBtn.disabled = true;
    stakeStatusEl.textContent = "Approving GT tokens...";
    log("Approving GT tokens for staking...");
    
    const playGameAddress = "0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C";
    
    const gameTokenContract = new Contract(CONFIG.gameTokenAddress, [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)"
    ], signer);
    
    const stakeAmount = Number(stakeAmountEl.textContent);
    const amount = parseEther(stakeAmount.toString());
    
    const tx = await gameTokenContract.approve(playGameAddress, amount);
    await tx.wait();
    
    stakeStatusEl.textContent = "Approved! You can now stake your tokens.";
    stakeBtn.disabled = false;
    log("GT tokens approved successfully! You can now stake.");
    showToast("Tokens approved successfully! You can now stake.", "success");
    
  } catch (error) {
    console.error('Approval error:', error);
    stakeStatusEl.textContent = "Approval failed!";
    approveBtn.disabled = false;
    log(`Approval failed: ${error.message}`);
    showToast("Approval failed: " + error.message, "error");
  } finally {
    hideLoading();
  }
}

async function handleStake() {
  if (!signer || !currentMatchId || !hashedMatchId) return;
  
  try {
    showLoading();
    stakeBtn.disabled = true;
    stakeStatusEl.textContent = "Staking GT tokens...";
    log("Staking GT tokens...");
    
    // Verify match exists and is ready for staking
    log("Verifying match status on blockchain...");
    const response = await fetch(`${CONFIG.apiBase}/match/summary/${currentMatchId}`);
    const matchStatus = await response.json();
    log(`Match status: ${matchStatus.status} (exists: ${matchStatus.exists})`);
    
    if (!matchStatus.exists) {
      throw new Error("Match not found on blockchain. Please wait for match confirmation.");
    }
    
    if (matchStatus.status !== 'PENDING') {
      throw new Error(`Match is not ready for staking. Current status: ${matchStatus.status}`);
    }
    
    log("✅ Match verified! Sending stake transaction...");
    log(`Using hashed matchId: ${hashedMatchId}`);
    
    const playGameAddress = "0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C";
    const playGameContract = new Contract(playGameAddress, [
      "function stake(bytes32 matchId) external"
    ], signer);
    
    const tx = await playGameContract.stake(hashedMatchId);
    log("✅ Stake transaction sent! Hash: " + tx.hash);
    
    log("⏳ Waiting for transaction confirmation...");
    await tx.wait();
    
    stakeStatusEl.textContent = "✅ Staked! Waiting for opponent...";
    log("✅ GT tokens staked successfully! Waiting for opponent to stake...");
    showToast("✅ Tokens staked! Waiting for opponent...", "success");
    
  } catch (error) {
    console.error('Staking error:', error);
    stakeBtn.disabled = false;
    
    let errorMessage = error.message;
    if (error.message.includes("Only match players can stake")) {
      errorMessage = "❌ Match not found on blockchain. Please wait for match confirmation.";
      showToast("❌ Please wait for match to be confirmed on blockchain", "warning");
      log("❌ Match not found on blockchain. Wait for confirmation.");
    } else if (error.message.includes("execution reverted")) {
      errorMessage = "❌ Transaction failed. Please check your balance and try again.";
      showToast("❌ Transaction failed. Please try again.", "error");
    } else if (error.message.includes("Match not found on blockchain")) {
      errorMessage = "❌ Match not found on blockchain. Please wait and try again.";
      showToast("❌ Match not found. Please wait and try again.", "warning");
    } else {
      showToast("❌ Staking failed: " + error.message, "error");
    }
    
    log(`❌ Staking failed: ${errorMessage}`);
  } finally {
    hideLoading();
  }
}

connectBtn.addEventListener('click', async () => { 
  await connectWallet(); 
  if (!socket) connectSocket(); 
});

findBtn.addEventListener('click', () => { 
  const stake = Number(stakeInput.value || 0); 
  if (!myAddress || !stake || stake <= 0) {
    showToast("Please enter a valid stake amount", "error");
    return;
  }
  socket.emit('findMatch', { address: myAddress, stakeAmount: String(stake) });
});

boardEl.addEventListener('click', e => { 
  const btn = e.target.closest('button'); 
  if (!btn) return; 
  const idx = Number(btn.dataset.i); 
  if (currentMatchId && mySymbol && currentTurn === mySymbol) { 
    socket.emit('makeMove', { matchId: currentMatchId, index: idx, address: myAddress });
  } else if (currentTurn !== mySymbol) {
    showToast("Not your turn!", "warning");
  }
});

approveBtn.addEventListener('click', handleApprove);
stakeBtn.addEventListener('click', handleStake);

clearLogBtn.addEventListener('click', () => {
  logBox.value = '';
  showToast("Log cleared", "info");
});

refreshLeaderboardBtn.addEventListener('click', () => {
  loadLeaderboard(currentTab);
  showToast("Leaderboard refreshed", "info");
});

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    loadLeaderboard(currentTab);
  });
});

hide(matchmakeSection); 
hide(stakingSection); 
hide(gameSection); 
setBoard(Array(9).fill(null));

document.addEventListener('DOMContentLoaded', () => {
  autoReconnectWallet();
  loadLeaderboard();
});

if (window.ethereum) {
  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      myAddress = null;
      signer = null;
      provider = null;
      token = null;
      addrEl.textContent = '';
      gtEl.textContent = '';
      hide(matchmakeSection);
      hide(gameSection);
      hide(walletInfoEl);
      updateWalletStatus(false);
      log("Wallet disconnected");
      showToast("Wallet disconnected", "warning");
    } else {
      if (localStorage.getItem(WALLET_STORAGE_KEY) === 'true') {
        await autoReconnectWallet();
      }
    }
  });
  
  window.ethereum.on('chainChanged', async () => {
    window.location.reload();
  });
}

