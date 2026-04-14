// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./initia/ICosmos.sol";

/**
 * @title CosmoBridge
 * @notice Bridges ERC20 tokens and ERC1155 NFTs from MiniEVM to Initia L1 via IBC.
 *         Uses the Cosmos precompile at 0xF1 to execute IBC transfer messages.
 *
 * Channels (configured at chain launch):
 *   - channel-0: IBC token transfer (port: transfer)
 *   - channel-1: IBC NFT transfer   (port: nft-transfer)
 */
contract CosmoBridge is ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant IBC_TOKEN_CHANNEL = "channel-0";
    string public constant IBC_NFT_CHANNEL = "channel-1";
    uint64 public constant DEFAULT_GAS_LIMIT = 300_000;

    // Timeout: 10 minutes from current block timestamp (in nanoseconds)
    uint64 public constant TIMEOUT_OFFSET_NS = 10 * 60 * 1_000_000_000;

    event TokenBridged(
        address indexed sender,
        address indexed token,
        string denom,
        uint256 amount,
        string receiver
    );

    event NFTBridged(
        address indexed sender,
        address indexed collection,
        uint256 tokenId,
        uint256 amount,
        string receiver
    );

    /**
     * @notice Bridge ERC20 tokens to Initia L1 via IBC transfer.
     * @param token     ERC20 token address to bridge
     * @param amount    Amount to bridge
     * @param receiver  Bech32 address on L1 (e.g. "init1abc...")
     */
    function bridgeTokenToL1(
        address token,
        uint256 amount,
        string calldata receiver
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(receiver).length > 0, "Invalid receiver");

        // Get the Cosmos denom for this ERC20
        string memory denom = COSMOS_CONTRACT.to_denom(token);
        require(bytes(denom).length > 0, "Token not registered with Cosmos bank");

        // Get sender's Cosmos address
        string memory senderCosmos = COSMOS_CONTRACT.to_cosmos_address(msg.sender);

        // Calculate timeout timestamp (nanoseconds)
        uint64 timeoutTimestamp = uint64(block.timestamp) * 1_000_000_000 + TIMEOUT_OFFSET_NS;

        // Build IBC MsgTransfer JSON
        string memory ibcMsg = string(
            abi.encodePacked(
                '{"@type":"/ibc.applications.transfer.v1.MsgTransfer",',
                '"source_port":"transfer",',
                '"source_channel":"', IBC_TOKEN_CHANNEL, '",',
                '"token":{"denom":"', denom, '","amount":"', _uint2str(amount), '"},',
                '"sender":"', senderCosmos, '",',
                '"receiver":"', receiver, '",',
                '"timeout_height":{"revision_number":"0","revision_height":"0"},',
                '"timeout_timestamp":"', _uint2str(uint256(timeoutTimestamp)), '",',
                '"memo":""}'
            )
        );

        // Execute the IBC transfer via Cosmos precompile
        COSMOS_CONTRACT.execute_cosmos(ibcMsg, DEFAULT_GAS_LIMIT);

        emit TokenBridged(msg.sender, token, denom, amount, receiver);
    }

    /**
     * @notice Bridge an ERC1155 game item (NFT) to Initia L1 via IBC NFT transfer.
     * @param collection  ERC1155 collection address
     * @param tokenId     Token ID to bridge
     * @param amount      Amount (for semi-fungible items)
     * @param receiver    Bech32 address on L1
     */
    function bridgeNFTToL1(
        address collection,
        uint256 tokenId,
        uint256 amount,
        string calldata receiver
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(receiver).length > 0, "Invalid receiver");

        // Transfer the NFT to this contract first (lock it)
        IERC1155(collection).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        // Get sender's Cosmos address
        string memory senderCosmos = COSMOS_CONTRACT.to_cosmos_address(msg.sender);

        // Get the Cosmos denom for the collection
        string memory classId = COSMOS_CONTRACT.to_denom(collection);

        // Calculate timeout
        uint64 timeoutTimestamp = uint64(block.timestamp) * 1_000_000_000 + TIMEOUT_OFFSET_NS;

        // Build ICS-721 NFT Transfer message
        string memory nftMsg = string(
            abi.encodePacked(
                '{"@type":"/ibc.applications.nft_transfer.v1.MsgTransfer",',
                '"source_port":"nft-transfer",',
                '"source_channel":"', IBC_NFT_CHANNEL, '",',
                '"class_id":"', classId, '",',
                '"token_ids":["', _uint2str(tokenId), '"],',
                '"sender":"', senderCosmos, '",',
                '"receiver":"', receiver, '",',
                '"timeout_height":{"revision_number":"0","revision_height":"0"},',
                '"timeout_timestamp":"', _uint2str(uint256(timeoutTimestamp)), '",',
                '"memo":""}'
            )
        );

        COSMOS_CONTRACT.execute_cosmos(nftMsg, DEFAULT_GAS_LIMIT);

        emit NFTBridged(msg.sender, collection, tokenId, amount, receiver);
    }

    /**
     * @notice Get the Cosmos denom for an ERC20 token.
     */
    function getTokenDenom(address token) external view returns (string memory) {
        return COSMOS_CONTRACT.to_denom(token);
    }

    /**
     * @notice Get the Cosmos address for an EVM address.
     */
    function getCosmosAddress(address evmAddr) external view returns (string memory) {
        return COSMOS_CONTRACT.to_cosmos_address(evmAddr);
    }

    /**
     * @notice Convert uint to string for JSON construction.
     */
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // Required for receiving ERC1155 NFTs
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
