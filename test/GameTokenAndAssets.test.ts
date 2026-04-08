import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GameToken", function () {
  async function deployGameToken() {
    const [owner, dev, alice] = await ethers.getSigners();
    const gameId = ethers.keccak256(ethers.toUtf8Bytes("TestGame"));
    const GameToken = await ethers.getContractFactory("GameToken");
    const token = await GameToken.deploy("TestGame", "TG", gameId, dev.address, ethers.parseEther("500000"));
    return { owner, dev, alice, token, gameId };
  }

  it("should mint initial supply to developer", async function () {
    const { dev, token } = await loadFixture(deployGameToken);
    expect(await token.balanceOf(dev.address)).to.equal(ethers.parseEther("500000"));
  });

  it("should allow owner to mint more", async function () {
    const { owner, alice, token } = await loadFixture(deployGameToken);
    await token.connect(owner).mint(alice.address, ethers.parseEther("1000"));
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
  });

  it("should reject mint exceeding max supply", async function () {
    const { owner, alice, token } = await loadFixture(deployGameToken);
    await expect(token.connect(owner).mint(alice.address, ethers.parseEther("1000000000")))
      .to.be.revertedWith("Cap exceeded");
  });

  it("should allow anyone to burn their own tokens", async function () {
    const { dev, token } = await loadFixture(deployGameToken);
    await token.connect(dev).burn(ethers.parseEther("1000"));
    expect(await token.balanceOf(dev.address)).to.equal(ethers.parseEther("499000"));
  });

  it("should reject mint from non-owner", async function () {
    const { alice, token } = await loadFixture(deployGameToken);
    await expect(token.connect(alice).mint(alice.address, ethers.parseEther("100"))).to.be.reverted;
  });
});

describe("GameAssetCollection", function () {
  async function deployAssets() {
    const [owner, minter, gameContract, alice] = await ethers.getSigners();
    const GameAssetCollection = await ethers.getContractFactory("GameAssetCollection");
    const assets = await GameAssetCollection.deploy("TestGame");

    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const GAME_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GAME_ROLE"));

    await assets.grantRole(MINTER_ROLE, minter.address);
    await assets.grantRole(GAME_ROLE, gameContract.address);

    return { owner, minter, gameContract, alice, assets, MINTER_ROLE, GAME_ROLE };
  }

  it("should define an item", async function () {
    const { minter, assets } = await loadFixture(deployAssets);
    await assets.connect(minter).defineItem(1, "ipfs://item1");
    expect(await assets.itemExists(1)).to.be.true;
    expect(await assets.uri(1)).to.equal("ipfs://item1");
  });

  it("should reject redefining an item", async function () {
    const { minter, assets } = await loadFixture(deployAssets);
    await assets.connect(minter).defineItem(1, "ipfs://item1");
    await expect(assets.connect(minter).defineItem(1, "ipfs://item1b"))
      .to.be.revertedWith("Item already defined");
  });

  it("should mint item with GAME_ROLE", async function () {
    const { minter, gameContract, alice, assets } = await loadFixture(deployAssets);
    await assets.connect(minter).defineItem(1, "ipfs://item1");
    await assets.connect(gameContract).mintItem(alice.address, 1, 3);
    expect(await assets.balanceOf(alice.address, 1)).to.equal(3);
  });

  it("should reject minting undefined item", async function () {
    const { gameContract, alice, assets } = await loadFixture(deployAssets);
    await expect(assets.connect(gameContract).mintItem(alice.address, 99, 1))
      .to.be.revertedWith("Item not defined");
  });

  it("should reject minting without GAME_ROLE", async function () {
    const { minter, alice, assets } = await loadFixture(deployAssets);
    await assets.connect(minter).defineItem(1, "ipfs://item1");
    await expect(assets.connect(alice).mintItem(alice.address, 1, 1)).to.be.reverted;
  });

  it("should batch mint", async function () {
    const { minter, gameContract, alice, assets } = await loadFixture(deployAssets);
    await assets.connect(minter).defineItem(1, "ipfs://item1");
    await assets.connect(minter).defineItem(2, "ipfs://item2");
    await assets.connect(gameContract).mintBatch(alice.address, [1, 2], [5, 10]);
    expect(await assets.balanceOf(alice.address, 1)).to.equal(5);
    expect(await assets.balanceOf(alice.address, 2)).to.equal(10);
  });
});
