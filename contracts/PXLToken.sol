// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./initia/IERC20Registry.sol";

contract PXLToken is ERC20{
    uint256 public constant TOTAL_SUPPLY =  1000000000000000000000000000; // 1 billion tokens with 18 decimals
    constructor(address treasury)ERC20("PixelVault", "PXL"){
        // Register PXL with Initia's Cosmos bank module (makes it a first-class Cosmos denom)
        try ERC20_REGISTRY_CONTRACT.register_erc20() {} catch {}
        _mint(treasury, TOTAL_SUPPLY);
    }
}