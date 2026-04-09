// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; //1 billion cap
    bytes32 public immutable gameId; //which game this token belongs to

    event TokensMinted(address indexed to, uint256 amount);
    constructor(string memory name,string memory symbol,bytes32 _gameId,address developer,uint256 initialSupply) ERC20(name, symbol) Ownable(msg.sender) {
        gameId = _gameId;
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds cap");
        _mint(developer, initialSupply);  
        emit TokensMinted(developer, initialSupply);

        //game registry creates tokens and gives the ownership of initial_supply number of tokens to the game developer so that he/she can set up market


    }

    function mint(address to, uint256 amount) external onlyOwner {
        // by not allowing the developer to mint tokens as per will we are preventing inflation
        require(totalSupply() + amount <= MAX_SUPPLY, "Cap exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    //mint and constructor called by registry burn called by any user
}