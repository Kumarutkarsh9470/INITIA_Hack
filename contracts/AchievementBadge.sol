// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AchievementBadge is ERC1155, AccessControl{
    
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    mapping(uint256 => string) public badgeMetadata; // badgeId => metadata URI
    mapping(uint256 => bytes32) public badgeToGame;//badgeID=>which Game

    // For reputation tracking:
    mapping(address => uint256) public playerBadgeCount; // total badges earned
    mapping(address => uint256) public playerUniqueGames; // how many different games
    mapping(address => mapping(bytes32 => bool)) private _playerGameSeen; // prevents doublecounting

    constructor() ERC1155("") {
        // The deployer (Registry) gets admin rights to grant ISSUER_ROLE to games
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public pure override {
        revert("Badges are non-transferable");
    }
    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory) public pure override {
        revert("Badges are non-transferable");
    }
    // Now if anyone tries to transfer a badge, the transaction fails.
    // The only way to get a badge is to earn

    function defineBadge(uint256 badgeId, bytes32 gameId, string calldata metadataURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        badgeMetadata[badgeId] = metadataURI;
        badgeToGame[badgeId] = gameId;
    }

    function issueBadge(address player, uint256 badgeId) external onlyRole(ISSUER_ROLE){
        bytes32 gameId = badgeToGame[badgeId];
        // Ensuring badge is defined before issuing and storing in local variable to optimize gas and minimize frequent lookups
        require(gameId != bytes32(0), "Badge not defined");
        _mint(player, badgeId, 1, "");
         playerBadgeCount[player]++;
         if (!_playerGameSeen[player][gameId]) {
            _playerGameSeen[player][gameId] = true;
            playerUniqueGames[player]++;
        }

    }

    function getReputation(address player) external view returns (uint256){
        return (playerBadgeCount[player] * 10) + (playerUniqueGames[player] * 50);
        //Playing many different games gives more reputation than grinding badges
        // in one game. This encourages players to try new games.

    }
    function uri(uint256 badgeId) public view override returns (string memory) {
        return badgeMetadata[badgeId];
    } //Extra function added so front-ends can see the badge info
 
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
 
 }

    
