import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  const addr = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf-8"));
  
  const pxl = await ethers.getContractAt("PXLToken", addr.PXLToken);
  const dngn = await ethers.getContractAt("GameToken", addr.DungeonDropsToken);
  const hrv = await ethers.getContractAt("GameToken", addr.HarvestFieldToken);
  
  console.log("Deployer:", deployer.address);
  console.log("PXL bal:", ethers.formatEther(await pxl.balanceOf(deployer.address)));
  console.log("DNGN bal:", ethers.formatEther(await dngn.balanceOf(deployer.address)));
  console.log("HRV bal:", ethers.formatEther(await hrv.balanceOf(deployer.address)));
  console.log("Native bal:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
}
main();
