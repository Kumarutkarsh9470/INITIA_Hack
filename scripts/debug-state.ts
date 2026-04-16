import { ethers } from "hardhat";
import * as fs from "fs";
async function main() {
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));
  const dex = await ethers.getContractAt("PixelVaultDEX", addr.PixelVaultDEX);
  const dungeonId = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops")); 
  const price = await dex.getPrice(dungeonId);
  console.log("getPrice raw:", price.toString());
  console.log("getPrice formatted:", ethers.formatEther(price));
  const pool = await dex.pools(dungeonId);
  console.log("Pool struct keys:", Object.keys(pool));
  console.log("pool.gameToken:", pool.gameToken);
  console.log("pool.reservePXL:", pool.reservePXL.toString());
  console.log("pool.reserveGame:", pool.reserveGame.toString());
  console.log("pool.active:", pool.active); 
  const dd = await ethers.getContractAt("DungeonDrops", addr.DungeonDrops);
  const totalRuns = await dd.totalRuns();
  console.log("\ntotalRuns:", totalRuns.toString());
  const gr = await ethers.getContractAt("GameRegistry", addr.GameRegistry);
  const count = await gr.getGameCount();
  console.log("\nGameRegistry game count:", count.toString());
}
main().catch(console.error);