import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("ERC6551 & PlayerProfile", function () {
  async function deployProfileSystem() {
    const [owner, alice, bob] = await ethers.getSigners();

    const ERC6551Account = await ethers.getContractFactory("ERC6551Account");
    const accountImpl = await ERC6551Account.deploy();

    const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
    const registry = await ERC6551Registry.deploy();

    const PlayerProfile = await ethers.getContractFactory("PlayerProfile");
    const playerProfile = await PlayerProfile.deploy(
      await registry.getAddress(),
      await accountImpl.getAddress(),
      "https://pixelvault.gg/meta/"
    );

    return { owner, alice, bob, accountImpl, registry, playerProfile };
  }

  describe("PlayerProfile - Minting", function () {
    it("should mint a profile NFT", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      expect(await playerProfile.ownerOf(0)).to.equal(alice.address);
      expect(await playerProfile.totalPlayers()).to.equal(1);
    });

    it("should set username on mint", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      expect(await playerProfile.usernames(0)).to.equal("AlicePlayer");
    });

    it("should prevent minting twice from same address", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      await expect(playerProfile.connect(alice).mint("AliceSecond"))
        .to.be.revertedWith("Already minted");
    });

    it("should reject username shorter than 3 chars", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await expect(playerProfile.connect(alice).mint("AB"))
        .to.be.revertedWith("Username: 3-20 chars");
    });

    it("should reject username longer than 20 chars", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await expect(playerProfile.connect(alice).mint("A".repeat(21)))
        .to.be.revertedWith("Username: 3-20 chars");
    });

    it("should emit ProfileCreated event", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await expect(playerProfile.connect(alice).mint("AlicePlayer"))
        .to.emit(playerProfile, "ProfileCreated")
        .withArgs(0, alice.address, anyValue, "AlicePlayer");
    });

    it("should increment token IDs", async function () {
      const { alice, bob, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      await playerProfile.connect(bob).mint("BobPlayer");
      expect(await playerProfile.ownerOf(0)).to.equal(alice.address);
      expect(await playerProfile.ownerOf(1)).to.equal(bob.address);
      expect(await playerProfile.totalPlayers()).to.equal(2);
    });
  });

  describe("Token Bound Account (TBA)", function () {
    it("should create a TBA on mint", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      const tba = await playerProfile.getTBA(0);
      expect(tba).to.not.equal(ethers.ZeroAddress);
    });

    it("should return deterministic TBA address", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      const tba1 = await playerProfile.getTBA(0);
      const tba2 = await playerProfile.getTBA(0);
      expect(tba1).to.equal(tba2);
    });

    it("TBA owner should be the NFT holder", async function () {
      const { alice, playerProfile, accountImpl } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      const tbaAddr = await playerProfile.getTBA(0);
      const tba = await ethers.getContractAt("ERC6551Account", tbaAddr);
      expect(await tba.owner()).to.equal(alice.address);
    });

    it("TBA should execute calls from NFT owner", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      const tbaAddr = await playerProfile.getTBA(0);
      const tba = await ethers.getContractAt("ERC6551Account", tbaAddr);

      // Execute a no-op call (call self with empty data)
      await tba.connect(alice).execute(alice.address, 0, "0x", 0);
      expect(await tba.state()).to.equal(1);
    });

    it("TBA should reject execute from non-owner", async function () {
      const { alice, bob, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      const tbaAddr = await playerProfile.getTBA(0);
      const tba = await ethers.getContractAt("ERC6551Account", tbaAddr);

      await expect(tba.connect(bob).execute(bob.address, 0, "0x", 0))
        .to.be.revertedWith("Invalid signer");
    });

    it("TBA should receive ETH", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      const tbaAddr = await playerProfile.getTBA(0);

      await alice.sendTransaction({ to: tbaAddr, value: ethers.parseEther("1") });
      expect(await ethers.provider.getBalance(tbaAddr)).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Username management", function () {
    it("should allow owner to update username", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AliceOld");
      await playerProfile.connect(alice).updateUsername(0, "AliceNew");
      expect(await playerProfile.usernames(0)).to.equal("AliceNew");
    });

    it("should reject username update from non-owner", async function () {
      const { alice, bob, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      await expect(playerProfile.connect(bob).updateUsername(0, "Stolen"))
        .to.be.reverted;
    });

    it("should return correct tokenURI", async function () {
      const { alice, playerProfile } = await loadFixture(deployProfileSystem);
      await playerProfile.connect(alice).mint("AlicePlayer");
      expect(await playerProfile.tokenURI(0)).to.equal("https://pixelvault.gg/meta/0");
    });
  });
});
