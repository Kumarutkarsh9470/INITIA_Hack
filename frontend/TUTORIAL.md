# PixelVault — User Guide
A step-by-step walkthrough for using every feature on the PixelVault platform.
---

## 1. Connect Wallet

Open the app and click **Connect** in the top-right corner. PixelVault uses **InitiaKit** (InterwovenKit) — any Initia-compatible wallet will work. Your wallet must be connected to the **MiniEVM** rollup network.

---

## 2. Create a Player Profile

After connecting, you land on the **Create Profile** page.

1. Enter a username (3–20 characters, alphanumeric).
2. Click **Create Profile**.
3. This mints an ERC-721 NFT (your profile) and deploys an **ERC-6551 Token Bound Account** (TBA) — a smart-contract wallet tied to your NFT.

> All in-game assets, tokens, and items are owned by your TBA, not your EOA directly.

---

## 3. Get Starter Tokens (Faucet)

**Why everything is zero:** Your TBA starts with no tokens. You need to airdrop tokens to your TBA to begin.

Run this command from the project root (replace the address with **your TBA address** shown on the Dashboard):

```bash
TBA_ADDRESS=0xYourTBAHere npx hardhat run scripts/faucet.ts --network minievm
```

This sends:
- **10,000 PXL** — the platform currency
- **500 DNGN** — Dungeon Drops game token
- **500 HRV** — Harvest Field game token

After the faucet runs, refresh the Dashboard to see your balances.

---

## 4. Dashboard

The **Dashboard** (`/profile`) shows:

| Section | What it shows |
|---------|---------------|
| **Stats row** | Total Tokens, Reputation, Items Owned, Badges Earned |
| **Tokens** | PXL, DNGN, HRV balances |
| **Inventory** | ERC-1155 game items you've earned |
| **Navigation** | Quick links to Games, DEX, and Marketplace |

---

## 5. Games Hub

Navigate to **Games** (`/games`) to see registered games.

Two games are available:
- **Dungeon Drops** — pay 10 DNGN to enter, receive a random loot item
- **Harvest Field** — stake HRV tokens for 100 blocks, then harvest for rewards

Click **Play** to go to either game page.

---

## 6. Dungeon Drops

**Location:** `/dungeon`

### How to play:
1. You need at least **10 DNGN** in your TBA.
2. Click **Enter Dungeon**.
3. The contract charges 10 DNGN and randomly drops one of three items:
   - **Common Bone** (ID 1) — most frequent
   - **Rare Gem** (ID 2) — less common
   - **Legendary Relic** (ID 3) — very rare
4. The loot appears with a reveal animation.
5. Items appear in your Dashboard inventory and can be sold on the Marketplace.

---

## 7. Harvest Field

**Location:** `/harvest`

### How to play:
1. Enter the amount of HRV to stake (e.g. `100`). Click **MAX** to stake your full balance.
2. Click **Stake HRV** — this approves + stakes in two transactions.
3. **Wait 100 blocks** (~8 minutes on Initia). The progress ring and bar update every 5 seconds.
4. Once 100% is reached, click **Harvest** to collect your staked HRV plus rewards.

**Reward formula:** `staked × 0.01 × blocks_elapsed`

> If you click **Unstake** before 100 blocks, you get your HRV back but **forfeit rewards**.

---

## 8. DEX (Decentralized Exchange)

**Location:** `/dex`

### Swap tokens:
1. Select the token pair — **DNGN** or **HRV** (always paired with PXL).
2. Choose direction (PXL→Game or Game→PXL) using the arrow button.
3. Enter an amount. The estimated output and min received (0.5% slippage) appear below.
4. Click **Swap** — this approves the input token then executes the swap.

### Add liquidity:
1. Switch to the **Liquidity** tab.
2. Select the pool (DNGN or HRV).
3. Enter PXL amount and game-token amount.
4. Click **Add Liquidity** — three transactions: approve PXL, approve game token, add liquidity.

### Remove liquidity:
1. Enter your LP share amount.
2. Click **Remove Liquidity** to withdraw proportional tokens from the pool.

### Bridge:
Click the **Bridge** button in the header to open Initia's native bridge UI for moving tokens between L1 and MiniEVM.

### Pool Reserves:
Always visible at the bottom — shows PXL reserves, game-token reserves, and spot price for each pool.

---

## 9. Marketplace

**Location:** `/marketplace`

### Browse & Buy:
1. The **Browse** tab shows all active listings.
2. Each listing shows the item name, game, seller address, quantity, and price in PXL.
3. Click **Buy Now** — this approves PXL then purchases the item. Items are transferred to your TBA.

### Sell Items:
1. Switch to the **Sell Items** tab.
2. Your inventory (items with balance > 0) appears on the left.
3. Select an item, enter quantity and total price in PXL.
4. A fee preview shows the 2.5% marketplace fee and your net proceeds.
5. Click **List Item** — this approves the ERC-1155 collection then lists the item.

> **No listings?** Play Dungeon Drops to earn items, then list them here.

---

## 10. Gas Settings

**Location:** `/gas`

This page lets you choose a preferred game token (DNGN or HRV) for the GasPaymaster to pay transaction fees.

- **Preferred Gas Token**: Toggle between DNGN and HRV.
- **Exchange Rates**: Shows current DEX rates for each token.
- **Payment History**: Lists past GasSponsored events for your TBA.

---

## Quick-Start Checklist

```
1. Connect wallet
2. Create profile (mints NFT + TBA)
3. Run faucet: TBA_ADDRESS=0x... npx hardhat run scripts/faucet.ts --network minievm
4. Refresh Dashboard — you should see 10,000 PXL / 500 DNGN / 500 HRV
5. Play Dungeon Drops (costs 10 DNGN each run)
6. Stake HRV in Harvest Field
7. Swap tokens on DEX
8. List earned items on Marketplace
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| All balances are zero | Run the faucet script with your TBA address |
| "Insufficient balance" on Dungeon | You need ≥ 10 DNGN. Swap PXL→DNGN on the DEX |
| Marketplace is empty | No one has listed items yet. Play games to earn items, then list them |
| Swap shows "—" output | The DEX pool may have zero liquidity. Add liquidity first |
| Harvest button disabled | You must wait 100 blocks after staking |
| Transaction fails | Ensure your EOA has enough gas (native token) for the MiniEVM chain |
