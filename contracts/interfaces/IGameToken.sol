// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IGameToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function gameId() external view returns (bytes32);
}
