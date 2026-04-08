// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IPixelVaultDEX {
    function swapGameForPXL(bytes32 gameId, uint256 gameAmountIn, uint256 minPXLOut) external returns (uint256);
    function swapPXLForGame(bytes32 gameId, uint256 pxlAmountIn, uint256 minGameOut) external returns (uint256);
    function getAmountIn(bytes32 gameId, uint256 pxlAmountOut) external view returns (uint256);
}
