import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { BrowserProvider, Contract, ZeroAddress, formatUnits, parseUnits } from 'ethers'

const CONFIG = {
  rpcUrl: 'https://sepolia.infura.io/v3/a09f8457bacc402784cc8d3fda755754',
  apiBase: 'http://localhost:3000',
  gameToken: '0xDBa0940104b42E25e199cBfc98dF9a4cdC790237',
  playGame: '0xfC1a1AeF66cBc3C5C1D3DdEbc9d09a44db28a41C',
  tokenStore: '0x55b7CA60Ed69b69D692c7129580a9a7861577180',
  usdt: '0xA7F42A45a3B47635b6f094C90B479Cc173B66663'
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address,uint256) returns (bool)'
]

const PLAY_ABI = [
  'function stake(bytes32 matchId)'
]

const TOKEN_STORE_ABI = [
  'function gtPerUsdt() view returns (uint256)'
]

function useProvider() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask required')
    const p = new BrowserProvider(window.ethereum)
    const sepolia = '0xaa36a7'
    const chainId = await p.send('eth_chainId', [])
    if (chainId !== sepolia) await p.send('wallet_switchEthereumChain', [{ chainId: sepolia }])
    await p.send('eth_requestAccounts', [])
    setProvider(p)
  }, [])
  return { provider, connect }
}

export default function App() {
  const { provider, connect } = useProvider()
  const [address, setAddress] = useState('')
  const [gt, setGt] = useState('0')
  const [usdtAmount, setUsdtAmount] = useState('25')
  const [stakeAmount, setStakeAmount] = useState('10')
  const [matchId, setMatchId] = useState('')
  const [status, setStatus] = useState('idle')

  const signer = useMemo(async () => provider?.getSigner(), [provider])

  const token = useMemo(
    () => provider ? new Contract(CONFIG.gameToken, ERC20_ABI, provider) : null,
    [provider]
  )

  const play = useMemo(
    () => provider ? new Contract(CONFIG.playGame, PLAY_ABI, provider) : null,
    [provider]
  )

  const refresh = useCallback(async () => {
    if (!provider || !token) return
    const s = await provider.getSigner()
    const addr = await s.getAddress()
    setAddress(addr)
    const [bal, dec] = await Promise.all([
      token.balanceOf(addr),
      token.decimals()
    ])
    setGt(formatUnits(bal, dec))
  }, [provider, token])

  useEffect(() => { if (provider) refresh() }, [provider, refresh])

  const handleConnect = useCallback(async () => {
    await connect(); await refresh()
  }, [connect, refresh])

  const addUSDT = useCallback(async () => {
    setStatus('adding-usdt')
    const r = await axios.post(`${CONFIG.apiBase}/add-dummy-usdt`, { address, amount: usdtAmount })
    setStatus(`usdt-ok:${r.data.usdtAmount}`)
  }, [address, usdtAmount])

  const purchaseGT = useCallback(async () => {
    setStatus('purchasing')
    const r = await axios.post(`${CONFIG.apiBase}/purchase`, { address, usdtAmount })
    setStatus(`purchase-ok:${r.data.gtReceived}`)
    await refresh()
  }, [address, usdtAmount, refresh])

  const approveStake = useCallback(async () => {
    if (!provider || !token) return
    setStatus('approving')
    const s = await provider.getSigner()
    const dec = await token.decimals()
    const stake = parseUnits(stakeAmount, dec)
    const tx = await token.connect(s).approve(CONFIG.playGame, stake)
    await tx.wait()
    setStatus('approved')
  }, [provider, token, stakeAmount])

  const doStake = useCallback(async () => {
    if (!provider || !play) return
    setStatus('staking')
    const s = await provider.getSigner()
    const tx = await play.connect(s).stake(matchId)
    await tx.wait()
    setStatus('staked')
    await refresh()
  }, [provider, play, matchId, refresh])

  const summary = useCallback(async () => {
    const r = await axios.get(`${CONFIG.apiBase}/match/summary/${matchId}`)
    return r.data
  }, [matchId])

  const submitResult = useCallback(async (winner: string) => {
    const r = await axios.post(`${CONFIG.apiBase}/match/result`, { matchId, winner })
    return r.data
  }, [matchId])

  return (
    <div style={{maxWidth:820,margin:'40px auto',fontFamily:'Inter,system-ui,Arial',padding:'0 16px'}}>
      <h2>Game dApp</h2>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <button onClick={handleConnect}>Connect Wallet</button>
        <span>{address || 'Not connected'}</span>
      </div>
      <div style={{marginTop:12}}>GT: {gt}</div>

      <hr style={{margin:'24px 0'}} />

      <h3>USDT → GT</h3>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input value={usdtAmount} onChange={e=>setUsdtAmount(e.target.value)} style={{width:120}} />
        <button onClick={addUSDT}>Add USDT</button>
        <button onClick={purchaseGT}>Buy GT</button>
      </div>

      <hr style={{margin:'24px 0'}} />

      <h3>Stake</h3>
      <div style={{display:'grid',gap:8,gridTemplateColumns:'1fr 1fr auto auto'}}>
        <input placeholder='bytes32 matchId' value={matchId} onChange={e=>setMatchId(e.target.value)} />
        <input placeholder='stake GT' value={stakeAmount} onChange={e=>setStakeAmount(e.target.value)} />
        <button onClick={approveStake}>Approve</button>
        <button onClick={doStake}>Stake</button>
      </div>

      <div style={{marginTop:12}}>Status: {status}</div>

      <hr style={{margin:'24px 0'}} />

      <h3>Match</h3>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button onClick={async()=>{
          const s = await summary(); alert(JSON.stringify(s,null,2))
        }}>Get Summary</button>
        <button onClick={async()=>{
          const s = await summary(); const w = s.player1
          const r = await submitResult(w); alert(JSON.stringify(r,null,2))
        }}>Submit Result (p1)</button>
      </div>
    </div>
  )
}

