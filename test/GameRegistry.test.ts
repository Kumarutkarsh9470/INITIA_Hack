import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GameRegistry", function () {
  async function deployGameRegistry() {
    const [owner, alice, dev1, dev2] = await ethers.getSigners();
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    const gameRegistry = await GameRegistry.deploy();
    return { owner, alice, dev1, dev2, gameRegistry };
  }

  describe("Game registration", function () {
    it("should register a game and return token + assets addresses", async function () {
      const { owner, dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      const tx = await gameRegistry.registerGame("TestGame", "TG", dev1.address, ethers.parseEther("500000"));
      await tx.wait();

      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      const data = await gameRegistry.games(gameId);
      expect(data[0]).to.not.equal(ethers.ZeroAddress); // tokenAddress
      expect(data[1]).to.not.equal(ethers.ZeroAddress); // assetCollection
      expect(data[3]).to.equal("TestGame"); // name
      expect(data[8]).to.equal(true); // active
    });

    it("should deploy a GameToken with correct initial supply", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      const tx = await gameRegistry.registerGame("TestGame", "TG", dev1.address, ethers.parseEther("500000"));
      await tx.wait();

      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      const data = await gameRegistry.games(gameId);
      const token = await ethers.getContractAt("GameToken", data[0]);

      expect(await token.name()).to.equal("TestGame");
      expect(await token.symbol()).to.equal("TG");
      expect(await token.balanceOf(dev1.address)).to.equal(ethers.parseEther("500000"));
    });

    it("should reject duplicate game registration", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      await expect(gameRegistry.registerGame("TestGame", "TG2", dev1.address, 0))
        .to.be.revertedWith("Game already exists");
    });

    it("should only allow owner to register games", async function () {
      const { alice, dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await expect(
        gameRegistry.connect(alice).registerGame("TestGame", "TG", dev1.address, 0)
      ).to.be.reverted;
    });

    it("should track game count", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("Game1", "G1", dev1.address, 0);
      await gameRegistry.registerGame("Game2", "G2", dev1.address, 0);
      expect(await gameRegistry.getGameCount()).to.equal(2);
    });

    it("should mark token as registered", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      const data = await gameRegistry.games(gameId);
      expect(await gameRegistry.isRegistered(data[0])).to.be.true;
    });
  });

  describe("Trusted DEX & swap recording", function () {
    it("should set trusted DEX", async function () {
      const { alice, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.setTrustedDEX(alice.address);
      expect(await gameRegistry.trustedDEX()).to.equal(alice.address);
    });

    it("should record swaps from trusted DEX", async function () {
      const { alice, dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      await gameRegistry.setTrustedDEX(alice.address);

      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      await gameRegistry.connect(alice).recordSwap(gameId, ethers.parseEther("100"), dev1.address);

      const data = await gameRegistry.games(gameId);
      expect(data[5]).to.equal(ethers.parseEther("100")); // totalVolume
      expect(data[6]).to.equal(1); // uniquePlayers
    });

    it("should reject recordSwap from non-DEX", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      await expect(
        gameRegistry.recordSwap(gameId, ethers.parseEther("100"), dev1.address)
      ).to.be.revertedWith("Only trusted DEX can record swaps");
    });

    it("should count unique players correctly", async function () {
      const { alice, dev1, dev2, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      await gameRegistry.setTrustedDEX(alice.address);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));

      await gameRegistry.connect(alice).recordSwap(gameId, ethers.parseEther("100"), dev1.address);
      await gameRegistry.connect(alice).recordSwap(gameId, ethers.parseEther("200"), dev1.address); // same player
      await gameRegistry.connect(alice).recordSwap(gameId, ethers.parseEther("50"), dev2.address); // new player

      const data = await gameRegistry.games(gameId);
      expect(data[5]).to.equal(ethers.parseEther("350")); // totalVolume
      expect(data[6]).to.equal(2); // uniquePlayers = 2
    });
  });

  describe("Game rating", function () {
    it("should return 100 for new game (minimum)", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      expect(await gameRegistry.getGameRating(gameId)).to.equal(100);
    });

    it("should return 0 for non-existent game", async function () {
      const { gameRegistry } = await loadFixture(deployGameRegistry);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));
      expect(await gameRegistry.getGameRating(gameId)).to.equal(0);
    });

    it("should return 0 for paused game", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      await gameRegistry.pauseGame(gameId);
      expect(await gameRegistry.getGameRating(gameId)).to.equal(0);
    });

    it("should increase rating with volume and players", async function () {
      const { alice, dev1, dev2, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      await gameRegistry.setTrustedDEX(alice.address);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));

      // Need volScore * playerScore > 25 to exceed minimum 100
      // log2(1_000_000 + 1) ≈ 19, need many unique players too
      // Use many unique signers by recording from multiple addresses
      const signers = await ethers.getSigners();
      for (let i = 0; i < 10; i++) {
        await gameRegistry.connect(alice).recordSwap(
          gameId,
          ethers.parseEther("100000"),
          signers[i % signers.length].address
        );
      }

      const rating = await gameRegistry.getGameRating(gameId);
      expect(rating).to.be.gt(100);
    });
  });

  describe("Pause / Resume", function () {
    it("should pause a game", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      await expect(gameRegistry.pauseGame(gameId)).to.emit(gameRegistry, "GamePaused");
      const data = await gameRegistry.games(gameId);
      expect(data[8]).to.be.false; // active
    });

    it("should resume a game", async function () {
      const { dev1, gameRegistry } = await loadFixture(deployGameRegistry);
      await gameRegistry.registerGame("TestGame", "TG", dev1.address, 0);
      const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
      await gameRegistry.pauseGame(gameId);
      await expect(gameRegistry.resumeGame(gameId)).to.emit(gameRegistry, "GameResumed");
      const data = await gameRegistry.games(gameId);
      expect(data[8]).to.be.true;
    });
  });
});
