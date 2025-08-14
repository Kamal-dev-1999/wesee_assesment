import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081
const API_BASE = process.env.API_BASE || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'dev'

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: true } })

app.use(express.static(path.join(__dirname, 'public')))
app.get('/health', (_req, res) => res.json({ ok: true }))

const waitingByStake = new Map()
const matches = new Map()

function generateMatchId(a, b, stake) {
  const seed = `${a.toLowerCase()}|${b.toLowerCase()}|${stake}|${Date.now()}|${crypto.randomUUID()}`
  const hex = crypto.createHash('sha256').update(seed).digest('hex')
  return `0x${hex}`
}

function lineWins(board, i, j, k) {
  const a = board[i], b = board[j], c = board[k]
  return a !== null && a === b && b === c
}

function evaluateBoard(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  for (const [i,j,k] of lines) if (lineWins(board, i, j, k)) return { winner: board[i], draw: false }
  return { winner: null, draw: !board.some(c => c === null) }
}

function removeFromQueue(stake, socketId) {
  const key = String(stake)
  const q = waitingByStake.get(key)
  if (!q) return
  const idx = q.findIndex(p => p.socketId === socketId)
  if (idx >= 0) {
    q.splice(idx, 1)
    if (q.length === 0) waitingByStake.delete(key)
  }
}

