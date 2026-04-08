// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IGameRegistry.sol";

contract PixelVaultDEX is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Pool {
        address gameToken;
        uint256 reservePXL;
        uint256 reserveGame;
        bytes32 gameId;
        bool active;
        uint256 totalLiquidity;
    }

    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => mapping(address => uint256)) public lpShares;
    IERC20 public immutable pxlToken;
    IGameRegistry public immutable gameRegistry;

    event PoolCreated(bytes32 indexed gameId, address gameToken, uint256 pxlAmount, uint256 gameAmount);
    event LiquidityAdded(bytes32 indexed gameId, address indexed provider, uint256 pxlAmount, uint256 gameAmount);
    event LiquidityRemoved(bytes32 indexed gameId, address indexed provider, uint256 pxlAmount, uint256 gameAmount);
    event Swap(bytes32 indexed gameId, address indexed trader, bool pxlToGame, uint256 amountIn, uint256 amountOut);

    constructor(address _pxlToken, address _gameRegistry) Ownable(msg.sender) {
        pxlToken = IERC20(_pxlToken);
        gameRegistry = IGameRegistry(_gameRegistry);
    }

    function createPool(
        bytes32 gameId,
        uint256 pxlAmount,
        uint256 gameAmount
    ) external nonReentrant {
        (address tokenAddress,,,,,,,,) = gameRegistry.games(gameId);
        require(tokenAddress != address(0), "Game not found");
        require(!pools[gameId].active, "Pool already exists");
        require(pxlAmount > 0 && gameAmount > 0, "Amounts must be > 0");

        pxlToken.safeTransferFrom(msg.sender, address(this), pxlAmount);
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), gameAmount);

        uint256 liquidity = _sqrt(pxlAmount * gameAmount);

        pools[gameId] = Pool({
            gameToken: tokenAddress,
            reservePXL: pxlAmount,
            reserveGame: gameAmount,
            gameId: gameId,
            active: true,
            totalLiquidity: liquidity
        });

        lpShares[gameId][msg.sender] = liquidity;

        emit PoolCreated(gameId, tokenAddress, pxlAmount, gameAmount);
    }

    function addLiquidity(
        bytes32 gameId,
        uint256 pxlAmount,
        uint256 maxGameAmount
    ) external nonReentrant {
        Pool storage pool = pools[gameId];
        require(pool.active, "Pool not active");

        uint256 gameAmount = (pxlAmount * pool.reserveGame) / pool.reservePXL;
        require(gameAmount <= maxGameAmount, "Slippage exceeded");

        uint256 shares = (pxlAmount * pool.totalLiquidity) / pool.reservePXL;

        pxlToken.safeTransferFrom(msg.sender, address(this), pxlAmount);
        IERC20(pool.gameToken).safeTransferFrom(msg.sender, address(this), gameAmount);

        pool.reservePXL += pxlAmount;
        pool.reserveGame += gameAmount;
        pool.totalLiquidity += shares;
        lpShares[gameId][msg.sender] += shares;

        emit LiquidityAdded(gameId, msg.sender, pxlAmount, gameAmount);
    }

    function removeLiquidity(
        bytes32 gameId,
        uint256 shareAmount
    ) external nonReentrant {
        Pool storage pool = pools[gameId];
        require(lpShares[gameId][msg.sender] >= shareAmount, "Not enough shares");

        uint256 pxlAmount = (shareAmount * pool.reservePXL) / pool.totalLiquidity;
        uint256 gameAmount = (shareAmount * pool.reserveGame) / pool.totalLiquidity;

        pool.reservePXL -= pxlAmount;
        pool.reserveGame -= gameAmount;
        pool.totalLiquidity -= shareAmount;
        lpShares[gameId][msg.sender] -= shareAmount;

        pxlToken.safeTransfer(msg.sender, pxlAmount);
        IERC20(pool.gameToken).safeTransfer(msg.sender, gameAmount);

        emit LiquidityRemoved(gameId, msg.sender, pxlAmount, gameAmount);
    }

    function swapPXLForGame(
        bytes32 gameId,
        uint256 pxlAmountIn,
        uint256 minGameOut
    ) external nonReentrant returns (uint256 gameAmountOut) {
        Pool storage pool = pools[gameId];
        require(pool.active, "Pool not active");
        require(pxlAmountIn > 0, "Amount must be > 0");

        uint256 amountInWithFee = pxlAmountIn * 997;
        gameAmountOut = (amountInWithFee * pool.reserveGame) / (pool.reservePXL * 1000 + amountInWithFee);

        require(gameAmountOut >= minGameOut, "Slippage exceeded");
        require(gameAmountOut > 0, "Insufficient output");

        // Effects first (CEI)
        pool.reservePXL += pxlAmountIn;
        pool.reserveGame -= gameAmountOut;

        // Interactions
        pxlToken.safeTransferFrom(msg.sender, address(this), pxlAmountIn);
        IERC20(pool.gameToken).safeTransfer(msg.sender, gameAmountOut);

        gameRegistry.recordSwap(gameId, pxlAmountIn, msg.sender);

        emit Swap(gameId, msg.sender, true, pxlAmountIn, gameAmountOut);
    }

    function swapGameForPXL(
        bytes32 gameId,
        uint256 gameAmountIn,
        uint256 minPXLOut
    ) external nonReentrant returns (uint256 pxlAmountOut) {
        Pool storage pool = pools[gameId];
        require(pool.active, "Pool not active");
        require(gameAmountIn > 0, "Amount must be > 0");

        uint256 amountInWithFee = gameAmountIn * 997;
        pxlAmountOut = (amountInWithFee * pool.reservePXL) / (pool.reserveGame * 1000 + amountInWithFee);

        require(pxlAmountOut >= minPXLOut, "Slippage exceeded");
        require(pxlAmountOut > 0, "Insufficient output");

        // Effects first (CEI)
        pool.reserveGame += gameAmountIn;
        pool.reservePXL -= pxlAmountOut;

        // Interactions
        IERC20(pool.gameToken).safeTransferFrom(msg.sender, address(this), gameAmountIn);
        pxlToken.safeTransfer(msg.sender, pxlAmountOut);

        gameRegistry.recordSwap(gameId, pxlAmountOut, msg.sender);

        emit Swap(gameId, msg.sender, false, gameAmountIn, pxlAmountOut);
    }

    function getAmountIn(bytes32 gameId, uint256 pxlAmountOut) external view returns (uint256 gameAmountIn) {
        Pool storage pool = pools[gameId];
        require(pool.active, "Pool not active");
        require(pxlAmountOut < pool.reservePXL, "Exceeds reserves");

        gameAmountIn = (pool.reserveGame * pxlAmountOut * 1000) / ((pool.reservePXL - pxlAmountOut) * 997) + 1;
    }

    function getPrice(bytes32 gameId) external view returns (uint256 pxlPerGame) {
        Pool storage pool = pools[gameId];
        require(pool.active, "Pool not active");
        pxlPerGame = (pool.reservePXL * 1e18) / pool.reserveGame;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
