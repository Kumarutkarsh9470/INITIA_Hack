// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PXLToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    constructor(address treasury) ERC20("PixelVault", "PXL") {
        _mint(treasury, TOTAL_SUPPLY);
    }
}
