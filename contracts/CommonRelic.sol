// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IGameRegistry.sol";

contract CommonRelic is ERC1155, Ownable {
    uint256 public constant RELIC_COMMON = 1;
    uint256 public constant RELIC_RARE = 2;
    uint256 public constant RELIC_LEGENDARY = 3;

    uint256 public constant BASE_COMMON_VALUE = 10 * 1e18;
    uint256 public constant BASE_RARE_VALUE = 50 * 1e18;
    uint256 public constant BASE_LEGENDARY_VALUE = 200 * 1e18;

    IGameRegistry public immutable gameRegistry;
    mapping(uint256 => uint256) public baseValues;

    constructor(address _gameRegistry) ERC1155("") Ownable(msg.sender) {
        gameRegistry = IGameRegistry(_gameRegistry);
        baseValues[RELIC_COMMON] = BASE_COMMON_VALUE;
        baseValues[RELIC_RARE] = BASE_RARE_VALUE;
        baseValues[RELIC_LEGENDARY] = BASE_LEGENDARY_VALUE;
    }

    function mint(address to, uint256 relicType, uint256 amount) external onlyOwner {
        require(relicType >= 1 && relicType <= 3, "Invalid relic type");
        _mint(to, relicType, amount, "");
    }

    function getBaseValue(uint256 relicType) external view returns (uint256) {
        return baseValues[relicType];
    }

    function getRelicValueInGame(uint256 relicType, bytes32 gameId) external view returns (uint256) {
        uint256 rating = gameRegistry.getGameRating(gameId);
        if (rating == 0) return 0;
        return (baseValues[relicType] * rating) / 500;
    }
}