io.on('connection', socket => {
  socket.emit('hello', { socketId: socket.id })

  socket.on('findMatch', ({ address, stakeAmount } = {}) => {
    const addr = String(address || '').trim()
    const stake = String(stakeAmount ?? '').trim()
    if (!addr || !stake || isNaN(Number(stake)) || Number(stake) <= 0) {
      socket.emit('errorMsg', { message: 'Invalid matchmaking payload' })
      return
    }
    const key = String(stake)
    if (!waitingByStake.has(key)) waitingByStake.set(key, [])
    const queue = waitingByStake.get(key)
    const opponent = queue.find(p => p.socketId !== socket.id)
    if (!opponent) {
      queue.push({ address: addr, socketId: socket.id })
      socket.emit('queued', { stakeAmount: key })
      return
    }
    const matchId = generateMatchId(opponent.address, addr, key)
    const room = matchId
    const assignX = [opponent.address.toLowerCase(), addr.toLowerCase()].sort()[0] === opponent.address.toLowerCase()
    const X = assignX ? opponent : { address: addr, socketId: socket.id }
    const O = assignX ? { address: addr, socketId: socket.id } : opponent
    
    // Prevent same address from playing against itself
    if (X.address.toLowerCase() === O.address.toLowerCase()) {
      socket.emit('errorMsg', { message: 'Cannot match with yourself. Use different wallets.' })
      return
    }
    
    const match = { matchId, room, stakeAmount: key, players: { X, O }, next: 'X', board: Array(9).fill(null), status: 'IN_PROGRESS' }
    matches.set(matchId, match)
    removeFromQueue(key, opponent.socketId)
    removeFromQueue(key, socket.id)
    io.sockets.sockets.get(X.socketId)?.join(room)
    io.sockets.sockets.get(O.socketId)?.join(room)
         io.to(room).emit('matchFound', { matchId, stakeAmount: key, playerX: X.address, playerO: O.address })
     
     // Create match on-chain and wait for staking
     ;(async () => {
       try {
         console.log(`Creating match on-chain: ${matchId}`)
         const response = await axios.post(`${API_BASE}/match/start`, {
           matchId,
           player1: X.address,
           player2: O.address,
           stake: String(key)
         }, { headers: { 'X-API-KEY': API_KEY } })
         console.log(`Match created on-chain:`, response.data)
         
         // Poll for staking completion
         const pollInterval = setInterval(async () => {
           try {
             const summaryRes = await axios.get(`${API_BASE}/match/summary/${matchId}`)
             const summary = summaryRes.data
             console.log(`Match status:`, summary)
             
             if (summary.statusText === 'STAKED' && summary.bothPlayersStaked) {
               clearInterval(pollInterval)
               console.log(`Both players staked, starting game`)
               io.to(room).emit('gameStart', { matchId, next: match.next, board: match.board, stakeAmount: key })
             } else {
               io.to(room).emit('statusUpdate', { 
                 message: `Waiting for players to stake. Status: ${summary.statusText}` 
               })
             }
           } catch (pollErr) {
             console.log(`Error polling match status:`, pollErr.message)
             if (pollErr.response) {
               console.log(`Response status:`, pollErr.response.status)
               console.log(`Response data:`, pollErr.response.data)
             }
           }
         }, 3000) // Poll every 3 seconds
         
       } catch (err) {
         console.log(`Error creating match on-chain:`, err.message)
         if (err.response) {
           console.log(`Response status:`, err.response.status)
           console.log(`Response data:`, err.response.data)
         }
         // Fallback: start game anyway for testing
         setTimeout(() => {
           console.log(`Starting game without on-chain match (fallback)`)
           io.to(room).emit('gameStart', { matchId, next: match.next, board: match.board, stakeAmount: key })
         }, 2000)
       }
     })()
  })

  socket.on('makeMove', ({ matchId, index, address } = {}) => {
    const match = matches.get(String(matchId || ''))
    if (!match || match.status !== 'IN_PROGRESS') return
    const idx = Number(index)
    if (!(idx >= 0 && idx <= 8) || match.board[idx] !== null) return
    const symbol = match.next
    const expected = symbol === 'X' ? match.players.X.address.toLowerCase() : match.players.O.address.toLowerCase()
    if (String(address || '').toLowerCase() !== expected) return
    match.board[idx] = symbol
    const { winner, draw } = evaluateBoard(match.board)
    if (winner) {
      match.status = 'DONE'
    io.to(match.room).emit('gameState', { board: match.board, next: null })
    const winnerAddress = winner === 'X' ? match.players.X.address : match.players.O.address
         io.to(match.room).emit('gameOver', { matchId: match.matchId, result: 'WIN', winnerSymbol: winner, winnerAddress })
     
     // Commit result on-chain
     ;(async () => {
       try {
         console.log(`Calling API to commit result for match ${match.matchId}, winner: ${winnerAddress}`)
         const response = await axios.post(`${API_BASE}/match/result`, { 
           matchId: match.matchId, 
           winner: winnerAddress 
         }, { headers: { 'X-API-KEY': API_KEY } })
         console.log(`Result committed successfully:`, response.data)
       } catch (err) {
         console.log(`Error committing result:`, err.message)
         if (err.response) {
           console.log(`Response status:`, err.response.status)
           console.log(`Response data:`, err.response.data)
         }
       }
     })()
      return
    }
    if (draw) {
      match.status = 'DONE'
      io.to(match.room).emit('gameState', { board: match.board, next: null })
      io.to(match.room).emit('gameOver', { matchId: match.matchId, result: 'DRAW' })
      return
    }
    match.next = symbol === 'X' ? 'O' : 'X'
    io.to(match.room).emit('gameState', { board: match.board, next: match.next })
  })

  socket.on('disconnect', () => {
    for (const [stake] of waitingByStake) removeFromQueue(stake, socket.id)
    for (const match of matches.values()) {
      if (match.status !== 'IN_PROGRESS') continue
      const isX = match.players.X.socketId === socket.id
      const isO = match.players.O.socketId === socket.id
      if (!isX && !isO) continue
      match.status = 'DONE'
             const winnerAddress = isX ? match.players.O.address : match.players.X.address
       io.to(match.room).emit('gameOver', { matchId: match.matchId, result: 'FORFEIT', winnerAddress })
       
       // Commit forfeit result on-chain
       ;(async () => {
         try {
           console.log(`Calling API to commit forfeit result for match ${match.matchId}, winner: ${winnerAddress}`)
           const response = await axios.post(`${API_BASE}/match/result`, { 
             matchId: match.matchId, 
             winner: winnerAddress 
           }, { headers: { 'X-API-KEY': API_KEY } })
           console.log(`Forfeit result committed successfully:`, response.data)
         } catch (err) {
           console.log(`Error committing forfeit result:`, err.message)
           if (err.response) {
             console.log(`Response status:`, err.response.status)
             console.log(`Response data:`, err.response.data)
           }
         }
       })()
      break
    }
  })
})

server.listen(PORT, () => console.log(`tic-tac-toe on http://localhost:${PORT}`))

