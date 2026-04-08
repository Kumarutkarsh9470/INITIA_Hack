// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IAchievementBadge {
    function issueBadge(address player, uint256 badgeId) external;
    function getReputation(address player) external view returns (uint256);
}
