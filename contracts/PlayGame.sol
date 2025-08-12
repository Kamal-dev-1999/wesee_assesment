// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./GameToken.sol";

contract PlayGame is Ownable, ReentrancyGuard {
    IERC20 public gameToken;
    
    enum MatchStatus { PENDING, STAKED, SETTLED, REFUNDED }
    
    struct Match {
        address player1;
        address player2;
        uint256 stake;
        MatchStatus status;
        uint256 startTime;
        bool player1Staked;
        bool player2Staked;
    }
    
    mapping(bytes32 => Match) public matches;
    uint256 public constant TIMEOUT_PERIOD = 24 hours;
    
    event MatchCreated(bytes32 indexed matchId, address player1, address player2, uint256 stake);
    event Staked(bytes32 indexed matchId, address player, uint256 amount);
    event Settled(bytes32 indexed matchId, address winner, uint256 amount);
    event Refunded(bytes32 indexed matchId, address player, uint256 amount);
    
    constructor(address _gameToken) Ownable() {
        gameToken = IERC20(_gameToken);
    }
    
    modifier onlyAuthorized() {
        require(msg.sender == owner(), "Only authorized operator");
        _;
    }
    
                function createMatch(
                bytes32 matchId,
                address player1,
                address player2,
                uint256 matchStake
            ) external onlyAuthorized {
        require(player1 != address(0) && player2 != address(0), "Invalid player addresses");
        require(player1 != player2, "Players must be different");
        require(matchStake > 0, "Stake must be greater than 0");
        require(matches[matchId].player1 == address(0), "Match already exists");
        
        matches[matchId] = Match({
            player1: player1,
            player2: player2,
            stake: matchStake,
            status: MatchStatus.PENDING,
            startTime: 0,
            player1Staked: false,
            player2Staked: false
        });
        
        emit MatchCreated(matchId, player1, player2, matchStake);
    }
    
    function stake(bytes32 matchId) external nonReentrant {
        Match storage matchData = matches[matchId];
        require(matchData.status == MatchStatus.PENDING, "Match not in pending status");
        require(
            msg.sender == matchData.player1 || msg.sender == matchData.player2,
            "Only match players can stake"
        );
        
        if (msg.sender == matchData.player1) {
            require(!matchData.player1Staked, "Player 1 already staked");
            matchData.player1Staked = true;
        } else {
            require(!matchData.player2Staked, "Player 2 already staked");
            matchData.player2Staked = true;
        }
        
        // Transfer GT tokens from player to this contract
        require(
            gameToken.transferFrom(msg.sender, address(this), matchData.stake),
            "GT transfer failed"
        );
        
        emit Staked(matchId, msg.sender, matchData.stake);
        
        // Check if both players have staked
        if (matchData.player1Staked && matchData.player2Staked) {
            matchData.status = MatchStatus.STAKED;
            matchData.startTime = block.timestamp;
        }
    }
    
    function commitResult(bytes32 matchId, address winner) external onlyAuthorized {
        Match storage matchData = matches[matchId];
        require(matchData.status == MatchStatus.STAKED, "Match not staked");
        require(
            winner == matchData.player1 || winner == matchData.player2,
            "Winner must be a match player"
        );
        
        uint256 totalPrize = matchData.stake * 2;
        
        // Transfer entire prize pool to winner
        gameToken.transfer(winner, totalPrize);
        
        matchData.status = MatchStatus.SETTLED;
        
        emit Settled(matchId, winner, totalPrize);
    }
    
    function refund(bytes32 matchId) external nonReentrant {
        Match storage matchData = matches[matchId];
        require(
            msg.sender == matchData.player1 || msg.sender == matchData.player2,
            "Only match players can refund"
        );
        require(matchData.status == MatchStatus.STAKED, "Match not staked");
        require(
            block.timestamp >= matchData.startTime + TIMEOUT_PERIOD,
            "Timeout period not reached"
        );
        
        // Refund player's stake
        gameToken.transfer(msg.sender, matchData.stake);
        
        matchData.status = MatchStatus.REFUNDED;
        
        emit Refunded(matchId, msg.sender, matchData.stake);
    }
    
    function getMatch(bytes32 matchId) external view returns (
        address player1,
        address player2,
        uint256 stake,
        MatchStatus status,
        uint256 startTime,
        bool player1Staked,
        bool player2Staked
    ) {
        Match storage matchData = matches[matchId];
        return (
            matchData.player1,
            matchData.player2,
            matchData.stake,
            matchData.status,
            matchData.startTime,
            matchData.player1Staked,
            matchData.player2Staked
        );
    }
}
