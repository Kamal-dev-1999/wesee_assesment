import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import axios from 'axios'

const PORT = process.env.PORT || 3002
const API_BASE = process.env.API_BASE || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'dev'

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*'} })

const stakeToQueue = new Map()

function pushQueue(stake, p) {
  const key = String(stake)
  if (!stakeToQueue.has(key)) stakeToQueue.set(key, [])
  stakeToQueue.get(key).push(p)
}

function popOpponent(stake) {
  const key = String(stake)
  const q = stakeToQueue.get(key) || []
  return q.length ? q.shift() : null
}

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/queue/join', async (req, res) => {
  const { playerAddress, stake, matchId, socketId } = req.body || {}
  if (!playerAddress || !stake || !matchId) return res.status(400).json({ error: 'missing fields' })

  const opponent = popOpponent(stake)
  if (!opponent) {
    pushQueue(stake, { address: playerAddress, matchId, socketId })
    return res.json({ queued: true })
  }

  const payload = { matchId, player1: opponent.address, player2: playerAddress, stake: String(stake) }
  await axios.post(`${API_BASE}/match/start`, payload, { headers: { 'X-API-KEY': API_KEY } })
  if (opponent.socketId) io.to(opponent.socketId).emit('matchFound', payload)
  if (socketId) io.to(socketId).emit('matchFound', payload)
  res.json({ queued: false, matchCreated: true, match: payload })
})

io.on('connection', socket => {
  socket.emit('helloAck', { socketId: socket.id })
})

server.listen(PORT, () => console.log(`matchmaking:${PORT}`))

