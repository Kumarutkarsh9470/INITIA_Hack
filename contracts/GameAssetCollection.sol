// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GameAssetCollection is ERC1155, AccessControl{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    mapping(uint256 => string) public itemMetadata; // itemId => metadata URI
    mapping(uint256 => bool) public itemExists; // has this item been defined?
    string public gameName; //for display
    event ItemDefined(uint256 indexed itemId, string metadataURI);
    constructor (string memory _gameName)  ERC1155(""){
        gameName = _gameName;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }
    function defineItem(uint256 itemId, string calldata metadataURI) external onlyRole(MINTER_ROLE) 
    {
        require(!itemExists[itemId], "Item already defined");
        
        itemMetadata[itemId] = metadataURI;
        itemExists[itemId] = true;
        
        emit ItemDefined(itemId, metadataURI);
    }
    function mintItem(address to, uint256 itemId, uint256 amount) external onlyRole(GAME_ROLE){
        require(itemExists[itemId], "Item doesn't exist");
        _mint(to, itemId, amount, "");
    }
    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(GAME_ROLE) {
        for (uint256 i = 0; i < ids.length; i++) {
            require(itemExists[ids[i]], "One or more items do not exist");
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