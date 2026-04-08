// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AchievementBadge is ERC1155, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    mapping(uint256 => string) public badgeMetadata;
    mapping(uint256 => bytes32) public badgeToGame;

    mapping(address => uint256) public playerBadgeCount;
    mapping(address => uint256) public playerUniqueGames;
    mapping(address => mapping(bytes32 => bool)) private _playerGameSeen;

    event BadgeDefined(uint256 indexed badgeId, bytes32 indexed gameId, string metadataURI);
    event BadgeIssued(address indexed player, uint256 indexed badgeId);

    constructor() ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function defineBadge(
        uint256 badgeId,
        bytes32 gameId,
        string calldata metadataURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badgeMetadata[badgeId] = metadataURI;
        badgeToGame[badgeId] = gameId;
        emit BadgeDefined(badgeId, gameId, metadataURI);
    }

    function issueBadge(address player, uint256 badgeId) external onlyRole(ISSUER_ROLE) {
        _mint(player, badgeId, 1, "");
        playerBadgeCount[player]++;

        bytes32 gameId = badgeToGame[badgeId];
        if (!_playerGameSeen[player][gameId]) {
            _playerGameSeen[player][gameId] = true;
            playerUniqueGames[player]++;
        }

        emit BadgeIssued(player, badgeId);
    }

    function getReputation(address player) external view returns (uint256) {
        return (playerBadgeCount[player] * 10) + (playerUniqueGames[player] * 50);
    }

    // Make badges non-transferable (soulbound)
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert("Badges are non-transferable");
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert("Badges are non-transferable");
    }

    function uri(uint256 badgeId) public view override returns (string memory) {
        return badgeMetadata[badgeId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
