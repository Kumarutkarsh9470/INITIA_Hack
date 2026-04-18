# PixelVault

**Cross-game player economy infrastructure on Initia MiniEVM.**

Any game developer registers once → gets a token, item collection, DEX pool, marketplace access, gas abstraction, and achievement system. Players get a single on-chain identity (ERC-6551 TBA) that holds all their cross-game assets.

**Live:** https://pixelvault-v2.vercel.app  
**Chain:** Initia MiniEVM (appchain `trying`, chain ID `2891653883154692`)  
**EVM RPC:** `http://207.180.203.32/evm-rpc`

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

### Deployed Contracts (19)

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
| GasPaymaster | `0x623753Fe98892f495139eF4DB8b06104F1bFd014` | Meta-tx: pay gas with game tokens |
| CosmoBridge | `0x83364b9E9C4bC7704D56609d28544F20248F9A8c` | IBC bridge to Initia L1 |
| CommonRelic | `0x8e8391437E9d1A62f9F2e38F3c396A74F4d7e19f` | Cross-game composable items |
| DungeonDropsToken | `0x529269E82DCE251B0D9026Dd9cCf8a6A58fc216E` | DNGN game token |
| DungeonDropsAssets | `0x00aAe2dBe26b35fd658cB3A6Ea55898620011DF3` | Dungeon ERC-1155 items |
| HarvestFieldToken | `0x504422a55e23083EbA597D7652C8fc891A7C7744` | HRV game token |
| HarvestFieldAssets | `0x955Eff39854d902dd81b2EA3aAC9090cb5318106` | Harvest ERC-1155 items |
| CosmicRacerToken | `0x9742fCa39c7e321C8A08DFA20FEDAC9950f039b9` | RACE game token |
| CosmicRacerAssets | `0x15F225Fb5D4f911322902ba3fd423247B051e31f` | Cosmic ERC-1155 items |
| DungeonDrops | `0x0E2A8E09A67a6AAd1414b8Dea88Ac18bea8969A7` | Game logic (loot drops) |
| HarvestField | `0x47Da7b1742F001Ba9Bac82b3c98880875874681E` | Game logic (stake/harvest) |

---

## Quick Start (Frontend Only)

> **No blockchain node or `.env` needed.** The Vite dev server proxies all RPC + API calls to production automatically.

```bash
git clone https://github.com/Kumarutkarsh9470/INITIA_Hack.git
cd INITIA_Hack/frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Connect wallet → create profile → starter tokens arrive automatically.

---

## Contributing

### For Contributors — Frontend Development

#### Setup

```bash
# 1. Fork the repo on GitHub, then:
git clone https://github.com/<YOUR_USERNAME>/INITIA_Hack.git
cd INITIA_Hack

# 2. Add upstream remote
git remote add upstream https://github.com/Kumarutkarsh9470/INITIA_Hack.git

# 3. Create your feature branch
git checkout -b feature/your-feature-name

# 4. Install frontend dependencies and start dev server
cd frontend
npm install
npm run dev
```

#### How the dev proxy works

| Route | Proxied to | Purpose |
|-------|-----------|---------|
| `/evm-rpc` | `207.180.203.32` | MiniEVM JSON-RPC |
| `/cosmos-rpc` | `207.180.203.32` | Cosmos Tendermint RPC |
| `/cosmos-rest` | `207.180.203.32` | Cosmos LCD REST |
| `/api/faucet` | Vercel production | Send test tokens (no key needed) |
| `/api/fund-gas` | Vercel production | Fund native GAS for new wallets |

- Contract addresses are bundled from `frontend/src/lib/deployed-addresses.json` (already in repo)
- No `.env` file needed — all defaults work out of the box
- ABIs are pre-built in `frontend/src/lib/abis/`

#### Getting test tokens

1. Connect an Initia-compatible wallet (InterwovenKit)
2. Create a profile — starter tokens (10,000 PXL + 500 DNGN + 500 HRV) are sent automatically
3. If it didn't work, click "Claim Starter Tokens" on the Dashboard

#### Key files

```
frontend/
  src/
    main.tsx              # Entry point, InterwovenKit providers
    App.tsx               # Router (all routes)
    pages/                # All page components
    hooks/
      useContracts.ts     # Contract addresses + ABIs (publicClient)
      usePlayerProfile.ts # Player identity hook
      useTBA.ts           # Token Bound Account execute() hook
      useAutoSign.ts      # Session key auto-signing
    lib/
      deployed-addresses.json  # Production contract addresses
      constants.ts        # Game IDs, item names, badge names
      abis/               # Contract ABIs (JSON)
    components/
      Layout.tsx          # Navbar + page layout
  vite.config.ts          # Dev proxy config
```

#### Submitting changes

```bash
# Make sure it builds cleanly
cd frontend && npm run build

# Commit and push to your fork
git add -A
git commit -m "feat: description of your change"
git push origin feature/your-feature-name

