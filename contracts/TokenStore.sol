// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./GameToken.sol";

contract TokenStore is Ownable, ReentrancyGuard {
    IERC20 public usdtContract;
    GameToken public gameTokenContract;
    uint256 public gtPerUsdt;
    
    event Purchase(address buyer, uint256 usdtAmount, uint256 gtAmount);
    
    constructor(
        address _usdtContract,
        address _gameTokenContract,
        uint256 _gtPerUsdt
            ) Ownable() {
        usdtContract = IERC20(_usdtContract);
        gameTokenContract = GameToken(_gameTokenContract);
        gtPerUsdt = _gtPerUsdt;
    }
    
    function buy(uint256 usdtAmount) external nonReentrant {
        require(usdtAmount > 0, "Amount must be greater than 0");
        
        // Calculate GT amount (USDT has 6 decimals, GT has 18)
        uint256 gtAmount = (usdtAmount * gtPerUsdt) / 1e6;
        
        // Transfer USDT from user to this contract
        require(
            usdtContract.transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );
        
        // Mint GT tokens to user
        gameTokenContract.mint(msg.sender, gtAmount);
        
        emit Purchase(msg.sender, usdtAmount, gtAmount);
    }
    
    function withdrawUSDT(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        
        usdtContract.transfer(to, amount);
    }
    
    function updateGtPerUsdt(uint256 _newRate) external onlyOwner {
        gtPerUsdt = _newRate;
    }
}
