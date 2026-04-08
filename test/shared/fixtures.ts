import { ethers } from "hardhat";

/**
 * Full deployment fixture following the PLAN.md deployment order.
 * Deploys all 13 contracts and wires them together.
 */
export async function deployFullEcosystem() {
  const [owner, alice, bob, carol, feeRecipient] = await ethers.getSigners();

  // 1. Deploy PXLToken — treasury is owner
  const PXLToken = await ethers.getContractFactory("PXLToken");
  const pxlToken = await PXLToken.deploy(owner.address);
  await pxlToken.waitForDeployment();

  // 2. Deploy ERC6551Registry + ERC6551Account implementation
  const ERC6551Account = await ethers.getContractFactory("ERC6551Account");
  const accountImpl = await ERC6551Account.deploy();
  await accountImpl.waitForDeployment();

  const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
  const registry = await ERC6551Registry.deploy();
  await registry.waitForDeployment();

  // 3. Deploy PlayerProfile
  const PlayerProfile = await ethers.getContractFactory("PlayerProfile");
  const playerProfile = await PlayerProfile.deploy(
    await registry.getAddress(),
    await accountImpl.getAddress(),
    "https://pixelvault.gg/meta/"
  );
  await playerProfile.waitForDeployment();

  // 4. Deploy GameRegistry
  const GameRegistry = await ethers.getContractFactory("GameRegistry");
  const gameRegistry = await GameRegistry.deploy();
  await gameRegistry.waitForDeployment();

  // 5. Deploy CommonRelic
  const CommonRelic = await ethers.getContractFactory("CommonRelic");
  const commonRelic = await CommonRelic.deploy(await gameRegistry.getAddress());
  await commonRelic.waitForDeployment();

  // 6. Deploy PixelVaultDEX
  const PixelVaultDEX = await ethers.getContractFactory("PixelVaultDEX");
  const dex = await PixelVaultDEX.deploy(
    await pxlToken.getAddress(),
    await gameRegistry.getAddress()
  );
  await dex.waitForDeployment();

  // 7. setTrustedDEX
  await gameRegistry.setTrustedDEX(await dex.getAddress());

  // 8. Register "DungeonDrops" game
  const dungeonTx = await gameRegistry.registerGame(
    "DungeonDrops",
    "DNGN",
    owner.address,
    ethers.parseEther("1000000")
  );
  const dungeonReceipt = await dungeonTx.wait();
  const dungeonGameId = ethers.keccak256(ethers.toUtf8Bytes("DungeonDrops"));

  const dungeonGameData = await gameRegistry.games(dungeonGameId);
  const dngnTokenAddr = dungeonGameData[0]; // tokenAddress
  const dngnAssetsAddr = dungeonGameData[1]; // assetCollection

  const dngnToken = await ethers.getContractAt("GameToken", dngnTokenAddr);
  const dngnAssets = await ethers.getContractAt("GameAssetCollection", dngnAssetsAddr);

  // 8b. Register "HarvestField" game
  const harvestTx = await gameRegistry.registerGame(
    "HarvestField",
    "HRV",
    owner.address,
    ethers.parseEther("1000000")
  );
  await harvestTx.wait();
  const harvestGameId = ethers.keccak256(ethers.toUtf8Bytes("HarvestField"));

  const harvestGameData = await gameRegistry.games(harvestGameId);
  const hrvTokenAddr = harvestGameData[0];
  const hrvAssetsAddr = harvestGameData[1];

  const hrvToken = await ethers.getContractAt("GameToken", hrvTokenAddr);
  const hrvAssets = await ethers.getContractAt("GameAssetCollection", hrvAssetsAddr);

  // 9. Deploy AchievementBadge
  const AchievementBadge = await ethers.getContractFactory("AchievementBadge");
  const achievementBadge = await AchievementBadge.deploy();
  await achievementBadge.waitForDeployment();

  // 10. Deploy GasPaymaster
  const GasPaymaster = await ethers.getContractFactory("GasPaymaster");
  const gasPaymaster = await GasPaymaster.deploy(
    await pxlToken.getAddress(),
    await dex.getAddress(),
    await gameRegistry.getAddress()
  );
  await gasPaymaster.waitForDeployment();

  // 11. Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    await pxlToken.getAddress(),
    await dex.getAddress(),
    await gameRegistry.getAddress(),
    feeRecipient.address,
    await gasPaymaster.getAddress()
  );
  await marketplace.waitForDeployment();

  // 12. Deploy DungeonDrops
  const DungeonDrops = await ethers.getContractFactory("DungeonDrops");
  const dungeonDrops = await DungeonDrops.deploy(
    await gasPaymaster.getAddress(),
    dngnTokenAddr,
    dngnAssetsAddr,
    await achievementBadge.getAddress()
  );
  await dungeonDrops.waitForDeployment();

  // Deploy HarvestField
  const HarvestField = await ethers.getContractFactory("HarvestField");
  const harvestField = await HarvestField.deploy(
    await gasPaymaster.getAddress(),
    hrvTokenAddr,
    hrvAssetsAddr,
    await achievementBadge.getAddress()
  );
  await harvestField.waitForDeployment();

  // 13. Grant roles — wire everything

  // Define items in DungeonDrops asset collection
  await dngnAssets.defineItem(1, "ipfs://sword");
  await dngnAssets.defineItem(2, "ipfs://shield");
  await dngnAssets.defineItem(3, "ipfs://crown");

  // Grant GAME_ROLE to DungeonDrops contract
  await dngnAssets.grantGameRole(await dungeonDrops.getAddress());

  // Define items in HarvestField asset collection
  await hrvAssets.defineItem(1, "ipfs://seasonal-item");

  // Grant GAME_ROLE to HarvestField contract
  await hrvAssets.grantGameRole(await harvestField.getAddress());

  // Grant ISSUER_ROLE to game contracts on AchievementBadge
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await achievementBadge.grantRole(ISSUER_ROLE, await dungeonDrops.getAddress());
  await achievementBadge.grantRole(ISSUER_ROLE, await harvestField.getAddress());

  // Define badges
  await achievementBadge.defineBadge(1, dungeonGameId, "ipfs://badge-first-clear");
  await achievementBadge.defineBadge(2, harvestGameId, "ipfs://badge-first-harvest");

  return {
    // Signers
    owner,
    alice,
    bob,
    carol,
    feeRecipient,
    // Core
    pxlToken,
    registry,
    accountImpl,
    playerProfile,
    gameRegistry,
    commonRelic,
    dex,
    achievementBadge,
    gasPaymaster,
    marketplace,
    // DungeonDrops game
    dungeonDrops,
    dngnToken,
    dngnAssets,
    dungeonGameId,
    // HarvestField game
    harvestField,
    hrvToken,
    hrvAssets,
    harvestGameId,
  };
}
