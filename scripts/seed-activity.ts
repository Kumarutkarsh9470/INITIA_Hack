import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));

  console.log("Deployer:", deployer.address);

  const dex = await ethers.getContractAt("PixelVaultDEX", addr.PixelVaultDEX);
  const pxl = await ethers.getContractAt("PXLToken", addr.PXLToken);
  const registry = await ethers.getContractAt("GameRegistry", addr.GameRegistry);

  const DUNGEON_ID = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));
  const HARVEST_ID = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));

  // Rating formula: raw = (log2(volume/1e18 + 1) * log2(uniquePlayers + 1) * 100) / 25
  // Need ~16 unique players + ~500K volume for 3 stars
  const NUM_WALLETS = 15;
  const PXL_PER_WALLET = ethers.parseEther("1000");
  const GAS_PER_WALLET = ethers.parseEther("1"); // native gas for tx fees
  const SWAP_AMOUNT = ethers.parseEther("500");

  console.log(`\nCreating ${NUM_WALLETS} wallets for unique player activity...\n`);

  // Generate wallets
  const wallets = Array.from({ length: NUM_WALLETS }, () => ethers.Wallet.createRandom().connect(deployer.provider!));

  // Fund all wallets with native GAS + PXL
  console.log("Funding wallets...");
  for (let i = 0; i < wallets.length; i++) {
    // Send native gas for tx fees
    const tx = await deployer.sendTransaction({ to: wallets[i].address, value: GAS_PER_WALLET });
    await tx.wait();
    // Send PXL tokens
    const tx2 = await pxl.transfer(wallets[i].address, PXL_PER_WALLET);
    await tx2.wait();
    if ((i + 1) % 5 === 0) console.log(`  Funded ${i + 1}/${NUM_WALLETS}`);
  }
  console.log(`  All ${NUM_WALLETS} wallets funded`);

  // Each wallet does a swap on both pools
  console.log("\nExecuting swaps from unique addresses...");
  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i];
    const pxlAsW = (await ethers.getContractAt("PXLToken", addr.PXLToken)).connect(w) as any;
    const dexAsW = (await ethers.getContractAt("PixelVaultDEX", addr.PixelVaultDEX)).connect(w) as any;

    try {
      // Approve + swap PXL→DNGN
      await (await pxlAsW.approve(addr.PixelVaultDEX, SWAP_AMOUNT)).wait();
      await (await dexAsW.swapPXLForGame(DUNGEON_ID, SWAP_AMOUNT, 0n)).wait();

      // Approve + swap PXL→HRV
      await (await pxlAsW.approve(addr.PixelVaultDEX, SWAP_AMOUNT)).wait();
      await (await dexAsW.swapPXLForGame(HARVEST_ID, SWAP_AMOUNT, 0n)).wait();

      console.log(`  Wallet ${i + 1}/${NUM_WALLETS} swapped (both pools)`);
    } catch (err: any) {
      console.log(`  Wallet ${i + 1} failed: ${err.message?.slice(0, 80)}`);
    }
  }

  // Also do a large deployer swap for volume
  console.log("\nDeployer large-volume swap...");
  const largeAmount = ethers.parseEther("5000");
  await (await pxl.approve(addr.PixelVaultDEX, largeAmount)).wait();
  await (await dex.swapPXLForGame(DUNGEON_ID, largeAmount, 0n)).wait();
  await (await pxl.approve(addr.PixelVaultDEX, largeAmount)).wait();
  await (await dex.swapPXLForGame(HARVEST_ID, largeAmount, 0n)).wait();
  console.log("  Done");

  // Check ratings
  const dRating = await registry.getGameRating(DUNGEON_ID);
  const hRating = await registry.getGameRating(HARVEST_ID);

  console.log(`\nDungeon Drops rating: ${dRating} (${(Number(dRating) / 100).toFixed(1)} stars)`);
  console.log(`Harvest Field rating: ${hRating} (${(Number(hRating) / 100).toFixed(1)} stars)`);
}

main().catch(console.error);
