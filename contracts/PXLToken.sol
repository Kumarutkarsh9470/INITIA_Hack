// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PXLToken is ERC20{
    uint256 public constant TOTAL_SUPPLY =  1000000000000000000000000000; // 1 billion tokens with 18 decimals
    constructor(address treasury)ERC20("PixelVault", "PXL"){
        _mint(treasury, TOTAL_SUPPLY);
    }
}