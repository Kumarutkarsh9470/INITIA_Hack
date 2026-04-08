import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("AchievementBadge", function () {
  async function deployBadge() {
    const [owner, alice, issuer] = await ethers.getSigners();

    const AchievementBadge = await ethers.getContractFactory("AchievementBadge");
    const badge = await AchievementBadge.deploy();

    const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
    await badge.grantRole(ISSUER_ROLE, issuer.address);

    const gameId1 = ethers.keccak256(ethers.toUtf8Bytes("Game1"));
    const gameId2 = ethers.keccak256(ethers.toUtf8Bytes("Game2"));

    await badge.defineBadge(1, gameId1, "ipfs://badge1");
    await badge.defineBadge(2, gameId2, "ipfs://badge2");
    await badge.defineBadge(3, gameId1, "ipfs://badge3");

    return { owner, alice, issuer, badge, ISSUER_ROLE, gameId1, gameId2 };
  }

  it("should issue badges from ISSUER_ROLE", async function () {
    const { alice, issuer, badge } = await loadFixture(deployBadge);
    await badge.connect(issuer).issueBadge(alice.address, 1);
    expect(await badge.balanceOf(alice.address, 1)).to.equal(1);
  });

  it("should reject issue from non-issuer", async function () {
    const { alice, badge } = await loadFixture(deployBadge);
    await expect(badge.connect(alice).issueBadge(alice.address, 1)).to.be.reverted;
  });

  it("should be soulbound (non-transferable)", async function () {
    const { alice, issuer, badge, owner } = await loadFixture(deployBadge);
    await badge.connect(issuer).issueBadge(alice.address, 1);
    await expect(
      badge.connect(alice).safeTransferFrom(alice.address, owner.address, 1, 1, "0x")
    ).to.be.revertedWith("Badges are non-transferable");
  });

  it("should be soulbound (batch non-transferable)", async function () {
    const { alice, issuer, badge, owner } = await loadFixture(deployBadge);
    await badge.connect(issuer).issueBadge(alice.address, 1);
    await expect(
      badge.connect(alice).safeBatchTransferFrom(alice.address, owner.address, [1], [1], "0x")
    ).to.be.revertedWith("Badges are non-transferable");
  });

  it("should track badge count", async function () {
    const { alice, issuer, badge } = await loadFixture(deployBadge);
    await badge.connect(issuer).issueBadge(alice.address, 1);
    await badge.connect(issuer).issueBadge(alice.address, 2);
    expect(await badge.playerBadgeCount(alice.address)).to.equal(2);
  });

  it("should track unique games", async function () {
    const { alice, issuer, badge } = await loadFixture(deployBadge);
    await badge.connect(issuer).issueBadge(alice.address, 1); // Game1
    await badge.connect(issuer).issueBadge(alice.address, 3); // Game1 again
    await badge.connect(issuer).issueBadge(alice.address, 2); // Game2

    expect(await badge.playerBadgeCount(alice.address)).to.equal(3);
    expect(await badge.playerUniqueGames(alice.address)).to.equal(2);
  });

  it("should compute reputation correctly", async function () {
    const { alice, issuer, badge } = await loadFixture(deployBadge);
    // rep = badges*10 + uniqueGames*50
    await badge.connect(issuer).issueBadge(alice.address, 1); // Game1
    await badge.connect(issuer).issueBadge(alice.address, 2); // Game2
    // 2 badges, 2 unique games → 2*10 + 2*50 = 120
    expect(await badge.getReputation(alice.address)).to.equal(120);
  });

  it("should return badge URI", async function () {
    const { badge } = await loadFixture(deployBadge);
    expect(await badge.uri(1)).to.equal("ipfs://badge1");
  });
});
