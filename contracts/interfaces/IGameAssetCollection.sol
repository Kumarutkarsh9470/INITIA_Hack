// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IGameAssetCollection {
    function grantGameRole(address gameContract) external;
    function defineItem(uint256 itemId, string calldata metadataURI) external;
    function mintItem(address to, uint256 itemId, uint256 amount) external;
    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external;
}
