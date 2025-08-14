import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState('0');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Match form state
  const [matchForm, setMatchForm] = useState({
    matchId: '',
    player1: '',
    player2: '',
    stake: ''
  });

  // Result form state
  const [resultForm, setResultForm] = useState({
    matchId: '',
    winner: ''
  });

  // Token purchase form state
  const [purchaseForm, setPurchaseForm] = useState({
    usdtAmount: ''
  });

  // Add USDT form state
  const [addUsdtForm, setAddUsdtForm] = useState({
    amount: '100'
  });

  // NEW: Give backend USDT form state
  const [backendUsdtForm, setBackendUsdtForm] = useState({
    amount: '1000'
  });

  // NEW: Stake form state
  const [stakeForm, setStakeForm] = useState({
    matchId: '',
    player: ''
  });

  // NEW: Match summary state
  const [summaryMatchId, setSummaryMatchId] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  // NEW: dry run toggle for result submission
  const [dryRun, setDryRun] = useState(false);

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        setAccount(accounts[0]);
        setProvider(provider);
        setSigner(signer);
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
          setAccount(accounts[0] || '');
        });
        
        setMessage('Wallet connected successfully!');
      } else {
        setMessage('Please install MetaMask!');
      }
    } catch (error) {
      setMessage('Error connecting wallet: ' + error.message);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount('');
    setProvider(null);
    setSigner(null);
    setBalance('0');
    setMessage('Wallet disconnected');
  };

  // Get GT balance
  const getBalance = async () => {
    if (!account) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/balance/${account}`);
      setBalance(response.data.balance);
      setMessage(`Balance: ${response.data.balance} GT`);
    } catch (error) {
      setMessage('Error getting balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get conversion rate
  const getRate = async () => {
    try {
      const response = await axios.get('/rate');
      setMessage(`1 USDT = ${response.data.gtPerUsdt} GT`);
    } catch (error) {
      setMessage('Error getting rate: ' + error.message);
    }
  };

  // Add dummy USDT to wallet
  const addDummyUsdt = async (e) => {
    e.preventDefault();
    if (!account) {
      setMessage('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.post('/add-dummy-usdt', {
        address: account,
        amount: addUsdtForm.amount
      });
      setMessage(`USDT added: ${response.data.message}`);
      setAddUsdtForm({ amount: '100' });
    } catch (error) {
      setMessage('Error adding USDT: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // NEW: Give backend USDT
  const giveBackendUsdt = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/give-backend-usdt', {
        amount: backendUsdtForm.amount
      });
      setMessage(`Backend USDT: ${response.data.message} (New backend balance: ${response.data.newBackendBalance} USDT)`);
    } catch (error) {
      setMessage('Error giving backend USDT: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Purchase GT tokens with USDT
  const purchaseGtTokens = async (e) => {
    e.preventDefault();
    if (!account) {
      setMessage('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.post('/purchase', {
        address: account,
        usdtAmount: purchaseForm.usdtAmount
      });
      setMessage(`Purchase successful: ${response.data.message}`);
      setPurchaseForm({ usdtAmount: '' });
      // Refresh balance after purchase
      await getBalance();
    } catch (error) {
      setMessage('Error purchasing GT: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Start a match
  const startMatch = async (e) => {
    e.preventDefault();
    if (!account) {
      setMessage('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.post('/match/start', matchForm);
      setMessage(`Match started: ${response.data.message}`);
      setMatchForm({ matchId: '', player1: '', player2: '', stake: '' });
    } catch (error) {
      setMessage('Error starting match: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // NEW: Stake into a match (Hardhat testing)
  const stakeMatch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/match/stake', stakeForm);
      const { matchStatus, player1Staked, player2Staked } = response.data;
      setMessage(`Stake successful. Status: ${matchStatus}. P1: ${player1Staked}, P2: ${player2Staked}`);
    } catch (error) {
      setMessage('Error staking: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // NEW: Get match summary
  const getMatchSummary = async (e) => {
    e.preventDefault();
    if (!summaryMatchId) {
      setMessage('Enter match ID');
      return;
    }
    try {
      setLoading(true);
      const response = await axios.get(`/match/summary/${summaryMatchId}`);
      setSummaryData(response.data);
      setMessage('Fetched match summary');
    } catch (error) {
      setSummaryData(null);
      setMessage('Error getting summary: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Submit match result
  const submitResult = async (e) => {
    e.preventDefault();
    if (!account) {
      setMessage('Please connect your wallet first');
      return;
    }
    
    try {
      setLoading(true);
      const payload = { ...resultForm };
      if (dryRun) payload.dryRun = true;
      const response = await axios.post('/match/result', payload);
      if (response.data?.preflight && dryRun) {
        setMessage(`Preflight: ${response.data.preflight.decision} - ${response.data.preflight.reason}`);
      } else {
        setMessage(`Result submitted: ${response.data.message}`);
      }
      setResultForm({ matchId: '', winner: '' });
    } catch (error) {
      setMessage('Error submitting result: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Get leaderboard
  const getLeaderboard = async () => {
    try {
      const response = await axios.get('http://localhost:3001/leaderboard');
      setLeaderboard(response.data.leaderboard || response.data || []);
    } catch (error) {
      setMessage('Error getting leaderboard: ' + error.message);
    }
  };

  // Update form inputs
  const handleMatchFormChange = (e) => {
    setMatchForm({
      ...matchForm,
      [e.target.name]: e.target.value
    });
  };

  const handleResultFormChange = (e) => {
    setResultForm({
      ...resultForm,
      [e.target.name]: e.target.value
    });
  };

  const handlePurchaseFormChange = (e) => {
    setPurchaseForm({
      ...purchaseForm,
      [e.target.name]: e.target.value
    });
  };

  const handleAddUsdtFormChange = (e) => {
    setAddUsdtForm({
      ...addUsdtForm,
      [e.target.name]: e.target.value
    });
  };

  // NEW handlers
  const handleBackendUsdtFormChange = (e) => {
    setBackendUsdtForm({
      ...backendUsdtForm,
      [e.target.name]: e.target.value
    });
  };

  const handleStakeFormChange = (e) => {
    setStakeForm({
      ...stakeForm,
      [e.target.name]: e.target.value
    });
  };

  const handleSummaryIdChange = (e) => {
    setSummaryMatchId(e.target.value);
  };

  const handleDryRunChange = (e) => {
    setDryRun(e.target.checked);
  };

  // Auto-fill player addresses
  useEffect(() => {
    if (account) {
      setMatchForm(prev => ({
        ...prev,
        player1: account
      }));
      setStakeForm(prev => ({
        ...prev,
        player: account
      }));
    }
  }, [account]);

  // Load leaderboard on mount
  useEffect(() => {
    getLeaderboard();
    const interval = setInterval(getLeaderboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎮 Gaming Staking dApp</h1>
        <p>Decentralized PvP Gaming with Token Staking</p>
      </header>

      <main className="App-main">
        {/* Wallet Connection */}
        <section className="section">
          <h2>🔗 Wallet Connection</h2>
          {!account ? (
            <button onClick={connectWallet} className="btn btn-primary">
              Connect MetaMask
            </button>
          ) : (
            <div>
              <p><strong>Connected:</strong> {account}</p>
              <button onClick={disconnectWallet} className="btn btn-secondary">
                Disconnect
              </button>
            </div>
          )}
        </section>

        {/* Token Management */}
        {account && (
          <>
            <section className="section">
              <h2>💰 Token Management</h2>
              <div className="grid-2">
                <div>
                  <p><strong>GT Balance:</strong> {balance}</p>
                  <button onClick={getBalance} disabled={loading} className="btn">
                    Refresh Balance
                  </button>
                </div>
                <div>
                  <button onClick={getRate} disabled={loading} className="btn">
                    Get Conversion Rate
                  </button>
                </div>
              </div>
            </section>

            {/* Add Dummy USDT */}
            <section className="section">
              <h2>💵 Add Dummy USDT</h2>
              <form onSubmit={addDummyUsdt}>
                <div className="form-row">
                  <input
                    type="number"
                    name="amount"
                    placeholder="USDT Amount"
                    value={addUsdtForm.amount}
                    onChange={handleAddUsdtFormChange}
                    step="0.01"
                    min="0"
                    required
                  />
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'Adding...' : 'Add USDT'}
                  </button>
                </div>
              </form>
            </section>

            {/* Give Backend USDT */}
            <section className="section">
              <h2>🏦 Backend USDT (for testing)</h2>
              <form onSubmit={giveBackendUsdt}>
                <div className="form-row">
                  <input
                    type="number"
                    name="amount"
                    placeholder="USDT Amount"
                    value={backendUsdtForm.amount}
                    onChange={handleBackendUsdtFormChange}
                    step="0.01"
                    min="0"
                    required
                  />
                  <button type="submit" disabled={loading} className="btn">
                    {loading ? 'Funding...' : 'Fund Backend USDT'}
                  </button>
                </div>
              </form>
            </section>

            {/* Purchase GT Tokens */}
            <section className="section">
              <h2>🔄 Purchase GT Tokens</h2>
              <form onSubmit={purchaseGtTokens}>
                <div className="form-row">
                  <input
                    type="number"
                    name="usdtAmount"
                    placeholder="USDT Amount to Spend"
                    value={purchaseForm.usdtAmount}
                    onChange={handlePurchaseFormChange}
                    step="0.01"
                    min="0"
                    required
                  />
                  <button type="submit" disabled={loading} className="btn btn-success">
                    {loading ? 'Purchasing...' : 'Buy GT Tokens'}
                  </button>
                </div>
              </form>
            </section>

            {/* Match Management */}
            <section className="section">
              <h2>🎯 Match Management</h2>
              
              {/* Start Match Form */}
              <div className="form-group">
                <h3>Start New Match</h3>
                <form onSubmit={startMatch}>
                  <div className="form-row">
                    <input
                      type="text"
                      name="matchId"
                      placeholder="Match ID"
                      value={matchForm.matchId}
                      onChange={handleMatchFormChange}
                      required
                    />
                    <input
                      type="text"
                      name="player1"
                      placeholder="Player 1 Address"
                      value={matchForm.player1}
                      onChange={handleMatchFormChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <input
                      type="text"
                      name="player2"
                      placeholder="Player 2 Address"
                      value={matchForm.player2}
                      onChange={handleMatchFormChange}
                      required
                    />
                    <input
                      type="number"
                      name="stake"
                      placeholder="Stake Amount (GT)"
                      value={matchForm.stake}
                      onChange={handleMatchFormChange}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'Starting...' : 'Start Match'}
                  </button>
                </form>
              </div>

              {/* Stake Form */}
              <div className="form-group">
                <h3>Stake into Match</h3>
                <form onSubmit={stakeMatch}>
                  <div className="form-row">
                    <input
                      type="text"
                      name="matchId"
                      placeholder="Match ID"
                      value={stakeForm.matchId}
                      onChange={handleStakeFormChange}
                      required
                    />
                    <input
                      type="text"
                      name="player"
                      placeholder="Your Address"
                      value={stakeForm.player}
                      onChange={handleStakeFormChange}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn">
                    {loading ? 'Staking...' : 'Stake'}
                  </button>
                </form>
              </div>

              {/* Match Summary */}
              <div className="form-group">
                <h3>Match Summary</h3>
                <form onSubmit={getMatchSummary}>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Match ID"
                      value={summaryMatchId}
                      onChange={handleSummaryIdChange}
                      required
                    />
                    <button type="submit" disabled={loading} className="btn">
                      {loading ? 'Fetching...' : 'Get Summary'}
                    </button>
                  </div>
                </form>
                {summaryData && (
                  <pre className="summary-pre">{JSON.stringify(summaryData, null, 2)}</pre>
                )}
              </div>

              {/* Submit Result Form */}
              <div className="form-group">
                <h3>Submit Match Result</h3>
                <form onSubmit={submitResult}>
                  <div className="form-row">
                    <input
                      type="text"
                      name="matchId"
                      placeholder="Match ID"
                      value={resultForm.matchId}
                      onChange={handleResultFormChange}
                      required
                    />
                    <input
                      type="text"
                      name="winner"
                      placeholder="Winner Address"
                      value={resultForm.winner}
                      onChange={handleResultFormChange}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={dryRun} onChange={handleDryRunChange} />
                      Dry Run (no transaction)
                    </label>
                  </div>
                  <button type="submit" disabled={loading} className="btn btn-success">
                    {loading ? (dryRun ? 'Preflighting...' : 'Submitting...') : (dryRun ? 'Preflight Result' : 'Submit Result')}
                  </button>
                </form>
              </div>
            </section>
          </>
        )}

        {/* Leaderboard */}
        <section className="section">
          <h2>🏆 Leaderboard</h2>
          <button onClick={getLeaderboard} className="btn">
            Refresh Leaderboard
          </button>
          
          {leaderboard.length > 0 ? (
            <div className="leaderboard">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Address</th>
                    <th>Wins</th>
                    <th>GT Won</th>
                    <th>Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player, index) => (
                    <tr key={player.address}>
                      <td>{index + 1}</td>
                      <td>{player.address}</td>
                      <td>{player.total_wins}</td>
                      <td>{player.total_gt_won}</td>
                      <td>{player.total_matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No leaderboard data available</p>
          )}
        </section>

        {/* Status Messages */}
        {message && (
          <section className="section">
            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
