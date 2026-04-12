// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BarterMarket
 * @notice Direct item-for-item exchange across any registered game collection.
 *         No PXL required — players post "I offer X, I want Y" and anyone can fill.
 */
contract BarterMarket is ReentrancyGuard, IERC1155Receiver {

    struct BarterOffer {
        address offerer;
        address offeredCollection;
        uint256 offeredItemId;
        uint256 offeredAmount;
        address wantedCollection;
        uint256 wantedItemId;
        uint256 wantedAmount;
        bool active;
    }

    mapping(uint256 => BarterOffer) public offers;
    uint256 public nextOfferId;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed offerer,
        address offeredCollection, uint256 offeredItemId, uint256 offeredAmount,
        address wantedCollection,  uint256 wantedItemId,  uint256 wantedAmount
    );
    event OfferFilled(uint256 indexed offerId, address indexed taker);
    event OfferCancelled(uint256 indexed offerId);

    /// @notice Create a barter offer. Offered items are escrowed in the contract.
    function createOffer(
        address offeredCollection,
        uint256 offeredItemId,
        uint256 offeredAmount,
        address wantedCollection,
        uint256 wantedItemId,
        uint256 wantedAmount
    ) external nonReentrant returns (uint256 offerId) {
        require(offeredAmount > 0 && wantedAmount > 0, "Amounts must be > 0");
        require(offeredCollection != address(0) && wantedCollection != address(0), "Invalid collection");

        // Pull offered items into escrow
        IERC1155(offeredCollection).safeTransferFrom(
            msg.sender, address(this), offeredItemId, offeredAmount, ""
        );

        offerId = nextOfferId++;
        offers[offerId] = BarterOffer({
            offerer:           msg.sender,
            offeredCollection: offeredCollection,
            offeredItemId:     offeredItemId,
            offeredAmount:     offeredAmount,
            wantedCollection:  wantedCollection,
            wantedItemId:      wantedItemId,
            wantedAmount:      wantedAmount,
            active:            true
        });

        emit OfferCreated(
            offerId, msg.sender,
            offeredCollection, offeredItemId, offeredAmount,
            wantedCollection,  wantedItemId,  wantedAmount
        );
    }

    /// @notice Fill an existing barter offer. Taker sends wanted items → offerer, gets escrowed items.
    function fillOffer(uint256 offerId) external nonReentrant {
        BarterOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(offer.offerer != msg.sender, "Cannot fill own offer");

        offer.active = false;

        // Pull wanted items from taker → offerer
        IERC1155(offer.wantedCollection).safeTransferFrom(
            msg.sender, offer.offerer,
            offer.wantedItemId, offer.wantedAmount, ""
        );

        // Send escrowed items to taker
        IERC1155(offer.offeredCollection).safeTransferFrom(
            address(this), msg.sender,
            offer.offeredItemId, offer.offeredAmount, ""
        );

        emit OfferFilled(offerId, msg.sender);
    }

    /// @notice Cancel an offer and return escrowed items to the offerer.
    function cancelOffer(uint256 offerId) external nonReentrant {
        BarterOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(offer.offerer == msg.sender, "Not offerer");

        offer.active = false;

        // Return escrowed items
        IERC1155(offer.offeredCollection).safeTransferFrom(
            address(this), msg.sender,
            offer.offeredItemId, offer.offeredAmount, ""
        );

        emit OfferCancelled(offerId);
    }

    // ── ERC1155 receiver hooks ─────────────────────────────────────────────
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
