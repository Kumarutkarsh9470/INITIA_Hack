import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystem } from "./shared/fixtures";

describe("GasPaymaster", function () {
  async function deployPaymaster() {
    const f = await loadFixture(deployFullEcosystem);

    // Create a DEX pool so GasPaymaster can swap DNGN → PXL
    const poolPXL = ethers.parseEther("50000");
    const poolGame = ethers.parseEther("50000");
    await f.pxlToken.approve(await f.dex.getAddress(), poolPXL);
    await f.dngnToken.approve(await f.dex.getAddress(), poolGame);
    await f.dex.createPool(f.dungeonGameId, poolPXL, poolGame);

    // Mint a player profile NFT for alice → creates TBA
    await f.playerProfile.connect(f.alice).mint("AlicePlayer");
    const tbaAddr = await f.playerProfile.getTBA(0);
    const tba = await ethers.getContractAt("ERC6551Account", tbaAddr);

    // Fund TBA with DNGN tokens (for gas + entry fee)
    await f.dngnToken.transfer(tbaAddr, ethers.parseEther("1000"));

    return { ...f, tba, tbaAddr };
  }

  it("should reject if token is not registered", async function () {
    const { alice, gasPaymaster } = await deployPaymaster();
    await expect(
      gasPaymaster.connect(alice).executeWithGameToken(
        ethers.ZeroAddress, ethers.parseEther("10"), alice.address, "0x"
      )
    ).to.be.reverted;
  });

  it("should reject zero token amount", async function () {
    const { alice, gasPaymaster, dngnToken } = await deployPaymaster();
    await expect(
      gasPaymaster.connect(alice).executeWithGameToken(
        await dngnToken.getAddress(), 0, alice.address, "0x"
      )
    ).to.be.revertedWith("Invalid token amount");
  });

  it("should reject self-call", async function () {
    const { alice, gasPaymaster, dngnToken } = await deployPaymaster();
    await expect(
      gasPaymaster.connect(alice).executeWithGameToken(
        await dngnToken.getAddress(),
        ethers.parseEther("10"),
        await gasPaymaster.getAddress(),
        "0x"
      )
    ).to.be.revertedWith("Cannot self-call");
  });

  it("should reject amounts exceeding MAX_GAS_TOKEN_AMOUNT", async function () {
    const { alice, gasPaymaster, dngnToken } = await deployPaymaster();
    await expect(
      gasPaymaster.connect(alice).executeWithGameToken(
        await dngnToken.getAddress(),
        ethers.parseEther("10001"),
        alice.address,
        "0x"
      )
    ).to.be.revertedWith("Invalid token amount");
  });

  it("should execute meta-tx via TBA", async function () {
    const { alice, tba, tbaAddr, dngnToken, gasPaymaster, dungeonDrops, dngnAssets } = await deployPaymaster();

    // Approve gasPaymaster from TBA for DNGN tokens
    const approveData = dngnToken.interface.encodeFunctionData("approve", [
      await gasPaymaster.getAddress(),
      ethers.parseEther("500"),
    ]);
    await tba.connect(alice).execute(await dngnToken.getAddress(), 0, approveData, 0);

    // Also approve DungeonDrops from TBA for entry fee (since enterDungeon uses safeTransferFrom)
    const approveDungeonData = dngnToken.interface.encodeFunctionData("approve", [
      await dungeonDrops.getAddress(),
      ethers.parseEther("500"),
    ]);
    await tba.connect(alice).execute(await dngnToken.getAddress(), 0, approveDungeonData, 0);

    // Build the enterDungeon call data
    const enterDungeonData = dungeonDrops.interface.encodeFunctionData("enterDungeon");

    // Build the meta-transaction: TBA calls gasPaymaster.executeWithGameToken
    const paymasterData = gasPaymaster.interface.encodeFunctionData("executeWithGameToken", [
      await dngnToken.getAddress(),
      ethers.parseEther("50"), // max game tokens for gas
      await dungeonDrops.getAddress(),
      enterDungeonData,
    ]);

    // Execute from TBA (alice is NFT owner, so she can execute via TBA)
    await tba.connect(alice).execute(await gasPaymaster.getAddress(), 0, paymasterData, 0);

    // Check that dungeon run happened — TBA should have an item
    const bal1 = await dngnAssets.balanceOf(tbaAddr, 1);
    const bal2 = await dngnAssets.balanceOf(tbaAddr, 2);
    const bal3 = await dngnAssets.balanceOf(tbaAddr, 3);
    expect(bal1 + bal2 + bal3).to.equal(1);
  });
});
