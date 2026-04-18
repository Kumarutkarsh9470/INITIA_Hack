// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IGameAssetCollection.sol";
import "./interfaces/IAchievementBadge.sol";

contract CosmicRacer is ERC2771Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    IGameAssetCollection public immutable assetCollection;
    IAchievementBadge public immutable achievementBadge;
    address public immutable owner;

    uint256 public constant ENTRY_FEE = 10 * 1e18;

    uint256 public constant ITEM_SPEED_BOOST = 1;
    uint256 public constant ITEM_NITRO_TANK = 2;
    uint256 public constant ITEM_TURBO_ENGINE = 3;

    uint256 public constant BADGE_FIRST_RACE = 3; // badge id 3 = "First Race"

    mapping(address => uint256) public playerNonce;
    mapping(address => uint256) public bestDistance;
    uint256 public totalRaces;

    event RaceCompleted(address indexed player, uint256 itemId, uint256 distance, uint256 roll);

    constructor(
        address _trustedForwarder,
        address _raceToken,
        address _assetCollection,
        address _achievementBadge
    ) ERC2771Context(_trustedForwarder) {
        raceToken = IERC20(_raceToken);
        assetCollection = IGameAssetCollection(_assetCollection);
        achievementBadge = IAchievementBadge(_achievementBadge);
        owner = msg.sender;
    }

    function race() external nonReentrant {
        address playerTBA = _msgSender();

        // Charge entry fee
        raceToken.safeTransferFrom(playerTBA, address(this), ENTRY_FEE);

        // Generate pseudorandom number
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            playerTBA,
            playerNonce[playerTBA]++
        ))) % 100;

        // Pick reward tier: 60% Speed Boost, 30% Nitro Tank, 10% Turbo Engine
        uint256 itemId;
        if (rand < 60) {
            itemId = ITEM_SPEED_BOOST;
        } else if (rand < 90) {
            itemId = ITEM_NITRO_TANK;
        } else {
            itemId = ITEM_TURBO_ENGINE;
        }

        // Mint item to player
        assetCollection.mintItem(playerTBA, itemId, 1);
        totalRaces++;

        // First race badge
        if (playerNonce[playerTBA] == 1) {
            achievementBadge.issueBadge(playerTBA, BADGE_FIRST_RACE);
        }

        emit RaceCompleted(playerTBA, itemId, 0, rand);
    }

    function withdrawFees(address to) external {
        require(msg.sender == owner, "Only owner");
        uint256 balance = raceToken.balanceOf(address(this));
        require(balance > 0, "No fees");
        raceToken.safeTransfer(to, balance);
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
