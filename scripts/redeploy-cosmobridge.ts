import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CosmoBridge with:", deployer.address);

  const Bridge = await ethers.getContractFactory("CosmoBridge");
  const bridge = await Bridge.deploy();
  await bridge.waitForDeployment();
  const addr = await bridge.getAddress();
  console.log("CosmoBridge:", addr);

  // Update deployed-addresses.json
  const addrs = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf8"));
  addrs.CosmoBridge = addr;
  const json = JSON.stringify(addrs, null, 2);
  fs.writeFileSync("./deployed-addresses.json", json);
  fs.writeFileSync("./frontend/src/lib/deployed-addresses.json", json);
  console.log("Addresses updated");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
