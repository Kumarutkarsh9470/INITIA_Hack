// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GameAssetCollection is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    mapping(uint256 => string) public itemMetadata;
    mapping(uint256 => bool) public itemExists;
    string public gameName;

    event ItemDefined(uint256 indexed itemId, string metadataURI);

    constructor(string memory _gameName) ERC1155("") {
        gameName = _gameName;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function defineItem(uint256 itemId, string calldata metadataURI) external onlyRole(MINTER_ROLE) {
        require(!itemExists[itemId], "Item already defined");
        itemMetadata[itemId] = metadataURI;
        itemExists[itemId] = true;
        emit ItemDefined(itemId, metadataURI);
    }

    function mintItem(address to, uint256 itemId, uint256 amount) external onlyRole(GAME_ROLE) {
        require(itemExists[itemId], "Item not defined");
        _mint(to, itemId, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyRole(GAME_ROLE) {
        for (uint256 i = 0; i < ids.length; i++) {
            require(itemExists[ids[i]], "Item not defined");
        }
        _mintBatch(to, ids, amounts, "");
    }

    function uri(uint256 itemId) public view override returns (string memory) {
        return itemMetadata[itemId];
    }

    function grantGameRole(address gameContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(GAME_ROLE, gameContract);
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
