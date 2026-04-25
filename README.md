# PixelVault

**The shared economy layer for on-chain games — built on Initia MiniEVM.**

Most blockchain games build their own token, their own item system, their own gas logic, and their own marketplace from scratch. Players end up with a different wallet and inventory per game, assets that are worthless outside that game, and friction at every step.

PixelVault flips that model. We built the shared economic layer once. Any game developer calls `registerGameWithFee()` and instantly gets a token, an ERC-1155 item collection, a DEX pool, marketplace access, and gas abstraction — all wired together. Players get one on-chain identity (an ERC-6551 Token Bound Account) that holds every asset from every game they ever play.

**Live:** https://pixelvault-v2.vercel.app
**Chain:** Initia MiniEVM (appchain `trying`, chain ID `2891653883154692`)
**EVM RPC:** `http://207.180.203.32/evm-rpc`

---

## What PixelVault Is (and Isn't)

PixelVault is **not** a DEX with renamed tokens. The DEX, the marketplace, the token contracts — those are *components* of a bigger system, not the product itself. The product is the full pipeline:

```
Player mints profile NFT (ERC-721)
        ↓
ERC-6551 Token Bound Account is created — one smart-contract wallet for all games
        ↓
Game developer calls registerGameWithFee()
        ↓
Protocol auto-deploys: game token + ERC-1155 item collection + DEX liquidity pool
        ↓
Player plays game → items and tokens flow into their TBA
        ↓
Player lists items on the shared Marketplace, swaps tokens on the shared DEX,
bridges to Initia L1 via IBC — all without leaving the ecosystem
```

The three games in this repo (Dungeon Drops, Harvest Field, Cosmic Racer) are **live proof** that every primitive works end-to-end. In a real production game, the "Enter Dungeon" button becomes a Unity combat scene — but the on-chain operations are identical to what you see here.

---

## Architecture

```
┌─────────────┐     ERC-6551      ┌─────────────────┐
│ Player EOA  │ ─── mints NFT ──> │ PlayerProfile    │
│             │                   │ (ERC-721)        │
└─────────────┘                   └────────┬────────┘
                                           │ creates
                                  ┌────────▼────────┐
                                  │ Token Bound Acct │ ← owns all assets
                                  │ (ERC-6551 TBA)   │
                                  └────────┬────────┘
                                           │ interacts with
       ┌────────────┬────────────┬─────────┴───────────┬────────────┐
       ▼            ▼            ▼                     ▼            ▼
 ┌───────────┐ ┌──────────┐ ┌──────────────┐  ┌──────────────┐ ┌────────┐
 │ Dungeon   │ │ Harvest  │ │ Cosmic       │  │ PixelVault   │ │ Market │
 │ Drops     │ │ Field    │ │ Racer        │  │ DEX (AMM)    │ │ place  │
 └───────────┘ └──────────┘ └──────────────┘  └──────────────┘ └────────┘
    (loot)       (staking)     (racing)        (cross-game)    (P2P)
```

### Deployed Contracts (20)

| Contract | Address | Purpose |
|----------|---------|---------|
| PXLToken | `0xACfBf71c479b60c931D85eff78E39aBC839414cE` | Platform ERC-20 (1B supply) |
| PlayerProfile | `0x275e3111f0Bc2D85b8e8FDbF3A1157C3C868347e` | ERC-721 identity NFT → creates TBA |
| ERC6551Registry | `0x349844746c62F78B8e08be88A8C9a6A185877A80` | Token Bound Account registry |
| ERC6551Account | `0x4C39e7feedE5196d84dbe38303Dca3F6eDcEbAd1` | TBA implementation |
| GameRegistry | `0x0E97cA656Bb80B1C9AfC2c148Ed0f6220d684210` | Registers games, deploys tokens + items |
| PixelVaultDEX | `0x33F1295B8106166eA1979cC0C544ba417ed4EFE0` | Constant-product AMM (0.3% fee) |
| Marketplace | `0x9ad18CacaFA987af1f3e76c34E52EeBcD68874E3` | P2P ERC-1155 item trading (2.5% fee) |
| AchievementBadge | `0x705eC728B291E825dCDb4899f8c1957a7129d59F` | Soulbound badges + reputation |
| GasPaymaster | `0x623753Fe98892f495139eF4DB8b06104F1bFd014` | Meta-tx: pay gas with any game token |
| CosmoBridge | `0x83364b9E9C4bC7704D56609d28544F20248F9A8c` | IBC bridge to Initia L1 |
| CommonRelic | `0x8e8391437E9d1A62f9F2e38F3c396A74F4d7e19f` | Cross-game composable items |
| DungeonDropsToken | `0x529269E82DCE251B0D9026Dd9cCf8a6A58fc216E` | DNGN game token |
| DungeonDropsAssets | `0x00aAe2dBe26b35fd658cB3A6Ea55898620011DF3` | Dungeon ERC-1155 items |
| HarvestFieldToken | `0x504422a55e23083EbA597D7652C8fc891A7C7744` | HRV game token |
| HarvestFieldAssets | `0x955Eff39854d902dd81b2EA3aAC9090cb5318106` | Harvest ERC-1155 items |
| CosmicRacerToken | `0x9742fCa39c7e321C8A08DFA20FEDAC9950f039b9` | RACE game token |
| CosmicRacerAssets | `0x15F225Fb5D4f911322902ba3fd423247B051e31f` | Cosmic ERC-1155 items |
| DungeonDrops | `0x0E2A8E09A67a6AAd1414b8Dea88Ac18bea8969A7` | Game logic (loot drops) |
| HarvestField | `0xF31fDDbd4AD3B03A96DA8F3623FC11887c06c1E7` | Game logic (stake/harvest) |
| CosmicRacer | `0x91fF95783834cEE1020e2764c83498C2009F786f` | Game logic (racing + loot) |

