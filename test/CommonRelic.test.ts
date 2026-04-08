import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("CommonRelic", function () {
  async function deployRelic() {
    const [owner, alice] = await ethers.getSigners();

    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    const gameRegistry = await GameRegistry.deploy();

    await gameRegistry.registerGame("TestGame", "TG", owner.address, 0);
    const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));

    const CommonRelic = await ethers.getContractFactory("CommonRelic");
    const commonRelic = await CommonRelic.deploy(await gameRegistry.getAddress());

    return { owner, alice, gameRegistry, commonRelic, gameId };
  }

  it("should have correct base values", async function () {
    const { commonRelic } = await loadFixture(deployRelic);
    expect(await commonRelic.getBaseValue(1)).to.equal(ethers.parseEther("10")); // Common
    expect(await commonRelic.getBaseValue(2)).to.equal(ethers.parseEther("50")); // Rare
    expect(await commonRelic.getBaseValue(3)).to.equal(ethers.parseEther("200")); // Legendary
  });

  it("should mint relics (owner only)", async function () {
    const { owner, alice, commonRelic } = await loadFixture(deployRelic);
    await commonRelic.mint(alice.address, 1, 5);
    expect(await commonRelic.balanceOf(alice.address, 1)).to.equal(5);
  });

  it("should reject minting from non-owner", async function () {
    const { alice, commonRelic } = await loadFixture(deployRelic);
    await expect(commonRelic.connect(alice).mint(alice.address, 1, 5)).to.be.reverted;
  });

  it("should reject invalid relic type", async function () {
    const { owner, commonRelic } = await loadFixture(deployRelic);
    await expect(commonRelic.mint(owner.address, 0, 1))
      .to.be.revertedWith("Invalid relic type");
    await expect(commonRelic.mint(owner.address, 4, 1))
      .to.be.revertedWith("Invalid relic type");
  });

  it("should scale relic value by game rating", async function () {
    const { commonRelic, gameId } = await loadFixture(deployRelic);
    // New game has rating 100, so value = base * 100 / 500 = base / 5
    const value = await commonRelic.getRelicValueInGame(1, gameId);
    expect(value).to.equal(ethers.parseEther("2")); // 10 * 100 / 500 = 2
  });

  it("should return 0 for non-existent game", async function () {
    const { commonRelic } = await loadFixture(deployRelic);
    const fakeGameId = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));
    expect(await commonRelic.getRelicValueInGame(1, fakeGameId)).to.equal(0);
  });
});
