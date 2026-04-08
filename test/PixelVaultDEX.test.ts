import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PixelVaultDEX", function () {
  async function deployDEX() {
    const [owner, alice, bob] = await ethers.getSigners();

    const PXLToken = await ethers.getContractFactory("PXLToken");
    const pxlToken = await PXLToken.deploy(owner.address);

    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    const gameRegistry = await GameRegistry.deploy();

    const PixelVaultDEX = await ethers.getContractFactory("PixelVaultDEX");
    const dex = await PixelVaultDEX.deploy(
      await pxlToken.getAddress(),
      await gameRegistry.getAddress()
    );

    await gameRegistry.setTrustedDEX(await dex.getAddress());

    // Register a game with initial supply to owner
    await gameRegistry.registerGame("TestGame", "TG", owner.address, ethers.parseEther("1000000"));
    const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
    const gameData = await gameRegistry.games(gameId);
    const gameToken = await ethers.getContractAt("GameToken", gameData[0]);

    // Give alice and bob some tokens
    await pxlToken.transfer(alice.address, ethers.parseEther("100000"));
    await pxlToken.transfer(bob.address, ethers.parseEther("100000"));
    await gameToken.transfer(alice.address, ethers.parseEther("100000"));
    await gameToken.transfer(bob.address, ethers.parseEther("100000"));

    return { owner, alice, bob, pxlToken, gameRegistry, dex, gameToken, gameId };
  }

  describe("Pool creation", function () {
    it("should create a pool", async function () {
      const { owner, pxlToken, dex, gameToken, gameId } = await loadFixture(deployDEX);
      const pxlAmt = ethers.parseEther("10000");
      const gameAmt = ethers.parseEther("10000");

      await pxlToken.approve(await dex.getAddress(), pxlAmt);
      await gameToken.approve(await dex.getAddress(), gameAmt);
      await dex.createPool(gameId, pxlAmt, gameAmt);

      const pool = await dex.pools(gameId);
      expect(pool.active).to.be.true;
      expect(pool.reservePXL).to.equal(pxlAmt);
      expect(pool.reserveGame).to.equal(gameAmt);
    });

    it("should reject duplicate pool", async function () {
      const { owner, pxlToken, dex, gameToken, gameId } = await loadFixture(deployDEX);
      const amt = ethers.parseEther("1000");
      await pxlToken.approve(await dex.getAddress(), amt);
      await gameToken.approve(await dex.getAddress(), amt);
      await dex.createPool(gameId, amt, amt);

      await pxlToken.approve(await dex.getAddress(), amt);
      await gameToken.approve(await dex.getAddress(), amt);
      await expect(dex.createPool(gameId, amt, amt))
        .to.be.revertedWith("Pool already exists");
    });

    it("should reject zero amounts", async function () {
      const { dex, gameId } = await loadFixture(deployDEX);
      await expect(dex.createPool(gameId, 0, ethers.parseEther("100")))
        .to.be.revertedWith("Amounts must be > 0");
    });
  });

  describe("Swaps", function () {
    async function deployWithPool() {
      const f = await loadFixture(deployDEX);
      const pxlAmt = ethers.parseEther("10000");
      const gameAmt = ethers.parseEther("10000");
      await f.pxlToken.approve(await f.dex.getAddress(), pxlAmt);
      await f.gameToken.approve(await f.dex.getAddress(), gameAmt);
      await f.dex.createPool(f.gameId, pxlAmt, gameAmt);
      return f;
    }

    it("should swap PXL for game tokens", async function () {
      const { alice, pxlToken, dex, gameToken, gameId } = await deployWithPool();
      const swapAmt = ethers.parseEther("100");
      await pxlToken.connect(alice).approve(await dex.getAddress(), swapAmt);

      const balBefore = await gameToken.balanceOf(alice.address);
      await dex.connect(alice).swapPXLForGame(gameId, swapAmt, 0);
      const balAfter = await gameToken.balanceOf(alice.address);

      expect(balAfter).to.be.gt(balBefore);
    });

    it("should swap game tokens for PXL", async function () {
      const { alice, pxlToken, dex, gameToken, gameId } = await deployWithPool();
      const swapAmt = ethers.parseEther("100");
      await gameToken.connect(alice).approve(await dex.getAddress(), swapAmt);

      const balBefore = await pxlToken.balanceOf(alice.address);
      await dex.connect(alice).swapGameForPXL(gameId, swapAmt, 0);
      const balAfter = await pxlToken.balanceOf(alice.address);

      expect(balAfter).to.be.gt(balBefore);
    });

    it("should apply 0.3% fee on swaps", async function () {
      const { alice, pxlToken, dex, gameToken, gameId } = await deployWithPool();
      // With equal reserves 10k:10k and swapping 100 PXL
      // amountInWithFee = 100 * 997 = 99700
      // output = 99700 * 10000 / (10000*1000 + 99700) ≈ 98.71 (less than 100 due to fee+slippage)
      const swapAmt = ethers.parseEther("100");
      await pxlToken.connect(alice).approve(await dex.getAddress(), swapAmt);

      const balBefore = await gameToken.balanceOf(alice.address);
      await dex.connect(alice).swapPXLForGame(gameId, swapAmt, 0);
      const received = (await gameToken.balanceOf(alice.address)) - balBefore;

      // Should be less than input (fee + impact)
      expect(received).to.be.lt(swapAmt);
      expect(received).to.be.gt(ethers.parseEther("98")); // roughly 98.7
    });

    it("should revert on slippage protection", async function () {
      const { alice, pxlToken, dex, gameId } = await deployWithPool();
      const swapAmt = ethers.parseEther("100");
      await pxlToken.connect(alice).approve(await dex.getAddress(), swapAmt);

      // min output = 100e18 (way too high)
      await expect(
        dex.connect(alice).swapPXLForGame(gameId, swapAmt, ethers.parseEther("100"))
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("should record swap on GameRegistry", async function () {
      const { alice, pxlToken, dex, gameToken, gameId, gameRegistry } = await deployWithPool();
      const swapAmt = ethers.parseEther("100");
      await pxlToken.connect(alice).approve(await dex.getAddress(), swapAmt);
      await dex.connect(alice).swapPXLForGame(gameId, swapAmt, 0);

      const data = await gameRegistry.games(gameId);
      expect(data[5]).to.be.gt(0); // totalVolume recorded
      expect(data[6]).to.equal(1); // uniquePlayers
    });

    it("getAmountIn should return correct amount", async function () {
      const { dex, gameId } = await deployWithPool();
      const pxlOut = ethers.parseEther("100");
      const gameIn = await dex.getAmountIn(gameId, pxlOut);
      expect(gameIn).to.be.gt(pxlOut); // need more due to fee
    });

    it("getPrice should return spot price", async function () {
      const { dex, gameId } = await deployWithPool();
      const price = await dex.getPrice(gameId);
      // Equal reserves → 1:1 → price = 1e18
      expect(price).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Liquidity", function () {
    async function deployWithPool() {
      const f = await loadFixture(deployDEX);
      const pxlAmt = ethers.parseEther("10000");
      const gameAmt = ethers.parseEther("10000");
      await f.pxlToken.approve(await f.dex.getAddress(), pxlAmt);
      await f.gameToken.approve(await f.dex.getAddress(), gameAmt);
      await f.dex.createPool(f.gameId, pxlAmt, gameAmt);
      return f;
    }

    it("should add liquidity proportionally", async function () {
      const { alice, pxlToken, dex, gameToken, gameId } = await deployWithPool();
      const pxlAmt = ethers.parseEther("1000");
      const maxGame = ethers.parseEther("1100"); // generous max

      await pxlToken.connect(alice).approve(await dex.getAddress(), pxlAmt);
      await gameToken.connect(alice).approve(await dex.getAddress(), maxGame);

      await dex.connect(alice).addLiquidity(gameId, pxlAmt, maxGame);

      const shares = await dex.lpShares(gameId, alice.address);
      expect(shares).to.be.gt(0);
    });

    it("should remove liquidity and get tokens back", async function () {
      const { owner, pxlToken, dex, gameToken, gameId } = await deployWithPool();

      const shares = await dex.lpShares(gameId, owner.address);
      expect(shares).to.be.gt(0);

      const pxlBefore = await pxlToken.balanceOf(owner.address);
      const gameBefore = await gameToken.balanceOf(owner.address);

      await dex.removeLiquidity(gameId, shares);

      const pxlAfter = await pxlToken.balanceOf(owner.address);
      const gameAfter = await gameToken.balanceOf(owner.address);

      expect(pxlAfter).to.be.gt(pxlBefore);
      expect(gameAfter).to.be.gt(gameBefore);
    });

    it("should reject removing more shares than owned", async function () {
      const { alice, dex, gameId } = await deployWithPool();
      await expect(dex.connect(alice).removeLiquidity(gameId, ethers.parseEther("1")))
        .to.be.revertedWith("Not enough shares");
    });
  });
});