# Open a Pull Request on GitHub against main
```

### For Contributors — Smart Contract Development

> **Only needed if modifying Solidity.** Frontend-only contributors skip this section entirely.

#### Prerequisites

- Node.js ≥ 18
- Root `npm install` (installs Hardhat + OpenZeppelin)

#### Running tests locally (no chain needed)

```bash
# From project root
npm install
npx hardhat test
```

All tests run against Hardhat's in-memory EVM — no external chain or `.env` required.

#### Compiling contracts

```bash
npx hardhat compile
```

Artifacts go to `artifacts/`, typechain types to `typechain-types/`.

#### Local development chain

```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy + seed
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/wire.ts --network localhost

# Point frontend at local node
cd frontend
echo "VITE_CHAIN_RPC=http://localhost:8545" > .env.local
npm run dev
```

#### Deploying to production chain

> ⚠️ **Requires deployer private key.** Only do this if you need to redeploy contracts.

1. Get the deployer private key from the team lead
2. Create `.env` in the project root:
   ```
   PRIVATE_KEY=0x_YOUR_KEY_HERE
   MINIEVM_RPC_URL=http://207.180.203.32/evm-rpc
   CHAIN_ID=2891653883154692
   ```
3. Deploy:
   ```bash
   npx hardhat run scripts/deploy.ts --network minievm
   npx hardhat run scripts/wire.ts --network minievm
   ```
4. Sync addresses to frontend:
   ```bash
   cp deployed-addresses.json frontend/src/lib/deployed-addresses.json
   ```
5. Copy fresh ABIs:
   ```bash
   node -e "
   const fs = require('fs');
   const abis = {
     GameRegistry: 'artifacts/contracts/GameRegistry.sol/GameRegistry.json',
     PXLToken: 'artifacts/contracts/PXLToken.sol/PXLToken.json',
     PlayerProfile: 'artifacts/contracts/PlayerProfile.sol/PlayerProfile.json',
     PixelVaultDEX: 'artifacts/contracts/PixelVaultDEX.sol/PixelVaultDEX.json',
     Marketplace: 'artifacts/contracts/Marketplace.sol/Marketplace.json',
     DungeonDrops: 'artifacts/contracts/DungeonDrops.sol/DungeonDrops.json',
     HarvestField: 'artifacts/contracts/HarvestField.sol/HarvestField.json',
     AchievementBadge: 'artifacts/contracts/AchievementBadge.sol/AchievementBadge.json',
     GasPaymaster: 'artifacts/contracts/GasPaymaster.sol/GasPaymaster.json',
     CommonRelic: 'artifacts/contracts/CommonRelic.sol/CommonRelic.json',
     CosmoBridge: 'artifacts/contracts/CosmoBridge.sol/CosmoBridge.json',
     GameToken: 'artifacts/contracts/GameToken.sol/GameToken.json',
     GameAssetCollection: 'artifacts/contracts/GameAssetCollection.sol/GameAssetCollection.json',
     ERC6551Account: 'artifacts/contracts/erc6551/ERC6551Account.sol/ERC6551Account.json',
     ERC6551Registry: 'artifacts/contracts/erc6551/ERC6551Registry.sol/ERC6551Registry.json',
   };
   for (const [name, src] of Object.entries(abis)) {
     const { abi } = JSON.parse(fs.readFileSync(src, 'utf8'));
     fs.writeFileSync('frontend/src/lib/abis/' + name + '.json', JSON.stringify(abi, null, 2));
   }
   console.log('ABIs copied.');
   "
   ```

#### Important notes for contract contributors

- **Do NOT commit `.env`** — it's gitignored
- **Do NOT push `artifacts/` or `typechain-types/`** — they're gitignored and rebuilt on compile
- After modifying a contract, run `npx hardhat test` to ensure all tests pass
- If you add a new contract, update `scripts/deploy.ts`, `scripts/wire.ts`, and `frontend/src/hooks/useContracts.ts`

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

## Key Features

- **ERC-6551 Token Bound Accounts** — every player's assets live in a smart-contract wallet tied to their profile NFT
- **Permissionless game registration** — `registerGameWithFee()` costs 100 PXL, auto-deploys token + items + DEX pool
- **Three demo games** with real on-chain state (random loot drops, block-based staking, racing items)
- **On-chain DEX** — constant-product AMM with 3 game token pools
- **P2P Marketplace** — buy/sell/list ERC-1155 items across all games
- **GasPaymaster** — pay gas with any game token (ERC-2771 meta-tx forwarding)
- **IBC Bridge** — bridge PXL and all game tokens to Initia L1
- **Achievement system** — soulbound badges + cumulative reputation scoring
- **Session keys** — InterwovenKit auto-sign for frictionless gameplay

## Project Structure

```
contracts/        Solidity smart contracts (19 deployed)
scripts/          Deploy, wire, seed, and utility scripts
test/             Hardhat test suite
frontend/         React + Vite frontend
  src/
    components/   Layout, ProfileGate, TradingAdvisor
    hooks/        useContracts, usePlayerProfile, useTBA, useAutoSign
    lib/          ABIs, addresses, constants
    pages/        All page components
  api/            Vercel serverless functions (faucet, fund-gas)
```

## License

MIT
