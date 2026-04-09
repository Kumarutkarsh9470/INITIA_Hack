// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPixelVaultDEX {
    function getAmountIn(bytes32 gameId, uint256 pxlAmountOut) external view returns (uint256);
    function swapGameForPXL(bytes32 gameId, uint256 gameAmountIn, uint256 minPXLOut) external returns (uint256);
}

interface IGameRegistry {
    function isRegistered(address token) external view returns (bool);
    function tokenToGame(address token) external view returns (bytes32);
    function getGameRating(bytes32 gameId) external view returns (uint256);
}

contract Marketplace is ERC2771Context, ReentrancyGuard, IERC1155Receiver {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address collection;
        uint256 itemId;
        uint256 amount;
        uint256 priceInPXL;
        bytes32 gameId;
        bool active;
    }

    // ERC1155 RECEIVER HELPERS
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    IERC20 public immutable pxlToken;
    IPixelVaultDEX public immutable dex;
    IGameRegistry public immutable gameRegistry;
    address public feeRecipient;
    uint256 public constant FEE_BPS = 250; // 2.5%
    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event ItemListed(uint256 indexed listingId, address indexed seller, address collection, uint256 itemId, uint256 amount, uint256 priceInPXL);
    event ItemSold(uint256 indexed listingId, address buyer, address seller, uint256 amount, uint256 totalPXL);
    event ListingCancelled(uint256 indexed listingId);

    constructor(
        address _pxlToken,
        address _dex,
        address _gameRegistry,
        address _feeRecipient,
        address _forwarder
    ) ERC2771Context(_forwarder) {
        pxlToken = IERC20(_pxlToken);
        dex = IPixelVaultDEX(_dex);
        gameRegistry = IGameRegistry(_gameRegistry);
        feeRecipient = _feeRecipient;
    }

    function listItem(
        address collection,
        uint256 itemId,
        uint256 amount,
        uint256 priceInPXL,
        bytes32 gameId
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(priceInPXL > 0, "Price must be > 0");

        IERC1155(collection).safeTransferFrom(_msgSender(), address(this), itemId, amount, "");

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: _msgSender(),
            collection: collection,
            itemId: itemId,
            amount: amount,
            priceInPXL: priceInPXL,
            gameId: gameId,
            active: true
        });

        emit ItemListed(listingId, _msgSender(), collection, itemId, amount, priceInPXL);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(listing.seller == _msgSender(), "Not seller");

        listing.active = false;

        IERC1155(listing.collection).safeTransferFrom(address(this), _msgSender(), listing.itemId, listing.amount, "");

        emit ListingCancelled(listingId);
    }

    function buyItem(
        uint256 listingId,
        uint256 amount,
        address paymentToken,
        uint256 maxPayment
    ) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(amount <= listing.amount, "Not enough stock");

        uint256 totalPXL = listing.priceInPXL * amount;

        if (paymentToken == address(pxlToken)) {
            pxlToken.safeTransferFrom(_msgSender(), address(this), totalPXL);
        } else {
            uint256 amountIn = dex.getAmountIn(listing.gameId, totalPXL);
            require(amountIn <= maxPayment, "Slippage too high");

            IERC20(paymentToken).safeTransferFrom(_msgSender(), address(this), amountIn);
            IERC20(paymentToken).approve(address(dex), amountIn);

            dex.swapGameForPXL(listing.gameId, amountIn, totalPXL);
        }

        uint256 fee = (totalPXL * FEE_BPS) / 10000;
        pxlToken.safeTransfer(feeRecipient, fee);
        pxlToken.safeTransfer(listing.seller, totalPXL - fee);

        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;

        IERC1155(listing.collection).safeTransferFrom(address(this), _msgSender(), listing.itemId, amount, "");

        emit ItemSold(listingId, _msgSender(), listing.seller, amount, totalPXL);
    }

    // DIAMOND INHERITANCE OVERRIDES ---
    function _msgSender() internal view override returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}