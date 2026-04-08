import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystem } from "./shared/fixtures";

describe("Marketplace", function () {
  async function deployMarketplace() {
    const f = await loadFixture(deployFullEcosystem);

    // Setup: owner defines items and mints some to alice for listing
    // dngnAssets items are already defined (1, 2, 3) in the fixture
    // Grant GAME_ROLE to owner so we can mint test items
    const GAME_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GAME_ROLE"));
    await f.dngnAssets.grantRole(GAME_ROLE, f.owner.address);
    await f.dngnAssets.mintItem(f.alice.address, 1, 10); // 10 swords to alice

    // Give bob PXL for buying
    await f.pxlToken.transfer(f.bob.address, ethers.parseEther("10000"));

    return f;
  }

  describe("Listing", function () {
    it("should list an item", async function () {
      const { alice, dngnAssets, marketplace, dungeonGameId } = await deployMarketplace();

      // Approve marketplace to transfer NFTs
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(),
        1, // itemId
        5, // amount
        ethers.parseEther("100"), // 100 PXL each
        dungeonGameId
      );

      const listing = await marketplace.listings(0);
      expect(listing.seller).to.equal(alice.address);
      expect(listing.amount).to.equal(5);
      expect(listing.priceInPXL).to.equal(ethers.parseEther("100"));
      expect(listing.active).to.be.true;
    });

    it("should transfer listed items to marketplace", async function () {
      const { alice, dngnAssets, marketplace, dungeonGameId } = await deployMarketplace();
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 5, ethers.parseEther("100"), dungeonGameId
      );

      // Alice should have 5 less, marketplace should hold 5
      expect(await dngnAssets.balanceOf(alice.address, 1)).to.equal(5);
      expect(await dngnAssets.balanceOf(await marketplace.getAddress(), 1)).to.equal(5);
    });
  });

  describe("Cancel listing", function () {
    it("should cancel and return items", async function () {
      const { alice, dngnAssets, marketplace, dungeonGameId } = await deployMarketplace();
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 5, ethers.parseEther("100"), dungeonGameId
      );

      await marketplace.connect(alice).cancelListing(0);

      const listing = await marketplace.listings(0);
      expect(listing.active).to.be.false;
      expect(await dngnAssets.balanceOf(alice.address, 1)).to.equal(10);
    });

    it("should reject cancel from non-seller", async function () {
      const { alice, bob, dngnAssets, marketplace, dungeonGameId } = await deployMarketplace();
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 5, ethers.parseEther("100"), dungeonGameId
      );

      await expect(marketplace.connect(bob).cancelListing(0))
        .to.be.revertedWith("Not seller");
    });
  });

  describe("Buying with PXL", function () {
    it("should buy items with PXL", async function () {
      const { alice, bob, pxlToken, dngnAssets, marketplace, dungeonGameId, feeRecipient } = await deployMarketplace();
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      const pricePerItem = ethers.parseEther("100");
      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 5, pricePerItem, dungeonGameId
      );

      // Bob buys 2 items
      const totalCost = pricePerItem * 2n;
      await pxlToken.connect(bob).approve(await marketplace.getAddress(), totalCost);

      const sellerBefore = await pxlToken.balanceOf(alice.address);
      const feeBefore = await pxlToken.balanceOf(feeRecipient.address);

      await marketplace.connect(bob).buyItem(0, 2, await pxlToken.getAddress(), totalCost);

      // Bob gets 2 items
      expect(await dngnAssets.balanceOf(bob.address, 1)).to.equal(2);

      // Listing now has 3 remaining
      const listing = await marketplace.listings(0);
      expect(listing.amount).to.equal(3);
      expect(listing.active).to.be.true;

      // Check fee: 2.5% of 200 PXL = 5 PXL
      const feeAfter = await pxlToken.balanceOf(feeRecipient.address);
      expect(feeAfter - feeBefore).to.equal(ethers.parseEther("5"));

      // Seller gets 195 PXL
      const sellerAfter = await pxlToken.balanceOf(alice.address);
      expect(sellerAfter - sellerBefore).to.equal(ethers.parseEther("195"));
    });

    it("should deactivate listing when all items sold", async function () {
      const { alice, bob, pxlToken, dngnAssets, marketplace, dungeonGameId } = await deployMarketplace();
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 2, ethers.parseEther("10"), dungeonGameId
      );

      const totalCost = ethers.parseEther("20");
      await pxlToken.connect(bob).approve(await marketplace.getAddress(), totalCost);
      await marketplace.connect(bob).buyItem(0, 2, await pxlToken.getAddress(), totalCost);

      const listing = await marketplace.listings(0);
      expect(listing.active).to.be.false;
      expect(listing.amount).to.equal(0);
    });

    it("should reject buying from inactive listing", async function () {
      const { alice, bob, pxlToken, dngnAssets, marketplace, dungeonGameId } = await deployMarketplace();
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 2, ethers.parseEther("10"), dungeonGameId
      );
      await marketplace.connect(alice).cancelListing(0);

      await pxlToken.connect(bob).approve(await marketplace.getAddress(), ethers.parseEther("10"));
      await expect(marketplace.connect(bob).buyItem(0, 1, await pxlToken.getAddress(), ethers.parseEther("10")))
        .to.be.revertedWith("Not active");
    });
  });

  describe("Buying with game tokens (via DEX swap)", function () {
    it("should buy items with game tokens by swapping through DEX", async function () {
      const { alice, bob, owner, pxlToken, dngnToken, dngnAssets, marketplace, dex, dungeonGameId } = await deployMarketplace();

      // Create a DEX pool for DNGN/PXL
      const poolPXL = ethers.parseEther("10000");
      const poolGame = ethers.parseEther("10000");
      await pxlToken.approve(await dex.getAddress(), poolPXL);
      await dngnToken.approve(await dex.getAddress(), poolGame);
      await dex.createPool(dungeonGameId, poolPXL, poolGame);

      // Give bob some DNGN tokens
      await dngnToken.transfer(bob.address, ethers.parseEther("1000"));

      // Alice lists an item
      await dngnAssets.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listItem(
        await dngnAssets.getAddress(), 1, 1, ethers.parseEther("100"), dungeonGameId
      );

      // Bob buys with DNGN token
      await dngnToken.connect(bob).approve(await marketplace.getAddress(), ethers.parseEther("200"));
      await marketplace.connect(bob).buyItem(
        0, 1, await dngnToken.getAddress(), ethers.parseEther("200")
      );

      expect(await dngnAssets.balanceOf(bob.address, 1)).to.equal(1);
    });
  });
});
