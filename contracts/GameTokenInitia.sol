// SPDX-License-Identifier: MIT
// NOTE: This contract ONLY compiles on a real MiniEVM chain (requires precompiles at 0xF1 and 0xF2).
pragma solidity ^0.8.25;

import "./initia/InitiaERC20.sol";

/**
 * @title GameTokenInitia
 * @notice Initia-native game token that auto-registers with the Cosmos bank module.
 *         Used for DNGN, HRV, and any future game tokens deployed on MiniEVM.
 *         Extends InitiaERC20 which provides sudoTransfer (required for IBC bridging),
 *         ERC20Registry integration, and Cosmos ACL modifiers.
 */
contract GameTokenInitia is InitiaERC20 {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
    bytes32 public immutable gameId;
    event TokensMinted(address indexed to, uint256 amount);
    constructor(
        string memory _name,
        string memory _symbol,
        bytes32 _gameId,
        address developer,
        uint256 initialSupply
    ) InitiaERC20(_name, _symbol, 18) {
        gameId = _gameId;
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds cap");
        if (initialSupply > 0) {
            _mint(developer, initialSupply);
            emit TokensMinted(developer, initialSupply);
        }
    }
    /// @dev Override mint to enforce MAX_SUPPLY cap
    function mint(address to, uint256 amount) external override mintable(to) onlyOwner {
        require(totalSupply + amount <= MAX_SUPPLY, "Cap exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
}
