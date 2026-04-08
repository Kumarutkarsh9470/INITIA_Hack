import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystem } from "./shared/fixtures";

describe("DungeonDrops", function () {
  async function deployDungeon() {
    const f = await loadFixture(deployFullEcosystem);

    // Give alice some DNGN tokens so she can enter dungeons
    // GameToken owner is GameRegistry (which deployed it), so we need to use
    // the tokens that were minted to owner (developer) during registerGame
    await f.dngnToken.transfer(f.alice.address, ethers.parseEther("1000"));

    return f;
  }

  it("should allow a player to enter the dungeon", async function () {
    const { alice, dngnToken, dungeonDrops, dngnAssets } = await deployDungeon();

    // Approve the dungeon to spend DNGN
    await dngnToken.connect(alice).approve(await dungeonDrops.getAddress(), ethers.parseEther("10"));

    await dungeonDrops.connect(alice).enterDungeon();

    // Check entry fee was taken
    expect(await dngnToken.balanceOf(alice.address)).to.equal(ethers.parseEther("990"));

    // Check an item was minted (one of items 1, 2, or 3)
    const bal1 = await dngnAssets.balanceOf(alice.address, 1);
    const bal2 = await dngnAssets.balanceOf(alice.address, 2);
    const bal3 = await dngnAssets.balanceOf(alice.address, 3);
    expect(bal1 + bal2 + bal3).to.equal(1);
  });

  it("should issue first-clear badge on first run", async function () {
    const { alice, dngnToken, dungeonDrops, achievementBadge } = await deployDungeon();

    await dngnToken.connect(alice).approve(await dungeonDrops.getAddress(), ethers.parseEther("10"));
    await dungeonDrops.connect(alice).enterDungeon();

    // Badge ID 1 = BADGE_FIRST_CLEAR
    expect(await achievementBadge.balanceOf(alice.address, 1)).to.equal(1);
  });

  it("should NOT issue first-clear badge on second run", async function () {
    const { alice, dngnToken, dungeonDrops, achievementBadge } = await deployDungeon();

    await dngnToken.connect(alice).approve(await dungeonDrops.getAddress(), ethers.parseEther("20"));
    await dungeonDrops.connect(alice).enterDungeon();
    await dungeonDrops.connect(alice).enterDungeon();

    // Should still only have 1 first-clear badge
    expect(await achievementBadge.balanceOf(alice.address, 1)).to.equal(1);
  });

  it("should increment totalRuns", async function () {
    const { alice, bob, dngnToken, dungeonDrops } = await deployDungeon();

    await dngnToken.transfer(bob.address, ethers.parseEther("100"));

    await dngnToken.connect(alice).approve(await dungeonDrops.getAddress(), ethers.parseEther("20"));
    await dungeonDrops.connect(alice).enterDungeon();
    await dungeonDrops.connect(alice).enterDungeon();

    await dngnToken.connect(bob).approve(await dungeonDrops.getAddress(), ethers.parseEther("10"));
    await dungeonDrops.connect(bob).enterDungeon();

    expect(await dungeonDrops.totalRuns()).to.equal(3);
  });

  it("should revert if player has insufficient DNGN", async function () {
    const { carol, dngnToken, dungeonDrops } = await deployDungeon();

    // Carol has no DNGN
    await dngnToken.connect(carol).approve(await dungeonDrops.getAddress(), ethers.parseEther("10"));
    await expect(dungeonDrops.connect(carol).enterDungeon()).to.be.reverted;
  });

  it("should emit DungeonEntered event", async function () {
    const { alice, dngnToken, dungeonDrops } = await deployDungeon();
    await dngnToken.connect(alice).approve(await dungeonDrops.getAddress(), ethers.parseEther("10"));
    await expect(dungeonDrops.connect(alice).enterDungeon())
      .to.emit(dungeonDrops, "DungeonEntered");
  });

  it("should track player nonce", async function () {
    const { alice, dngnToken, dungeonDrops } = await deployDungeon();
    await dngnToken.connect(alice).approve(await dungeonDrops.getAddress(), ethers.parseEther("30"));
    await dungeonDrops.connect(alice).enterDungeon();
    await dungeonDrops.connect(alice).enterDungeon();
    await dungeonDrops.connect(alice).enterDungeon();
    expect(await dungeonDrops.playerNonce(alice.address)).to.equal(3);
  });
});
