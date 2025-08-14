import { BrowserProvider, Contract, formatUnits, parseEther } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";

const CONFIG = {
  chainIdHex: "0xaa36a7",
  gameTokenAddress: "0xDBa0940104b42E25e199cBfc98dF9a4cdC790237",
  gameTokenAbi: [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ]
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

let provider = null;
let signer = null;
let myAddress = null;
let token = null;
let socket = null;
let currentMatchId = null;
let mySymbol = null;
let currentTurn = null;

// Check for existing wallet connection on page load
const WALLET_STORAGE_KEY = 'ticTacToe_wallet_connected';

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function setBoard(values){
  Array.from(boardEl.querySelectorAll("button")).forEach((btn, i) => {
    const v = values[i];
    btn.textContent = v ? v : "";
    btn.classList.remove("x","o");
    if (v === "X") btn.classList.add("x");
    if (v === "O") btn.classList.add("o");
  });
}
function log(msg){ const t=new Date().toLocaleTimeString(); logBox.value = `[${t}] ${msg}\n` + logBox.value; }

async function connectWallet(){
  if (!window.ethereum){ alert("MetaMask required"); return; }
  provider = new BrowserProvider(window.ethereum);
  const chain = await provider.send("eth_chainId",[]);
  if (chain !== CONFIG.chainIdHex){ await provider.send("wallet_switchEthereumChain",[{ chainId: CONFIG.chainIdHex }]); }
  await provider.send("eth_requestAccounts",[]);
  signer = await provider.getSigner();
  myAddress = await signer.getAddress();
  addrEl.textContent = myAddress;
  token = new Contract(CONFIG.gameTokenAddress, CONFIG.gameTokenAbi, provider);
  const [bal, dec, sym] = await Promise.all([ token.balanceOf(myAddress), token.decimals(), token.symbol() ]);
  gtEl.textContent = `${formatUnits(bal, dec)} ${sym}`;
  show(matchmakeSection);
  
  // Store connection state
  localStorage.setItem(WALLET_STORAGE_KEY, 'true');
  log("Wallet connected");
}

async function autoReconnectWallet() {
  if (!window.ethereum) return;
  
  const wasConnected = localStorage.getItem(WALLET_STORAGE_KEY) === 'true';
  if (!wasConnected) return;
  
  try {
    // Check if MetaMask is still connected
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      return;
    }
    
    // Auto-reconnect
    provider = new BrowserProvider(window.ethereum);
    const chain = await provider.send("eth_chainId",[]);
    if (chain !== CONFIG.chainIdHex){ 
      await provider.send("wallet_switchEthereumChain",[{ chainId: CONFIG.chainIdHex }]); 
    }
    signer = await provider.getSigner();
    myAddress = await signer.getAddress();
    addrEl.textContent = myAddress;
    token = new Contract(CONFIG.gameTokenAddress, CONFIG.gameTokenAbi, provider);
    const [bal, dec, sym] = await Promise.all([ token.balanceOf(myAddress), token.decimals(), token.symbol() ]);
    gtEl.textContent = `${formatUnits(bal, dec)} ${sym}`;
    show(matchmakeSection);
    log("Wallet auto-reconnected");
    
    // Auto-connect socket if wallet is connected
    if (!socket) connectSocket();
  } catch (error) {
    console.log('Auto-reconnect failed:', error);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }
}

function connectSocket(){
  socket = io();
  socket.on("connect", () => log("Connected to server"));
  socket.on("hello", ({ socketId }) => log(`Socket ready: ${socketId}`));
  socket.on("queued", ({ stakeAmount }) => log(`Queued at stake ${stakeAmount}. Waiting...`));
  socket.on("errorMsg", ({ message }) => log(`Error: ${message}`));
  socket.on("matchFound", (evt) => {
     currentMatchId = evt.matchId;
     midEl.textContent = evt.matchId;
     mySymbol = evt.playerX.toLowerCase() === myAddress.toLowerCase() ? "X" : "O";
     meAsEl.textContent = mySymbol;
     
     // Show staking section
     stakeMatchIdEl.textContent = evt.matchId;
     stakeAmountEl.textContent = evt.stakeAmount;
     stakeStatusEl.textContent = "Match created! Ready to stake.";
     show(stakingSection);
     hide(gameSection);
     approveBtn.disabled = false; // Enable approve button
     log("Match found! Ready to approve and stake your GT tokens.");
   });
   
   socket.on("statusUpdate", (evt) => {
     log(evt.message);
   });
  socket.on("gameStart", ({ next, board, stakeAmount }) => {
    currentTurn = next;
    turnEl.textContent = next ?? "—";
    setBoard(board);
    show(gameSection);
    hide(stakingSection); // Hide staking section when game starts
    log(`Game start, stake ${stakeAmount}`);
  });
  socket.on("gameState", ({ board, next }) => { currentTurn = next; setBoard(board); turnEl.textContent = next ?? "—"; });
  socket.on("gameOver", (evt) => {
    if (evt.result === "WIN"){ const me = evt.winnerAddress?.toLowerCase() === myAddress.toLowerCase(); log(me?"You won":"You lost"); }
    else if (evt.result === "DRAW"){ log("Draw"); }
    else if (evt.result === "FORFEIT"){ const me = evt.winnerAddress?.toLowerCase() === myAddress.toLowerCase(); log(me?"Opponent forfeited":"Forfeited"); }
  });
}

