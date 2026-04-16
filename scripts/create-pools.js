require("dotenv").config();
const { ethers } = require("ethers");
const addr = require("../deployed-addresses.json");

const rpcUrl = process.env.MINIEVM_RPC_URL || "http://localhost:8545";
if (!process.env.PRIVATE_KEY) {
  console.error("Error: PRIVATE_KEY not set in .env");
  process.exit(1);
}
const p = new ethers.JsonRpcProvider(rpcUrl);
const w = new ethers.Wallet(process.env.PRIVATE_KEY, p);

const dexAbi = [
  "function createPool(bytes32,uint256,uint256)",
  "function pools(bytes32) view returns (address,uint256,uint256,bytes32,bool,uint256)",
];
const dex = new ethers.Contract(addr.PixelVaultDEX, dexAbi, w);

async function main() {
  const dungeonId = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const harvestId = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));

  const p1 = await dex.pools(dungeonId);
  if (!p1[4]) {
    console.log("Creating DNGN/PXL pool...");
    const tx = await dex.createPool(
      dungeonId,
      ethers.parseEther("10000"),
      ethers.parseEther("100000"),
      { gasLimit: 5000000 }
    );
    await tx.wait();
    console.log("DNGN/PXL pool created");
  } else {
    console.log("DNGN pool already exists");
  }

  const p2 = await dex.pools(harvestId);
  if (!p2[4]) {
    console.log("Creating HRV/PXL pool...");
    const tx = await dex.createPool(
      harvestId,
      ethers.parseEther("10000"),
      ethers.parseEther("100000"),
      { gasLimit: 5000000 }
    );
    await tx.wait();
    console.log("HRV/PXL pool created");
  } else {
    console.log("HRV pool already exists");
  }

  console.log("\nAll pools ready!");
}

main().catch((e) => console.error("Error:", e.message));
