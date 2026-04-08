// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
    bytes32 public immutable gameId;

    event TokensMinted(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 _gameId,
        address developer,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        gameId = _gameId;
        if (initialSupply > 0) {
            require(initialSupply <= MAX_SUPPLY, "Exceeds max supply");
            _mint(developer, initialSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Cap exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
