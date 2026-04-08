// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IGameRegistry {
    function isRegistered(address token) external view returns (bool);
    function tokenToGame(address token) external view returns (bytes32);
    function recordSwap(bytes32 gameId, uint256 volume, address player) external;
    function getGameRating(bytes32 gameId) external view returns (uint256);
    function games(bytes32 gameId) external view returns (
        address tokenAddress,
        address assetCollection,
        address developer,
        string memory name,
        string memory symbol,
        uint256 totalVolume,
        uint256 uniquePlayers,
        uint256 registeredAt,
        bool active
    );
}
