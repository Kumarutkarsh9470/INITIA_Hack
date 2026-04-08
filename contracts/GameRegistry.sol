// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GameToken.sol";
import "./GameAssetCollection.sol";

contract GameRegistry is Ownable {
    struct GameData {
        address tokenAddress;
        address assetCollection;
        address developer;
        string name;
        string symbol;
        uint256 totalVolume;
        uint256 uniquePlayers;
        uint256 registeredAt;
        bool active;
    }

    mapping(bytes32 => GameData) public games;
    mapping(address => bytes32) public tokenToGame;
    mapping(address => bool) public isRegistered;
    bytes32[] public gameIds;
    address public trustedDEX;
    mapping(bytes32 => mapping(address => bool)) private _playerSeen;

    event GameRegistered(
        bytes32 indexed gameId,
        address tokenAddress,
        address assetCollection,
        address developer,
        string name
    );
    event SwapRecorded(bytes32 indexed gameId, uint256 volume, address player);
    event GamePaused(bytes32 indexed gameId);
    event GameResumed(bytes32 indexed gameId);

    constructor() Ownable(msg.sender) {}

    function setTrustedDEX(address dex) external onlyOwner {
        trustedDEX = dex;
    }

    function registerGame(
        string calldata name,
        string calldata symbol,
        address developer,
        uint256 initialSupply
    ) external onlyOwner returns (address, address) {
        bytes32 gameId = keccak256(abi.encodePacked(name));
        require(games[gameId].tokenAddress == address(0), "Game already exists");

        GameToken token = new GameToken(name, symbol, gameId, developer, initialSupply);
        GameAssetCollection assets = new GameAssetCollection(name);

        // Grant asset collection admin & minter roles to the developer
        assets.grantRole(assets.DEFAULT_ADMIN_ROLE(), developer);
        assets.grantRole(assets.MINTER_ROLE(), developer);

        games[gameId] = GameData({
            tokenAddress: address(token),
            assetCollection: address(assets),
            developer: developer,
            name: name,
            symbol: symbol,
            totalVolume: 0,
            uniquePlayers: 0,
            registeredAt: block.timestamp,
            active: true
        });

        tokenToGame[address(token)] = gameId;
        isRegistered[address(token)] = true;
        gameIds.push(gameId);

        emit GameRegistered(gameId, address(token), address(assets), developer, name);

        return (address(token), address(assets));
    }

    function recordSwap(bytes32 gameId, uint256 volume, address player) external {
        require(msg.sender == trustedDEX, "Only trusted DEX");
        games[gameId].totalVolume += volume;

        if (!_playerSeen[gameId][player]) {
            _playerSeen[gameId][player] = true;
            games[gameId].uniquePlayers++;
        }

        emit SwapRecorded(gameId, volume, player);
    }

    function getGameRating(bytes32 gameId) public view returns (uint256) {
        GameData storage game = games[gameId];
        if (!game.active || game.tokenAddress == address(0)) return 0;

        uint256 volNorm = game.totalVolume / 1e18 + 1;
        uint256 playerNorm = game.uniquePlayers + 1;

        uint256 volScore = _log2(volNorm);
        uint256 playerScore = _log2(playerNorm);

        uint256 raw = (volScore * playerScore * 100) / 25;

        if (raw < 100) return 100;
        if (raw > 500) return 500;
        return raw;
    }

    function _log2(uint256 x) internal pure returns (uint256 r) {
        while (x > 1) {
            x >>= 1;
            r++;
        }
    }

    function pauseGame(bytes32 gameId) external onlyOwner {
        games[gameId].active = false;
        emit GamePaused(gameId);
    }

    function resumeGame(bytes32 gameId) external onlyOwner {
        games[gameId].active = true;
        emit GameResumed(gameId);
    }

    function getGameCount() external view returns (uint256) {
        return gameIds.length;
    }

    function getGameData(bytes32 gameId) external view returns (
        address tokenAddress,
        address assetCollection,
        address developer,
        string memory name,
        string memory symbol,
        uint256 totalVolume,
        uint256 uniquePlayers,
        uint256 registeredAt,
        bool active
    ) {
        GameData storage g = games[gameId];
        return (
            g.tokenAddress,
            g.assetCollection,
            g.developer,
            g.name,
            g.symbol,
            g.totalVolume,
            g.uniquePlayers,
            g.registeredAt,
            g.active
        );
    }
}
