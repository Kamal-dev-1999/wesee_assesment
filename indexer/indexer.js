const { ethers } = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class GamingIndexer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.db = null;
        this.isRunning = false;
        
        // Contract addresses
        this.gameTokenAddress = process.env.GAME_TOKEN_ADDRESS;
        this.tokenStoreAddress = process.env.TOKEN_STORE_ADDRESS;
        this.playGameAddress = process.env.PLAY_GAME_ADDRESS;
        
        // SQLite database path
        this.dbPath = path.join(__dirname, 'gaming_data.db');
        
        // Event signatures
        this.eventSignatures = {
            Purchase: 'Purchase(address,uint256,uint256)',
            Staked: 'Staked(bytes32,address,uint256)',
            Settled: 'Settled(bytes32,address,uint256)',
            Refunded: 'Refunded(bytes32,address,uint256)'
        };
    }
    
    async initialize() {
        try {
            // Initialize database
            await this.initDatabase();
            
            // Start listening to events
            await this.startEventListening();
            
            // Start HTTP server for leaderboard API
            await this.startLeaderboardServer();
            
            console.log('Gaming Indexer initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize indexer:', error);
            process.exit(1);
        }
    }
    
    async initDatabase() {
        try {
            // Create SQLite database
            this.db = new sqlite3.Database(this.dbPath);
            
            // Create tables
            await this.createTables();
            
            console.log('SQLite database initialized');
            
        } catch (error) {
            console.error('Failed to initialize SQLite database:', error);
            throw error;
        }
    }
    
    async createTables() {
        return new Promise((resolve, reject) => {
            // Players table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS players (
                    address TEXT PRIMARY KEY,
                    total_matches INTEGER DEFAULT 0,
                    total_wins INTEGER DEFAULT 0,
                    total_gt_won REAL DEFAULT 0,
                    total_gt_staked REAL DEFAULT 0,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating players table:', err);
                    reject(err);
                    return;
                }
                
                // Matches table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS matches (
                        match_id TEXT PRIMARY KEY,
                        player1 TEXT,
                        player2 TEXT,
                        stake REAL,
                        status TEXT DEFAULT 'PENDING',
                        winner TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        settled_at DATETIME
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating matches table:', err);
                        reject(err);
                        return;
                    }
                    
                    // Events table
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS events (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_type TEXT,
                            match_id TEXT,
                            player_address TEXT,
                            amount REAL,
                            block_number INTEGER,
                            transaction_hash TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `, (err) => {
                        if (err) {
                            console.error('Error creating events table:', err);
                            reject(err);
                            return;
                        }
                        
                        console.log('All tables created successfully');
                        resolve();
                    });
                });
            });
        });
    }
    
    async startEventListening() {
        try {
            console.log('Starting event listening...');
            
            // Listen to Purchase events from TokenStore
            this.provider.on(
                {
                    address: this.tokenStoreAddress,
                    topics: [ethers.id(this.eventSignatures.Purchase)]
                },
                this.handlePurchaseEvent.bind(this)
            );
            
            // Listen to Staked events from PlayGame
            this.provider.on(
                {
                    address: this.playGameAddress,
                    topics: [ethers.id(this.eventSignatures.Staked)]
                },
                this.handleStakedEvent.bind(this)
            );
            
            // Listen to Settled events from PlayGame
            this.provider.on(
                {
                    address: this.playGameAddress,
                    topics: [ethers.id(this.eventSignatures.Settled)]
                },
                this.handleSettledEvent.bind(this)
            );
            
            // Listen to Refunded events from PlayGame
            this.provider.on(
                {
                    address: this.playGameAddress,
                    topics: [ethers.id(this.eventSignatures.Refunded)]
                },
                this.handleRefundedEvent.bind(this)
            );
            
            // Listen to MatchCreated events from PlayGame
            this.provider.on(
                {
                    address: this.playGameAddress,
                    topics: [ethers.id('MatchCreated(bytes32,address,address,uint256)')]
                },
                this.handleMatchCreatedEvent.bind(this)
            );
            
            this.isRunning = true;
            console.log('Event listening started');
            
        } catch (error) {
            console.error('Failed to start event listening:', error);
            throw error;
        }
    }
    
    async handleMatchCreatedEvent(log) {
        try {
            const event = this.parseMatchCreatedEvent(log);
            console.log('Match created event:', event);
            
            // Create match record in database
            await this.createMatchRecord(event.matchId, event.player1, event.player2, event.stake);
            
            // Store event
            await this.storeEvent('MatchCreated', event.matchId, null, event.stake, log.blockNumber, log.transactionHash);
            
        } catch (error) {
            console.error('Error handling match created event:', error);
        }
    }
    
    async handlePurchaseEvent(log) {
        try {
            const event = this.parsePurchaseEvent(log);
            console.log('Purchase event:', event);
            
            // Update player stats (purchasing doesn't affect gaming stats directly)
            await this.updatePlayerStats(event.buyer, {
                total_gt_won: 0, // Purchase doesn't count as winnings
                total_matches: 0,
                total_wins: 0
            });
            
            // Store event
            await this.storeEvent('Purchase', null, event.buyer, event.gtAmount, log.blockNumber, log.transactionHash);
            
        } catch (error) {
            console.error('Error handling purchase event:', error);
        }
    }
    
    async handleStakedEvent(log) {
        try {
            const event = this.parseStakedEvent(log);
            console.log('Staked event:', event);
            
            // Update player stats
            await this.updatePlayerStats(event.player, {
                total_gt_staked: event.amount,
                total_matches: 1
            });
            
            // Store event
            await this.storeEvent('Staked', event.matchId, event.player, event.amount, log.blockNumber, log.transactionHash);
            
        } catch (error) {
            console.error('Error handling staked event:', error);
        }
    }
    
    async handleSettledEvent(log) {
        try {
            const event = this.parseSettledEvent(log);
            console.log('Settled event:', event);
            
            // Update winner stats
            await this.updatePlayerStats(event.winner, {
                total_wins: 1,
                total_gt_won: event.amount
            });
            
            // Update match record
            await this.updateMatch(event.matchId, 'SETTLED', event.winner);
            
            // Store event
            await this.storeEvent('Settled', event.matchId, event.winner, event.amount, log.blockNumber, log.transactionHash);
            
        } catch (error) {
            console.error('Error handling settled event:', error);
        }
    }
    
    async handleRefundedEvent(log) {
        try {
            const event = this.parseRefundedEvent(log);
            console.log('Refunded event:', event);
            
            // Update match record
            await this.updateMatch(event.matchId, 'REFUNDED', null);
            
            // Store event
            await this.storeEvent('Refunded', event.matchId, event.player, event.amount, log.blockNumber, log.transactionHash);
            
        } catch (error) {
            console.error('Error handling refunded event:', error);
        }
    }
    
    parseMatchCreatedEvent(log) {
        const iface = new ethers.Interface([
            'event MatchCreated(bytes32 indexed matchId, address player1, address player2, uint256 stake)'
        ]);
        const parsed = iface.parseLog(log);
        return {
            matchId: parsed.args.matchId,
            player1: parsed.args.player1,
            player2: parsed.args.player2,
            stake: ethers.formatEther(parsed.args.stake)
        };
    }
    
    parsePurchaseEvent(log) {
        const iface = new ethers.Interface([
            'event Purchase(address buyer, uint256 usdtAmount, uint256 gtAmount)'
        ]);
        const parsed = iface.parseLog(log);
        return {
            buyer: parsed.args.buyer,
            usdtAmount: ethers.formatUnits(parsed.args.usdtAmount, 6),
            gtAmount: ethers.formatEther(parsed.args.gtAmount)
        };
    }
    
    parseStakedEvent(log) {
        const iface = new ethers.Interface([
            'event Staked(bytes32 indexed matchId, address player, uint256 amount)'
        ]);
        const parsed = iface.parseLog(log);
        return {
            matchId: parsed.args.matchId,
            player: parsed.args.player,
            amount: ethers.formatEther(parsed.args.amount)
        };
    }
    
    parseSettledEvent(log) {
        const iface = new ethers.Interface([
            'event Settled(bytes32 indexed matchId, address winner, uint256 amount)'
        ]);
        const parsed = iface.parseLog(log);
        return {
            matchId: parsed.args.matchId,
            winner: parsed.args.winner,
            amount: ethers.formatEther(parsed.args.amount)
        };
    }
    
    parseRefundedEvent(log) {
        const iface = new ethers.Interface([
            'event Refunded(bytes32 indexed matchId, address player, uint256 amount)'
        ]);
        const parsed = iface.parseLog(log);
        return {
            matchId: parsed.args.matchId,
            player: parsed.args.player,
            amount: ethers.formatEther(parsed.args.amount)
        };
    }
    
    async updatePlayerStats(address, updates) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO players (address, total_matches, total_wins, total_gt_won, total_gt_staked, last_updated)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(address) DO UPDATE SET
                    total_matches = total_matches + ?,
                    total_wins = total_wins + ?,
                    total_gt_won = total_gt_won + ?,
                    total_gt_staked = total_gt_staked + ?,
                    last_updated = CURRENT_TIMESTAMP
            `;
            
            this.db.run(sql, [
                address,
                updates.total_matches || 0,
                updates.total_wins || 0,
                updates.total_gt_won || 0,
                updates.total_gt_staked || 0,
                updates.total_matches || 0,
                updates.total_wins || 0,
                updates.total_gt_won || 0,
                updates.total_gt_staked || 0
            ], function(err) {
                if (err) {
                    console.error('Error updating player stats:', err);
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }
    
    async updateMatch(matchId, status, winner) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE matches 
                SET status = ?, winner = ?, settled_at = CURRENT_TIMESTAMP
                WHERE match_id = ?
            `;
            
            this.db.run(sql, [status, winner, matchId], function(err) {
                if (err) {
                    console.error('Error updating match:', err);
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }
    
    async storeEvent(eventType, matchId, playerAddress, amount, blockNumber, transactionHash) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO events (event_type, match_id, player_address, amount, block_number, transaction_hash, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [eventType, matchId, playerAddress, amount, blockNumber, transactionHash], function(err) {
                if (err) {
                    console.error('Error storing event:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }
    
    async startLeaderboardServer() {
        const express = require('express');
        const app = express();
        const PORT = process.env.INDEXER_PORT || 3001;
        
        app.use(express.json());
        
        // Leaderboard endpoint
        app.get('/leaderboard', async (req, res) => {
            try {
                const leaderboard = await this.getLeaderboard();
                res.json({
                    timestamp: new Date().toISOString(),
                    leaderboard
                });
            } catch (error) {
                console.error('Error getting leaderboard:', error);
                res.status(500).json({ error: 'Failed to get leaderboard' });
            }
        });
        
        // Player stats endpoint
        app.get('/player/:address', async (req, res) => {
            try {
                const { address } = req.params;
                const stats = await this.getPlayerStats(address);
                res.json(stats);
            } catch (error) {
                console.error('Error getting player stats:', error);
                res.status(500).json({ error: 'Failed to get player stats' });
            }
        });
        
        app.listen(PORT, () => {
            console.log(`Leaderboard API server running on port ${PORT}`);
        });
    }
    
    async getLeaderboard() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT address, total_wins, total_gt_won, total_matches
                FROM players
                ORDER BY total_gt_won DESC
                LIMIT 10
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error getting leaderboard:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }
    
    async getPlayerStats(address) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT address, total_wins, total_gt_won, total_matches, total_gt_staked, last_updated
                FROM players
                WHERE address = ?
            `;
            
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Error getting player stats:', err);
                    reject(err);
                } else {
                    resolve(row || { address, message: 'Player not found' });
                }
            });
        });
    }
    
    async createMatchRecord(matchId, player1, player2, stake) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO matches (match_id, player1, player2, stake, status, created_at)
                VALUES (?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [matchId, player1, player2, stake], function(err) {
                if (err) {
                    console.error('Error creating match record:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }
    
    async stop() {
        this.isRunning = false;
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('SQLite database connection closed');
                }
            });
        }
        console.log('Indexer stopped');
    }
}

// Start the indexer
const indexer = new GamingIndexer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down indexer...');
    await indexer.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down indexer...');
    await indexer.stop();
    process.exit(0);
});

// Initialize and start
indexer.initialize().catch(console.error);
