const { ethers } = require('ethers');
const { MongoClient } = require('mongodb');
require('dotenv').config();

class GamingIndexer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.client = null;
        this.db = null;
        this.isRunning = false;
        
        // Contract addresses
        this.gameTokenAddress = process.env.GAME_TOKEN_ADDRESS;
        this.tokenStoreAddress = process.env.TOKEN_STORE_ADDRESS;
        this.playGameAddress = process.env.PLAY_GAME_ADDRESS;
        
        // MongoDB configuration
        this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        this.dbName = process.env.MONGODB_DB || 'gaming_staking_dapp';
        
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
            // Connect to MongoDB
            this.client = new MongoClient(this.mongoUri);
            await this.client.connect();
            console.log('Connected to MongoDB');
            
            this.db = this.client.db(this.dbName);
            
            // Create collections with indexes
            const playersCollection = this.db.collection('players');
            const matchesCollection = this.db.collection('matches');
            const eventsCollection = this.db.collection('events');
            
            // Create indexes for better performance
            await playersCollection.createIndex({ address: 1 }, { unique: true });
            await playersCollection.createIndex({ total_gt_won: -1 }); // For leaderboard sorting
            await playersCollection.createIndex({ total_wins: -1 });
            
            await matchesCollection.createIndex({ match_id: 1 }, { unique: true });
            await matchesCollection.createIndex({ status: 1 });
            await matchesCollection.createIndex({ created_at: -1 });
            
            await eventsCollection.createIndex({ event_type: 1 });
            await eventsCollection.createIndex({ match_id: 1 });
            await eventsCollection.createIndex({ player_address: 1 });
            await eventsCollection.createIndex({ block_number: 1 });
            await eventsCollection.createIndex({ timestamp: -1 });
            
            console.log('MongoDB collections and indexes created');
            
        } catch (error) {
            console.error('Failed to initialize MongoDB:', error);
            throw error;
        }
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
        try {
            const playersCollection = this.db.collection('players');
            
            const updateDoc = {
                $inc: {
                    total_matches: updates.total_matches || 0,
                    total_wins: updates.total_wins || 0,
                    total_gt_won: updates.total_gt_won || 0,
                    total_gt_staked: updates.total_gt_staked || 0
                },
                $set: {
                    last_updated: new Date()
                }
            };
            
            const result = await playersCollection.updateOne(
                { address },
                updateDoc,
                { upsert: true }
            );
            
            return result.upsertedId || result.modifiedCount;
        } catch (error) {
            console.error('Error updating player stats:', error);
            throw error;
        }
    }
    
    async updateMatch(matchId, status, winner) {
        try {
            const matchesCollection = this.db.collection('matches');
            
            const updateDoc = {
                $set: {
                    status,
                    winner,
                    settled_at: new Date()
                }
            };
            
            const result = await matchesCollection.updateOne(
                { match_id: matchId },
                updateDoc
            );
            
            return result.modifiedCount;
        } catch (error) {
            console.error('Error updating match:', error);
            throw error;
        }
    }
    
    async storeEvent(eventType, matchId, playerAddress, amount, blockNumber, transactionHash) {
        try {
            const eventsCollection = this.db.collection('events');
            
            const eventDoc = {
                event_type: eventType,
                match_id: matchId,
                player_address: playerAddress,
                amount: parseFloat(amount),
                block_number: blockNumber,
                transaction_hash: transactionHash,
                timestamp: new Date()
            };
            
            const result = await eventsCollection.insertOne(eventDoc);
            return result.insertedId;
        } catch (error) {
            console.error('Error storing event:', error);
            throw error;
        }
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
        try {
            const playersCollection = this.db.collection('players');
            
            const leaderboard = await playersCollection
                .find({})
                .sort({ total_gt_won: -1 })
                .limit(10)
                .project({
                    address: 1,
                    total_wins: 1,
                    total_gt_won: 1,
                    total_matches: 1,
                    _id: 0
                })
                .toArray();
            
            return leaderboard;
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            throw error;
        }
    }
    
    async getPlayerStats(address) {
        try {
            const playersCollection = this.db.collection('players');
            
            const player = await playersCollection.findOne(
                { address },
                { projection: { _id: 0 } }
            );
            
            return player || { address, message: 'Player not found' };
        } catch (error) {
            console.error('Error getting player stats:', error);
            throw error;
        }
    }
    
    async createMatchRecord(matchId, player1, player2, stake) {
        try {
            const matchesCollection = this.db.collection('matches');
            
            const matchDoc = {
                match_id: matchId,
                player1,
                player2,
                stake: parseFloat(stake),
                status: 'PENDING',
                winner: null,
                created_at: new Date(),
                settled_at: null
            };
            
            const result = await matchesCollection.insertOne(matchDoc);
            return result.insertedId;
        } catch (error) {
            console.error('Error creating match record:', error);
            throw error;
        }
    }
    
    async stop() {
        this.isRunning = false;
        if (this.client) {
            await this.client.close();
            console.log('MongoDB connection closed');
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
