// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./erc6551/ERC6551Registry.sol";

contract PlayerProfile is ERC721, Ownable {
    IERC6551Registry public immutable registry;
    address public immutable accountImpl;

    mapping(uint256 => string) public usernames;
    uint256 private _nextTokenId;
    string private _baseMetadataURI;
    mapping(address => bool) public hasMinted;

    event ProfileCreated(
        uint256 indexed tokenId,
        address indexed owner,
        address tba,
        string username
    );

    event UsernameUpdated(
        uint256 indexed tokenId,
        string newUsername
    );

    constructor(
        address _registry,
        address _accountImpl,
        string memory baseURI
    ) ERC721("PixelVault Player", "PVP") Ownable(msg.sender) {
        registry = IERC6551Registry(_registry);
        accountImpl = _accountImpl;
        _baseMetadataURI = baseURI;
    }

    function mint(string calldata username) external {
        require(!hasMinted[msg.sender], "Already minted");
        require(bytes(username).length >= 3 && bytes(username).length <= 20, "Username: 3-20 chars");

        hasMinted[msg.sender] = true;
        uint256 tokenId = _nextTokenId++;

        _safeMint(msg.sender, tokenId);

        address tba = registry.createAccount(
            accountImpl,
            bytes32(0),
            block.chainid,
            address(this),
            tokenId
        );

        usernames[tokenId] = username;

        emit ProfileCreated(tokenId, msg.sender, tba, username);
    }

    function getTBA(uint256 tokenId) external view returns (address) {
        return registry.account(
            accountImpl,
            bytes32(0),
            block.chainid,
            address(this),
            tokenId
        );
    }

    function updateUsername(uint256 tokenId, string calldata newUsername) external {
        require(msg.sender == ownerOf(tokenId), "Not owner");
        require(bytes(newUsername).length >= 3 && bytes(newUsername).length <= 20, "Username: 3-20 chars");

        usernames[tokenId] = newUsername;
        emit UsernameUpdated(tokenId, newUsername);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_baseMetadataURI, Strings.toString(tokenId)));
    }

    function totalPlayers() external view returns (uint256) {
        return _nextTokenId;
    }
}
