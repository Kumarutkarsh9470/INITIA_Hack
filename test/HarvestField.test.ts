import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, mine } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystem } from "./shared/fixtures";

describe("HarvestField", function () {
  async function deployHarvest() {
    const f = await loadFixture(deployFullEcosystem);

    // Give alice some HRV tokens
    await f.hrvToken.transfer(f.alice.address, ethers.parseEther("1000"));

    // Fund HarvestField contract with reward tokens
    await f.hrvToken.transfer(await f.harvestField.getAddress(), ethers.parseEther("100000"));

    return f;
  }

  describe("Staking", function () {
    it("should stake tokens", async function () {
      const { alice, hrvToken, harvestField } = await deployHarvest();
      const amount = ethers.parseEther("100");
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), amount);
      await harvestField.connect(alice).stake(amount);

      const stake = await harvestField.stakes(alice.address);
      expect(stake.amount).to.equal(amount);
    });

    it("should reject staking 0", async function () {
      const { alice, harvestField } = await deployHarvest();
      await expect(harvestField.connect(alice).stake(0))
        .to.be.revertedWith("Amount must be > 0");
    });

    it("should reject double staking", async function () {
      const { alice, hrvToken, harvestField } = await deployHarvest();
      const amount = ethers.parseEther("100");
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), ethers.parseEther("200"));
      await harvestField.connect(alice).stake(amount);
      await expect(harvestField.connect(alice).stake(amount))
        .to.be.revertedWith("Already staking");
    });
  });

  describe("Harvesting", function () {
    it("should revert if no active stake", async function () {
      const { alice, harvestField } = await deployHarvest();
      await expect(harvestField.connect(alice).harvest())
        .to.be.revertedWith("No active stake");
    });

    it("should revert if harvesting too early", async function () {
      const { alice, hrvToken, harvestField } = await deployHarvest();
      const amount = ethers.parseEther("100");
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), amount);
      await harvestField.connect(alice).stake(amount);

      await expect(harvestField.connect(alice).harvest())
        .to.be.revertedWith("Too early");
    });

    it("should harvest after delay", async function () {
      const { alice, hrvToken, harvestField, hrvAssets, achievementBadge } = await deployHarvest();
      const amount = ethers.parseEther("100");
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), amount);
      await harvestField.connect(alice).stake(amount);

      // Mine 100 blocks to pass HARVEST_DELAY
      await mine(100);

      const balBefore = await hrvToken.balanceOf(alice.address);
      await harvestField.connect(alice).harvest();
      const balAfter = await hrvToken.balanceOf(alice.address);

      // Should get back staked tokens + reward
      expect(balAfter).to.be.gt(balBefore);
      // Amount returned should be >= staked amount (staked + reward)
      expect(balAfter - balBefore).to.be.gte(amount);

      // Should get seasonal item
      expect(await hrvAssets.balanceOf(alice.address, 1)).to.equal(1);

      // Should get first-harvest badge (badge ID 2)
      expect(await achievementBadge.balanceOf(alice.address, 2)).to.equal(1);
    });

    it("should not issue first-harvest badge twice", async function () {
      const { alice, hrvToken, harvestField, achievementBadge } = await deployHarvest();

      // First stake + harvest
      const amount = ethers.parseEther("100");
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), amount);
      await harvestField.connect(alice).stake(amount);
      await mine(100);
      await harvestField.connect(alice).harvest();

      // Second stake + harvest
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), amount);
      await harvestField.connect(alice).stake(amount);
      await mine(100);
      await harvestField.connect(alice).harvest();

      // Should still only have 1 badge
      expect(await achievementBadge.balanceOf(alice.address, 2)).to.equal(1);
    });
  });

  describe("Unstaking", function () {
    it("should allow early unstake without reward", async function () {
      const { alice, hrvToken, harvestField } = await deployHarvest();
      const amount = ethers.parseEther("100");
      await hrvToken.connect(alice).approve(await harvestField.getAddress(), amount);
      await harvestField.connect(alice).stake(amount);

      const balBefore = await hrvToken.balanceOf(alice.address);
      await harvestField.connect(alice).unstake();
      const balAfter = await hrvToken.balanceOf(alice.address);

      // Should get exactly staked amount back, no reward
      expect(balAfter - balBefore).to.equal(amount);

      // Stake should be cleared
      const stake = await harvestField.stakes(alice.address);
      expect(stake.amount).to.equal(0);
    });

    it("should revert unstake if nothing staked", async function () {
      const { alice, harvestField } = await deployHarvest();
      await expect(harvestField.connect(alice).unstake())
        .to.be.revertedWith("No active stake");
    });
  });
});