connectBtn.addEventListener('click', async ()=>{ await connectWallet(); if(!socket) connectSocket(); })
findBtn.addEventListener('click', ()=>{ const stake = Number(stakeInput.value || 0); if(!myAddress||!stake||stake<=0) return; socket.emit('findMatch',{ address: myAddress, stakeAmount: String(stake) }) })
boardEl.addEventListener('click', e=>{ const btn=e.target.closest('button'); if(!btn) return; const idx=Number(btn.dataset.i); if(currentMatchId&&mySymbol&&currentTurn===mySymbol){ socket.emit('makeMove',{ matchId: currentMatchId, index: idx, address: myAddress }) } })

// Staking functionality
async function handleApprove() {
  if (!signer || !currentMatchId) return;
  
  try {
    approveBtn.disabled = true;
    stakeStatusEl.textContent = "Approving GT tokens...";
    log("Approving GT tokens for staking...");
    
    // Get the PlayGame contract address from the backend
    const playGameAddress = "0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C"; // Sepolia address
    
    const gameTokenContract = new Contract(CONFIG.gameTokenAddress, [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)"
    ], signer);
    
    const stakeAmount = Number(stakeAmountEl.textContent);
    const amount = parseEther(stakeAmount.toString());
    
    const tx = await gameTokenContract.approve(playGameAddress, amount);
    await tx.wait();
    
    stakeStatusEl.textContent = "Approved! Ready to stake.";
    stakeBtn.disabled = false;
    log("GT tokens approved successfully!");
    
  } catch (error) {
    console.error('Approval error:', error);
    stakeStatusEl.textContent = "Approval failed!";
    approveBtn.disabled = false;
    log(`Approval failed: ${error.message}`);
  }
}

async function handleStake() {
  if (!signer || !currentMatchId) return;
  
  try {
    stakeBtn.disabled = true;
    stakeStatusEl.textContent = "Staking GT tokens...";
    log("Staking GT tokens...");
    
    const playGameAddress = "0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C"; // Sepolia address
    const playGameContract = new Contract(playGameAddress, [
      "function stake(bytes32 matchId) external"
    ], signer);
    
    const tx = await playGameContract.stake(currentMatchId);
    await tx.wait();
    
    stakeStatusEl.textContent = "Staked! Waiting for opponent...";
    log("GT tokens staked successfully! Waiting for opponent to stake...");
    
  } catch (error) {
    console.error('Staking error:', error);
    stakeStatusEl.textContent = "Staking failed!";
    stakeBtn.disabled = false;
    log(`Staking failed: ${error.message}`);
  }
}

approveBtn.addEventListener('click', handleApprove);
stakeBtn.addEventListener('click', handleStake);

hide(matchmakeSection); hide(stakingSection); hide(gameSection); setBoard(Array(9).fill(null));

// Auto-reconnect wallet on page load
document.addEventListener('DOMContentLoaded', autoReconnectWallet);

// Handle MetaMask account changes
if (window.ethereum) {
  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected
      localStorage.removeItem(WALLET_STORAGE_KEY);
      myAddress = null;
      signer = null;
      provider = null;
      token = null;
      addrEl.textContent = '';
      gtEl.textContent = '';
      hide(matchmakeSection);
      hide(gameSection);
      log("Wallet disconnected");
    } else {
      // User switched accounts
      if (localStorage.getItem(WALLET_STORAGE_KEY) === 'true') {
        await autoReconnectWallet();
      }
    }
  });
  
  window.ethereum.on('chainChanged', async () => {
    // Refresh page when chain changes
    window.location.reload();
  });
}

