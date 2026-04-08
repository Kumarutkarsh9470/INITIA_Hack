// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPixelVaultDEX.sol";
import "./interfaces/IGameRegistry.sol";

contract GasPaymaster is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable pxlToken;
    IPixelVaultDEX public immutable dex;
    IGameRegistry public immutable gameRegistry;

    uint256 public constant MAX_GAS_TOKEN_AMOUNT = 10_000 * 1e18;

    event GasSponsored(
        address indexed playerTBA,
        address indexed gameToken,
        uint256 tokensProvided,
        uint256 pxlReceived,
        address target,
        bool success
    );

    constructor(address _pxlToken, address _dex, address _gameRegistry) {
        pxlToken = IERC20(_pxlToken);
        dex = IPixelVaultDEX(_dex);
        gameRegistry = IGameRegistry(_gameRegistry);
    }

    function executeWithGameToken(
        address gameToken,
        uint256 maxGameTokens,
        address target,
        bytes calldata data
    ) external nonReentrant {
        address playerTBA = msg.sender;

        // Safety checks
        require(gameRegistry.isRegistered(gameToken), "Token not registered");
        require(maxGameTokens > 0 && maxGameTokens <= MAX_GAS_TOKEN_AMOUNT, "Invalid token amount");
        require(target != address(this), "Cannot self-call");

        // Take game tokens from player
        IERC20(gameToken).safeTransferFrom(playerTBA, address(this), maxGameTokens);

        // Swap game tokens to PXL via DEX
        bytes32 gameId = gameRegistry.tokenToGame(gameToken);
        IERC20(gameToken).approve(address(dex), maxGameTokens);
        uint256 pxlReceived = dex.swapGameForPXL(gameId, maxGameTokens, 0);

        // Record PXL balance before forwarding
        uint256 pxlBefore = pxlToken.balanceOf(address(this));

        // Forward call with player address appended (EIP-2771)
        bytes memory forwardData = abi.encodePacked(data, playerTBA);
        (bool success, bytes memory returnData) = target.call(forwardData);

        // Calculate and refund unused PXL
        uint256 pxlAfter = pxlToken.balanceOf(address(this));
        uint256 pxlUsed = pxlBefore > pxlAfter ? pxlBefore - pxlAfter : 0;
        uint256 pxlRefund = pxlReceived > pxlUsed ? pxlReceived - pxlUsed : 0;

        if (pxlRefund > 0) {
            pxlToken.safeTransfer(playerTBA, pxlRefund);
        }

        emit GasSponsored(playerTBA, gameToken, maxGameTokens, pxlReceived, target, success);

        // Re-throw original error if forwarded call failed
        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
    }
}
