import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));
  const reg = await ethers.getContractAt("GameRegistry", addr.GameRegistry);
  const DUNGEON_ID = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const HARVEST_ID = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));

  const dGame = await reg.games(DUNGEON_ID);
  const hGame = await reg.games(HARVEST_ID);

  console.log("\n=== DungeonDrops ===");
  console.log("totalVolume:", ethers.formatEther(dGame.totalVolume), "tokens");
  console.log("uniquePlayers:", dGame.uniquePlayers.toString());
  console.log("rating:", (await reg.getGameRating(DUNGEON_ID)).toString());

  console.log("\n=== HarvestField ===");
  console.log("totalVolume:", ethers.formatEther(hGame.totalVolume), "tokens");
  console.log("uniquePlayers:", hGame.uniquePlayers.toString());
  console.log("rating:", (await reg.getGameRating(HARVEST_ID)).toString());

  // Manual calculation
  function log2(x: bigint): bigint { let r = 0n; let v = x; while (v > 1n) { v >>= 1n; r++; } return r; }

  const dVolNorm = dGame.totalVolume / BigInt(1e18) + 1n;
  const dPlayerNorm = dGame.uniquePlayers + 1n;
  const hVolNorm = hGame.totalVolume / BigInt(1e18) + 1n;
  const hPlayerNorm = hGame.uniquePlayers + 1n;

  const dVolScore = log2(dVolNorm);
  const dPlayerScore = log2(dPlayerNorm);
  const hVolScore = log2(hVolNorm);
  const hPlayerScore = log2(hPlayerNorm);

  console.log("\n=== Manual Calc ===");
  console.log(`DNGN: volNorm=${dVolNorm} playerNorm=${dPlayerNorm} volScore=${dVolScore} playerScore=${dPlayerScore} raw=${dVolScore * dPlayerScore * 100n / 25n}`);
  console.log(`HRV:  volNorm=${hVolNorm} playerNorm=${hPlayerNorm} volScore=${hVolScore} playerScore=${hPlayerScore} raw=${hVolScore * hPlayerScore * 100n / 25n}`);
}
main().catch(console.error);
