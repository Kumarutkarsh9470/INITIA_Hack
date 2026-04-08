// SPDX-License-Identifier: MIT
// NOTE: This version ONLY compiles on a real MiniEVM chain (requires precompiles at 0xF1 and 0xF2).
// Use contracts/PXLToken.sol (standard ERC20) for local dev and testing.
pragma solidity ^0.8.25;

import "./initia/InitiaERC20.sol";

contract PXLTokenInitia is InitiaERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    constructor(address treasury)
        InitiaERC20("PixelVault", "PXL", 18)
    {
        _mint(treasury, TOTAL_SUPPLY);
    }
}
