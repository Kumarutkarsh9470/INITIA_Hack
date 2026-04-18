// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IGameAssetCollection.sol";
import "./interfaces/IAchievementBadge.sol";
contract HarvestField is ERC2771Context, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAtBlock;
    }
    mapping(address => StakeInfo) public stakes;
    IERC20 public immutable hrvToken;
    IGameAssetCollection public immutable assetCollection;
    IAchievementBadge public immutable achievementBadge;
    uint256 public constant HARVEST_DELAY = 20; // blocks
    uint256 public constant BASE_REWARD_RATE = 1e16; // reward per token per block
    uint256 public constant SEASONAL_ITEM_ID = 1;
    uint256 public constant BADGE_FIRST_HARVEST = 2;
    mapping(address => bool) private _hasHarvested;
    event Staked(address indexed player, uint256 amount);
    event Harvested(address indexed player, uint256 reward, uint256 itemId);
    event Unstaked(address indexed player, uint256 amount);
    constructor(
        address _trustedForwarder,
        address _hrvToken,
        address _assetCollection,
        address _achievementBadge
    ) ERC2771Context(_trustedForwarder) {
        hrvToken = IERC20(_hrvToken);
        assetCollection = IGameAssetCollection(_assetCollection);
        achievementBadge = IAchievementBadge(_achievementBadge);
    }
    function stake(uint256 amount) external nonReentrant {
        address playerTBA = _msgSender();
        require(amount > 0, "Amount must be > 0");
        require(stakes[playerTBA].amount == 0, "Already staking");
        hrvToken.safeTransferFrom(playerTBA, address(this), amount);
        stakes[playerTBA] = StakeInfo({
            amount: amount,
            stakedAtBlock: block.number
        });
        emit Staked(playerTBA, amount);
    }
    function harvest() external nonReentrant {
        address playerTBA = _msgSender();
        StakeInfo storage stk = stakes[playerTBA];
        require(stk.amount > 0, "No active stake");
        require(block.number >= stk.stakedAtBlock + HARVEST_DELAY, "Too early");
        uint256 blocksStaked = block.number - stk.stakedAtBlock;
        uint256 reward = (stk.amount * BASE_REWARD_RATE * blocksStaked) / 1e18;
        uint256 stakedAmount = stk.amount;
        delete stakes[playerTBA];

        // Return staked tokens
        hrvToken.safeTransfer(playerTBA, stakedAmount);

        // Transfer reward tokens (assumes this contract holds reward tokens)
        if (reward > 0) {
            uint256 available = hrvToken.balanceOf(address(this));
            if (reward > available) {
                reward = available;
            }
            if (reward > 0) {
                hrvToken.safeTransfer(playerTBA, reward);
            }
        }

        // Mint seasonal item
        assetCollection.mintItem(playerTBA, SEASONAL_ITEM_ID, 1);

        // First harvest badge
        if (!_hasHarvested[playerTBA]) {
            _hasHarvested[playerTBA] = true;
            achievementBadge.issueBadge(playerTBA, BADGE_FIRST_HARVEST);
        }

        emit Harvested(playerTBA, reward, SEASONAL_ITEM_ID);
    }

    function unstake() external nonReentrant {
        address playerTBA = _msgSender();
        StakeInfo storage stk = stakes[playerTBA];
        require(stk.amount > 0, "No active stake");

        uint256 amount = stk.amount;
        delete stakes[playerTBA];

        hrvToken.safeTransfer(playerTBA, amount);

        emit Unstaked(playerTBA, amount);
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
