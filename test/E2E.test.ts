import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, mine } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystem } from "./shared/fixtures";

describe("E2E Integration Test", function () {
  /**
   * Full pipeline test following the PLAN.md 13-step deployment order:
   * 1. Deploy all contracts
   * 2. Wire them together
   * 3. Mint profile → get TBA
   * 4. Enter dungeon from TBA → item minted to TBA
   * 5. Stake & harvest in HarvestField
   * 6. List and buy items on Marketplace
   * 7. Use DEX for token swaps
   */

  it("should deploy all contracts, mint profile, and run full game flow", async function () {
    const f = await loadFixture(deployFullEcosystem);
    const {
      owner, alice, bob, feeRecipient,
      pxlToken, registry, accountImpl, playerProfile, gameRegistry,
      commonRelic, dex, achievementBadge, gasPaymaster, marketplace,
      dungeonDrops, dngnToken, dngnAssets, dungeonGameId,
      harvestField, hrvToken, hrvAssets, harvestGameId,
    } = f;

    // ================================================================
    // Step 1: Verify all deployments
    // ================================================================
    expect(await pxlToken.totalSupply()).to.equal(ethers.parseEther("1000000000"));
    expect(await gameRegistry.getGameCount()).to.equal(2);
    expect(await gameRegistry.trustedDEX()).to.equal(await dex.getAddress());

    // ================================================================
    // Step 2: Create player profiles with TBAs
    // ================================================================
    await playerProfile.connect(alice).mint("AliceGamer");
    await playerProfile.connect(bob).mint("BobWarrior");

    const aliceTBAAddr = await playerProfile.getTBA(0);
    const bobTBAAddr = await playerProfile.getTBA(1);

    expect(aliceTBAAddr).to.not.equal(ethers.ZeroAddress);
    expect(bobTBAAddr).to.not.equal(ethers.ZeroAddress);

    const aliceTBA = await ethers.getContractAt("ERC6551Account", aliceTBAAddr);
    const bobTBA = await ethers.getContractAt("ERC6551Account", bobTBAAddr);

    expect(await aliceTBA.owner()).to.equal(alice.address);
    expect(await bobTBA.owner()).to.equal(bob.address);

    // ================================================================
    // Step 3: Fund TBAs with game tokens
    // ================================================================
    await dngnToken.transfer(aliceTBAAddr, ethers.parseEther("500"));
    await dngnToken.transfer(bobTBAAddr, ethers.parseEther("500"));
    await hrvToken.transfer(aliceTBAAddr, ethers.parseEther("500"));

    // ================================================================
    // Step 4: Enter dungeon from TBA
    // ================================================================

    // Alice's TBA approves DungeonDrops for entry fee
    const approveData = dngnToken.interface.encodeFunctionData("approve", [
      await dungeonDrops.getAddress(),
      ethers.parseEther("100"),
    ]);
    await aliceTBA.connect(alice).execute(await dngnToken.getAddress(), 0, approveData, 0);

    // Alice's TBA enters dungeon directly (no GasPaymaster for simplicity)
    const enterData = dungeonDrops.interface.encodeFunctionData("enterDungeon");
    await aliceTBA.connect(alice).execute(await dungeonDrops.getAddress(), 0, enterData, 0);

    // Verify item minted to TBA
    const sword = await dngnAssets.balanceOf(aliceTBAAddr, 1);
    const shield = await dngnAssets.balanceOf(aliceTBAAddr, 2);
    const crown = await dngnAssets.balanceOf(aliceTBAAddr, 3);
    expect(sword + shield + crown).to.equal(1, "TBA should have received exactly 1 loot item");

    // Verify first-clear badge issued
    expect(await achievementBadge.balanceOf(aliceTBAAddr, 1)).to.equal(1);

    // ================================================================
    // Step 5: Set up DEX pools and test swaps
    // ================================================================
    const poolAmt = ethers.parseEther("50000");
    await pxlToken.approve(await dex.getAddress(), poolAmt);
    await dngnToken.approve(await dex.getAddress(), poolAmt);
    await dex.createPool(dungeonGameId, poolAmt, poolAmt);

    // Give alice PXL and have her swap PXL → DNGN
    await pxlToken.transfer(alice.address, ethers.parseEther("1000"));
    await pxlToken.connect(alice).approve(await dex.getAddress(), ethers.parseEther("100"));

    const aliceDngnBefore = await dngnToken.balanceOf(alice.address);
    await dex.connect(alice).swapPXLForGame(dungeonGameId, ethers.parseEther("100"), 0);
    const aliceDngnAfter = await dngnToken.balanceOf(alice.address);
    expect(aliceDngnAfter).to.be.gt(aliceDngnBefore);

    // ================================================================
    // Step 6: Test HarvestField staking
    // ================================================================

    // Fund HarvestField with reward tokens
    await hrvToken.transfer(await harvestField.getAddress(), ethers.parseEther("10000"));

    // Alice's TBA approves HarvestField
    const approveHrvData = hrvToken.interface.encodeFunctionData("approve", [
      await harvestField.getAddress(),
      ethers.parseEther("100"),
    ]);
    await aliceTBA.connect(alice).execute(await hrvToken.getAddress(), 0, approveHrvData, 0);

    // Stake from TBA
    const stakeData = harvestField.interface.encodeFunctionData("stake", [ethers.parseEther("100")]);
    await aliceTBA.connect(alice).execute(await harvestField.getAddress(), 0, stakeData, 0);

    const stakeInfo = await harvestField.stakes(aliceTBAAddr);
    expect(stakeInfo.amount).to.equal(ethers.parseEther("100"));

    // Mine blocks and harvest
    await mine(101);

    const harvestData = harvestField.interface.encodeFunctionData("harvest");
    await aliceTBA.connect(alice).execute(await harvestField.getAddress(), 0, harvestData, 0);

    // Verify seasonal item minted
    expect(await hrvAssets.balanceOf(aliceTBAAddr, 1)).to.equal(1);

    // Verify first-harvest badge
    expect(await achievementBadge.balanceOf(aliceTBAAddr, 2)).to.equal(1);

    // ================================================================
    // Step 7: Test Marketplace
    // ================================================================

    // Owner mints some items directly to bob for marketplace test
    const GAME_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GAME_ROLE"));
    await dngnAssets.grantRole(GAME_ROLE, owner.address);
    await dngnAssets.mintItem(bob.address, 1, 5); // 5 swords to bob

    // Bob lists items on marketplace
    await dngnAssets.connect(bob).setApprovalForAll(await marketplace.getAddress(), true);
    await marketplace.connect(bob).listItem(
      await dngnAssets.getAddress(),
      1,
      3,
      ethers.parseEther("50"), // 50 PXL per item
      dungeonGameId
    );

    // Alice buys 2 items with PXL
    await pxlToken.transfer(alice.address, ethers.parseEther("200"));
    const totalCost = ethers.parseEther("100"); // 50 * 2
    await pxlToken.connect(alice).approve(await marketplace.getAddress(), totalCost);
    await marketplace.connect(alice).buyItem(0, 2, await pxlToken.getAddress(), totalCost);

    // Alice should now have 2 swords
    expect(await dngnAssets.balanceOf(alice.address, 1)).to.equal(2);

    // Fee recipient should have received 2.5% of 100 PXL = 2.5 PXL
    expect(await pxlToken.balanceOf(feeRecipient.address)).to.equal(ethers.parseEther("2.5"));

    // ================================================================
    // Step 8: Verify CommonRelic values with game rating
    // ================================================================
    const rating = await gameRegistry.getGameRating(dungeonGameId);
    expect(rating).to.be.gte(100);

    const relicValue = await commonRelic.getRelicValueInGame(1, dungeonGameId);
    expect(relicValue).to.be.gt(0);

    // ================================================================
    // Step 9: Verify reputation system
    // ================================================================
    const aliceRep = await achievementBadge.getReputation(aliceTBAAddr);
    // Alice has 2 badges (first-clear + first-harvest), 2 unique games
    // rep = 2*10 + 2*50 = 120
    expect(aliceRep).to.equal(120);

    // ================================================================
    // Step 10: Verify game pause/resume
    // ================================================================
    await gameRegistry.pauseGame(dungeonGameId);
    expect(await gameRegistry.getGameRating(dungeonGameId)).to.equal(0);

    await gameRegistry.resumeGame(dungeonGameId);
    expect(await gameRegistry.getGameRating(dungeonGameId)).to.be.gt(0);
  });
});
