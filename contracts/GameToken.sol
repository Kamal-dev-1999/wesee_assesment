// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, Ownable {
    address public tokenStoreContract;
    
    event Minted(address to, uint256 amount);
    
    constructor() ERC20("GameToken", "GT") Ownable() {}
    
    modifier onlyTokenStore() {
        require(msg.sender == tokenStoreContract, "Only TokenStore can mint");
        _;
    }
    
    function setTokenStoreContract(address _tokenStore) external onlyOwner {
        tokenStoreContract = _tokenStore;
    }
    
    function mint(address to, uint256 amount) external onlyTokenStore {
        _mint(to, amount);
        emit Minted(to, amount);
    }
}
