// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

//  Interface for the ERC6551Registry
interface IERC6551Registry {
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address);

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);
}

/**
 * @title PlayerProfile
 * @notice Mints player identity NFTs and automatically creates associated 
 * ERC-6551 Token Bound Accounts (TBAs). 
 */
contract PlayerProfile is ERC721, Ownable {
    // State Variables (Immutable)
    IERC6551Registry public immutable registry; 
    address public immutable accountImpl;

    //  State Variables (Mutable)
    mapping(uint256 => string) public usernames; 
    uint256 private _nextTokenId; 
    string private _baseMetadataURI; 
    mapping(address => bool) public hasMinted; 
    mapping(address => uint256) public ownerToTokenId;

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

    /**
     * @notice Mints a unique player identity NFT and creates its wallet. 
     */
    function mint(string calldata username) external {
        require(!hasMinted[msg.sender], "Already minted");
        require(bytes(username).length >= 3 && bytes(username).length <= 20, "Username: 3-20 chars");
        hasMinted[msg.sender] = true;

        //  Increment ID and mint NFT
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        ownerToTokenId[msg.sender] = tokenId;

        //  Create the TBA wallet via the registry using salt = 0
        address tbaAddress = registry.createAccount(
            accountImpl, 
            bytes32(0), 
            block.chainid, 
            address(this), 
            tokenId
        );

        //  Store username and announce creation
        usernames[tokenId] = username;
        emit ProfileCreated(tokenId, msg.sender, tbaAddress, username);
    }

    /**
     * @notice Deterministically calculates the player's wallet address. 
     */
    function getTBA(uint256 tokenId) public view returns (address) {
        //  Parameters must match mint() exactly
        return registry.account(
            accountImpl, 
            bytes32(0), 
            block.chainid, 
            address(this), 
            tokenId
        );
    }

    /**
     * @notice Allows the owner of a profile to change their username. 
     */
    function updateUsername(uint256 tokenId, string calldata newUsername) external {
        //  Access control and validation
        require(msg.sender == ownerOf(tokenId), "Not profile owner");
        require(bytes(newUsername).length >= 3 && bytes(newUsername).length <= 20, "Invalid length");

        usernames[tokenId] = newUsername;
        emit UsernameUpdated(tokenId, newUsername);
    }

    /**
     * @notice Returns the full metadata URL for a player. 
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_baseMetadataURI, Strings.toString(tokenId)));
    }

    function totalPlayers() external view returns (uint256) {
        return _nextTokenId;
    }
}