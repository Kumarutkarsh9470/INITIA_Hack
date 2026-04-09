// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPixelVaultDEX {
    function swapGameForPXL(bytes32 gameId, uint256 gameAmountIn, uint256 minPXLOut) external returns (uint256);
}

interface IGameRegistry {
    function isRegistered(address token) external view returns (bool);
    function tokenToGame(address token) external view returns (bytes32);
}

contract GasPaymaster is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable pxlToken;
    IPixelVaultDEX public immutable dex;
    IGameRegistry public immutable gameRegistry;

    uint256 public constant MAX_GAS_TOKEN_AMOUNT = 10_000 * 1e18;

    event GasSponsored(address indexed playerTBA, address indexed gameToken, uint256 tokensProvided, uint256 pxlReceived, address target, bool success);

    constructor(address _pxlToken, address _dex, address _gameRegistry) {
        pxlToken = IERC20(_pxlToken);
        dex = IPixelVaultDEX(_dex);
        gameRegistry = IGameRegistry(_gameRegistry);
    }

    /**
     * @notice Forwards a call to another contract while charging the player in game tokens.
     */
    function executeWithGameToken(address gameToken, uint256 maxGameTokens, address target, bytes calldata data) external nonReentrant {
        address playerTBA = msg.sender;

        // Safety checks
        require(gameRegistry.isRegistered(gameToken), "Game token not registered");
        require(maxGameTokens <= MAX_GAS_TOKEN_AMOUNT && maxGameTokens > 0, "Invalid token amount");
        require(target != address(this), "Cannot self-call");

        // Take game tokens from the player
        IERC20(gameToken).safeTransferFrom(playerTBA, address(this), maxGameTokens);

        // Swap game tokens to PXL
        bytes32 gameId = gameRegistry.tokenToGame(gameToken);
        IERC20(gameToken).approve(address(dex), maxGameTokens);
        uint256 pxlReceived = dex.swapGameForPXL(gameId, maxGameTokens, 1);

        // Record balance before the call
        uint256 pxlBefore = pxlToken.balanceOf(address(this));

        // Forward the call using the EIP-2771 trick
        bytes memory forwardData = abi.encodePacked(data, playerTBA);
        (bool success, bytes memory returnData) = target.call(forwardData);

        // Calculate and refund unused PXL
        uint256 pxlAfter = pxlToken.balanceOf(address(this));
        uint256 pxlUsed = pxlBefore > pxlAfter ? pxlBefore - pxlAfter : 0;
        uint256 pxlRefund = pxlReceived > pxlUsed ? pxlReceived - pxlUsed : 0;

        if (pxlRefund > 0) {
            pxlToken.safeTransfer(playerTBA, pxlRefund);
        }

        emit GasSponsored(playerTBA, gameToken, pxlUsed, pxlReceived, target, success);

        // Re-throw the original error if the call failed [cite: 1019-1026]
        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
    }
}