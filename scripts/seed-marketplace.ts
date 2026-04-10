/**
 * seed-marketplace.ts
 *
 * Pre-populates the Marketplace with 5 listings from the deployer so that
 * a judge (or any new player) sees items to buy immediately.
 *
 * Usage:
 *   npx hardhat run scripts/seed-marketplace.ts --network minievm
 */
import { ethers } from 'hardhat'
import deployed from '../deployed-addresses.json'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deployer:', deployer.address)

  // Attach contracts
  const dungeonAssets = await ethers.getContractAt('GameAssetCollection', deployed.DungeonDropsAssets)
  const harvestAssets = await ethers.getContractAt('GameAssetCollection', deployed.HarvestFieldAssets)
  const marketplace = await ethers.getContractAt('Marketplace', deployed.Marketplace)

  // Game IDs (must match constants.ts)
  const DUNGEON_GAME_ID = ethers.keccak256(ethers.toUtf8Bytes('DungeonDrops'))
  const HARVEST_GAME_ID = ethers.keccak256(ethers.toUtf8Bytes('HarvestField'))

  // Step 1: Grant GAME_ROLE to deployer on both asset collections so we can mint
  const GAME_ROLE = ethers.keccak256(ethers.toUtf8Bytes('GAME_ROLE'))

  const hasDungeonRole = await dungeonAssets.hasRole(GAME_ROLE, deployer.address)
  if (!hasDungeonRole) {
    console.log('Granting GAME_ROLE to deployer on DungeonDropsAssets…')
    await (await dungeonAssets.grantGameRole(deployer.address)).wait()
  }

  const hasHarvestRole = await harvestAssets.hasRole(GAME_ROLE, deployer.address)
  if (!hasHarvestRole) {
    console.log('Granting GAME_ROLE to deployer on HarvestFieldAssets…')
    await (await harvestAssets.grantGameRole(deployer.address)).wait()
  }

  // Step 2: Mint items to the deployer
  console.log('Minting items to deployer…')
  await (await dungeonAssets.mintItem(deployer.address, 1, 5)).wait()  // 5x Common Sword
  await (await dungeonAssets.mintItem(deployer.address, 2, 3)).wait()  // 3x Rare Shield
  await (await dungeonAssets.mintItem(deployer.address, 3, 1)).wait()  // 1x Legendary Crown
  await (await harvestAssets.mintItem(deployer.address, 1, 4)).wait()  // 4x Harvest Bundle

  // Step 3: Approve Marketplace for both collections
  console.log('Approving Marketplace…')
  await (await dungeonAssets.setApprovalForAll(deployed.Marketplace, true)).wait()
  await (await harvestAssets.setApprovalForAll(deployed.Marketplace, true)).wait()

  // Step 4: Create listings
  const PXL_AMT = ethers.parseEther
  const listings = [
    { collection: deployed.DungeonDropsAssets, itemId: 1, amount: 3, price: PXL_AMT('15'),  gameId: DUNGEON_GAME_ID, label: '3x Common Sword @ 15 PXL' },
    { collection: deployed.DungeonDropsAssets, itemId: 1, amount: 2, price: PXL_AMT('10'),  gameId: DUNGEON_GAME_ID, label: '2x Common Sword @ 10 PXL' },
    { collection: deployed.DungeonDropsAssets, itemId: 2, amount: 2, price: PXL_AMT('50'),  gameId: DUNGEON_GAME_ID, label: '2x Rare Shield @ 50 PXL' },
    { collection: deployed.DungeonDropsAssets, itemId: 3, amount: 1, price: PXL_AMT('200'), gameId: DUNGEON_GAME_ID, label: '1x Legendary Crown @ 200 PXL' },
    { collection: deployed.HarvestFieldAssets, itemId: 1, amount: 4, price: PXL_AMT('30'),  gameId: HARVEST_GAME_ID, label: '4x Harvest Bundle @ 30 PXL' },
  ]

  for (const l of listings) {
    console.log(`  Listing: ${l.label}`)
    await (await marketplace.listItem(l.collection, l.itemId, l.amount, l.price, l.gameId)).wait()
  }

  console.log(`\n✓ ${listings.length} marketplace listings created successfully.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
