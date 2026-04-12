import { ethers } from "hardhat"
import * as fs from "fs"

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying BarterMarket with:", deployer.address)

  const BarterMarket = await ethers.getContractFactory("BarterMarket")
  const barter = await BarterMarket.deploy()
  await barter.waitForDeployment()
  const address = await barter.getAddress()
  console.log("BarterMarket deployed to:", address)

  // Add to deployed-addresses.json (root)
  const addressesPath = "./deployed-addresses.json"
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"))
  addresses.BarterMarket = address
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2))

  // Also copy to frontend
  const frontendPath = "./frontend/src/lib/deployed-addresses.json"
  fs.writeFileSync(frontendPath, JSON.stringify(addresses, null, 2))
  console.log("Addresses saved to both locations.")
}

main().catch(console.error)
