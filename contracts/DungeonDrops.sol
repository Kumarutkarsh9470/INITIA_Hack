// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IGameAssetCollection.sol";
import "./interfaces/IAchievementBadge.sol";

contract DungeonDrops is ERC2771Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable dngnToken;
    IGameAssetCollection public immutable assetCollection;
    IAchievementBadge public immutable achievementBadge;
    address public immutable owner;
    uint256 public constant ENTRY_FEE = 10 * 1e18;
    uint256 public constant ITEM_COMMON_SWORD = 1;
    uint256 public constant ITEM_RARE_SHIELD = 2;
    uint256 public constant ITEM_LEGENDARY_CROWN = 3;
    uint256 public constant BADGE_FIRST_CLEAR = 1;
    mapping(address => uint256) public playerNonce;
    uint256 public totalRuns;
    event DungeonEntered(address indexed player, uint256 itemId, uint256 roll);

    constructor(
        address _trustedForwarder,
        address _dngnToken,
        address _assetCollection,
        address _achievementBadge
    ) ERC2771Context(_trustedForwarder) {
        dngnToken = IERC20(_dngnToken);
        assetCollection = IGameAssetCollection(_assetCollection);
        achievementBadge = IAchievementBadge(_achievementBadge);
        owner = msg.sender;
    }

    function enterDungeon() external nonReentrant {
        address playerTBA = _msgSender();

        // Charge entry fee
        dngnToken.safeTransferFrom(playerTBA, address(this), ENTRY_FEE);

        // Generate pseudorandom number
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            playerTBA,
            playerNonce[playerTBA]++
        ))) % 100;

        // Pick loot tier
        uint256 itemId;
        if (rand < 60) {
            itemId = ITEM_COMMON_SWORD;
        } else if (rand < 90) {
            itemId = ITEM_RARE_SHIELD;
        } else {
            itemId = ITEM_LEGENDARY_CROWN;
        }

        // Mint item to player
        assetCollection.mintItem(playerTBA, itemId, 1);
        totalRuns++;
        // First clear badge
        if (playerNonce[playerTBA] == 1) {
            achievementBadge.issueBadge(playerTBA, BADGE_FIRST_CLEAR);
        }
        emit DungeonEntered(playerTBA, itemId, rand);
    }

    function withdrawFees(address to) external {
        require(msg.sender == owner, "Only owner");
        uint256 balance = dngnToken.balanceOf(address(this));
        require(balance > 0, "No fees");
        dngnToken.safeTransfer(to, balance);
    }

    function _msgSender() internal view override returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