---

## Run Locally

No blockchain node, no private key, no `.env` file needed. The dev server automatically proxies all RPC and API calls to the live production chain.

**Prerequisites:** Node.js >= 18, Git, and an [Initia-compatible wallet](https://chromewebstore.google.com/detail/leap-cosmos-wallet/fcfcfllfndlomdhbehjjcoimbgofdncg) (Leap works well).

```bash
git clone https://github.com/Kumarutkarsh9470/INITIA_Hack.git
cd INITIA_Hack/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

**Getting started in the app:**
1. Connect your wallet using the "Connect Wallet" button
2. Create a player profile — this mints your identity NFT and sets up your Token Bound Account
3. Starter tokens arrive automatically (10,000 PXL + 500 DNGN + 500 HRV + 500 RACE). If they don't show up within 2 minutes, click "Claim Starter Tokens" on your dashboard
4. Head to any game — Dungeon Drops, Harvest Field, or Cosmic Racer — to try the platform

> **Note on block time:** This chain has ~35 second block times. Actions like harvesting and staking that wait for blocks will take real wall-clock time — this is expected behavior on a live chain.

---

## Key Features

- **ERC-6551 Token Bound Accounts** — every player has a smart-contract wallet tied to their profile NFT that holds all cross-game assets
- **Permissionless game registration** — `registerGameWithFee()` costs 100 PXL and auto-deploys a token, item collection, and DEX pool for any game
- **Three live demo games** — Dungeon Drops (match-3 loot), Harvest Field (stake/harvest), Cosmic Racer (lane-dodge racing), each with real on-chain state
- **Shared DEX** — constant-product AMM where players swap between any registered game tokens (0.3% fee)
- **Shared Marketplace** — P2P listing and trading of ERC-1155 items across all games (2.5% fee)
- **GasPaymaster** — players pay transaction gas using any game token; the paymaster handles the PXL swap internally via the DEX (ERC-2771 meta-transactions)
- **IBC Bridge** — bridge PXL and all game tokens to Initia L1 via CosmoBridge; tokens register with the Cosmos bank module
- **Achievement system** — soulbound badges tied to gameplay milestones, cumulative reputation score across all games
- **Session keys** — InterwovenKit auto-signing for frictionless gameplay without a wallet popup on every action

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.25, OpenZeppelin 5.x, Hardhat 2.28.6 |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS |
| Wallet | @initia/interwovenkit-react (wagmi 2 + viem 2) |
| Chain | Initia MiniEVM (Cosmos SDK + EVM, ~35s block time) |
| Hosting | Vercel (frontend) + Contabo VPS (chain node + nginx) |

## Production Infrastructure

| Service | Endpoint | Description |
|---------|----------|-------------|
| Frontend | https://pixelvault-v2.vercel.app | Vercel auto-deploy from `main` |
| EVM RPC | http://207.180.203.32/evm-rpc | MiniEVM JSON-RPC |
| Cosmos RPC | http://207.180.203.32/cosmos-rpc | Tendermint RPC |
| Cosmos REST | http://207.180.203.32/cosmos-rest | LCD REST API |

---

## Smart Contract Development

> Only needed if you are modifying Solidity. Frontend-only work does not require this.

```bash
# Install all dependencies from the project root
npm install

# Run the full test suite (no external chain needed)
npx hardhat test

# Compile contracts
npx hardhat compile
```

---

## License

MIT
