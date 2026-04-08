// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPixelVaultDEX.sol";
import "./interfaces/IGameRegistry.sol";

contract Marketplace is ERC2771Context, ReentrancyGuard {
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

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId;

    uint256 public constant FEE_BPS = 250; // 2.5%

    address public feeRecipient;
    IERC20 public immutable pxlToken;
    IPixelVaultDEX public immutable dex;
    IGameRegistry public immutable gameRegistry;

    event ItemListed(
        uint256 indexed listingId,
        address indexed seller,
        address collection,
        uint256 itemId,
        uint256 amount,
        uint256 priceInPXL
    );
    event ItemSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPXL
    );
    event ItemCanceled(uint256 indexed listingId);

    constructor(
        address _pxlToken,
        address _dex,
        address _gameRegistry,
        address _feeRecipient,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) {
        pxlToken = IERC20(_pxlToken);
        dex = IPixelVaultDEX(_dex);
        gameRegistry = IGameRegistry(_gameRegistry);
        feeRecipient = _feeRecipient;
    }

    // ERC-1155 receivers
    function onERC1155Received(
        address, address, uint256, uint256, bytes calldata
    ) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, address, uint256[] calldata, uint256[] calldata, bytes calldata
    ) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function listItem(
        address collection,
        uint256 itemId,
        uint256 amount,
        uint256 priceInPXL,
        bytes32 gameId
    ) external {
        address seller = _msgSender();

        IERC1155(collection).safeTransferFrom(seller, address(this), itemId, amount, "");

        listings[nextListingId] = Listing({
            seller: seller,
            collection: collection,
            itemId: itemId,
            amount: amount,
            priceInPXL: priceInPXL,
            gameId: gameId,
            active: true
        });

        emit ItemListed(nextListingId, seller, collection, itemId, amount, priceInPXL);
        nextListingId++;
    }

    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.seller == _msgSender(), "Not seller");
        require(listing.active, "Not active");

        listing.active = false;

        IERC1155(listing.collection).safeTransferFrom(
            address(this),
            listing.seller,
            listing.itemId,
            listing.amount,
            ""
        );

        emit ItemCanceled(listingId);
    }

    function buyItem(
        uint256 listingId,
        uint256 amount,
        address paymentToken,
        uint256 maxPayment
    ) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(amount > 0 && amount <= listing.amount, "Invalid amount");

        address buyer = _msgSender();
        uint256 totalPXL = listing.priceInPXL * amount;

        if (paymentToken == address(pxlToken)) {
            // Pay in PXL directly
            pxlToken.safeTransferFrom(buyer, address(this), totalPXL);
        } else {
            // Pay with game token — swap via DEX
            bytes32 paymentGameId = gameRegistry.tokenToGame(paymentToken);
            require(paymentGameId != bytes32(0), "Invalid payment token");

            uint256 gameAmountNeeded = dex.getAmountIn(paymentGameId, totalPXL);
            require(gameAmountNeeded <= maxPayment, "Slippage exceeded");

            IERC20(paymentToken).safeTransferFrom(buyer, address(this), gameAmountNeeded);
            IERC20(paymentToken).approve(address(dex), gameAmountNeeded);
            dex.swapGameForPXL(paymentGameId, gameAmountNeeded, totalPXL);
        }

        // Fee + payment to seller
        uint256 fee = (totalPXL * FEE_BPS) / 10000;
        pxlToken.safeTransfer(feeRecipient, fee);
        pxlToken.safeTransfer(listing.seller, totalPXL - fee);

        // Update listing
        listing.amount -= amount;
        if (listing.amount == 0) {
            listing.active = false;
        }

        // Send item to buyer
        IERC1155(listing.collection).safeTransferFrom(
            address(this),
            buyer,
            listing.itemId,
            amount,
            ""
        );

        emit ItemSold(listingId, buyer, listing.seller, amount, totalPXL);
    }


}
