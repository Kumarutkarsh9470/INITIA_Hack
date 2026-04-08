import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystem } from "./shared/fixtures";

describe("PXLToken", function () {
  async function deployPXL() {
    const [treasury, alice] = await ethers.getSigners();
    const PXLToken = await ethers.getContractFactory("PXLToken");
    const pxlToken = await PXLToken.deploy(treasury.address);
    await pxlToken.waitForDeployment();
    return { pxlToken, treasury, alice };
  }

  it("should mint total supply to treasury", async function () {
    const { pxlToken, treasury } = await loadFixture(deployPXL);
    const totalSupply = ethers.parseEther("1000000000");
    expect(await pxlToken.totalSupply()).to.equal(totalSupply);
    expect(await pxlToken.balanceOf(treasury.address)).to.equal(totalSupply);
  });

  it("should have correct name and symbol", async function () {
    const { pxlToken } = await loadFixture(deployPXL);
    expect(await pxlToken.name()).to.equal("PixelVault");
    expect(await pxlToken.symbol()).to.equal("PXL");
  });

  it("should have 18 decimals", async function () {
    const { pxlToken } = await loadFixture(deployPXL);
    expect(await pxlToken.decimals()).to.equal(18);
  });

  it("should allow transfers", async function () {
    const { pxlToken, treasury, alice } = await loadFixture(deployPXL);
    const amount = ethers.parseEther("1000");
    await pxlToken.connect(treasury).transfer(alice.address, amount);
    expect(await pxlToken.balanceOf(alice.address)).to.equal(amount);
  });

  it("should allow approve + transferFrom", async function () {
    const { pxlToken, treasury, alice } = await loadFixture(deployPXL);
    const amount = ethers.parseEther("500");
    await pxlToken.connect(treasury).approve(alice.address, amount);
    await pxlToken.connect(alice).transferFrom(treasury.address, alice.address, amount);
    expect(await pxlToken.balanceOf(alice.address)).to.equal(amount);
  });

  it("should expose TOTAL_SUPPLY constant", async function () {
    const { pxlToken } = await loadFixture(deployPXL);
    expect(await pxlToken.TOTAL_SUPPLY()).to.equal(ethers.parseEther("1000000000"));
  });
});
