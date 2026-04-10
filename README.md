# PixelVault

A full-stack on-chain gaming platform built on **Initia MiniEVM**, showcasing ERC-6551 Token Bound Accounts, gasless meta-transactions, an integrated DEX, and a P2P item marketplace — all inside a single composable ecosystem.

## Architecture

```
┌─────────────┐     ERC-6551      ┌─────────────────┐
│ Player EOA  │ ─── mints NFT ──> │ PlayerProfile    │
│             │                   │ (ERC-721)        │
└─────────────┘                   └────────┬────────┘
                                           │ creates
                                  ┌────────▼────────┐
                                  │ Token Bound Acct │ <- owns all assets
                                  │ (ERC-6551 TBA)   │
                                  └────────┬────────┘
                                           │ interacts with
           ┌──────────────┬──────────────┬─┴───────────────┐
           ▼              ▼              ▼                  ▼
    ┌─────────────┐ ┌──────────┐ ┌──────────────┐  ┌──────────────┐
    │ DungeonDrops│ │ Harvest  │ │ PixelVault   │  │ Marketplace  │
    │ (game)      │ │ Field    │ │ DEX (AMM)    │  │ (P2P trade)  │
    └─────────────┘ └──────────┘ └──────────────┘  └──────────────┘
```

### Contracts

| Contract | Purpose |
|----------|---------|
| **PXLToken** | Platform ERC-20 utility token (1B fixed supply) |
| **PlayerProfile** | ERC-721 profile NFT — one per wallet, creates TBA on mint |
| **ERC6551Registry / Account** | Token Bound Account infrastructure |
| **GameRegistry** | Registers games, deploys game tokens + asset collections |
| **GameToken** | ERC-20 game-specific tokens (DNGN, HRV) |
| **GameAssetCollection** | ERC-1155 in-game items (swords, shields, harvest bundles) |
| **DungeonDrops** | Pay 10 DNGN → receive random loot item (60/30/10% drop rates) |
| **HarvestField** | Stake HRV for 100 blocks → harvest staked amount + rewards |
| **PixelVaultDEX** | Constant-product AMM (PXL↔DNGN, PXL↔HRV) with 0.3% fee |
| **Marketplace** | P2P ERC-1155 item trading with 2.5% protocol fee |
| **AchievementBadge** | On-chain badges + reputation system |
| **GasPaymaster** | Meta-transaction relayer — pay gas with game tokens via DEX swap |
| **CommonRelic** | Cross-game composable item contract |

### Frontend

React 18 + TypeScript + Vite + Tailwind CSS. Uses **InterwovenKit** for wallet connection and **viem** for contract interactions.

## Quick Start

### Prerequisites

- Node.js ≥ 18
- A running Initia MiniEVM node (local or testnet)
- Deployer private key with gas tokens

### 1. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment

Create a `.env` in the project root:

```
MINIEVM_RPC_URL=http://localhost:8545
PRIVATE_KEY=0x<deployer_private_key>
CHAIN_ID=<your_chain_id>
```

Create `frontend/.env`:

```
VITE_APPCHAIN_ID=<chain_id_string>
VITE_DEPLOYER_PRIVATE_KEY=0x<deployer_private_key>
```

### 3. Deploy contracts

```bash
npx hardhat run scripts/deploy.ts --network minievm
```

### 4. Wire contracts (roles, items, DEX pools)

```bash
npx hardhat run scripts/wire.ts --network minievm
```

### 5. Seed marketplace (optional)

```bash
npx hardhat run scripts/seed-marketplace.ts --network minievm
```

This creates 5 pre-populated listings so the marketplace isn't empty during judging.

### 6. Start frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## How It Works (User Flow)

1. **Connect wallet** — click "Connect" in the header (Initia-compatible wallet required)
2. **Create profile** — enter a username → mints ERC-721 NFT + creates TBA
3. **Starter tokens arrive automatically** — the faucet sends 10,000 PXL + 500 DNGN + 500 HRV to your TBA on profile creation. If it didn't work, click "Claim Starter Tokens" on the Dashboard.
4. **Play Dungeon Drops** — pay 10 DNGN per run, receive random loot (Common / Rare / Legendary)
5. **Play Harvest Field** — stake HRV, wait 100 blocks, harvest for rewards
6. **Swap on DEX** — trade PXL ↔ DNGN or PXL ↔ HRV with the on-chain AMM
7. **Trade on Marketplace** — sell your loot items for PXL; buy listed items from others

## Key Features for Judges

- **ERC-6551 Token Bound Accounts** — every player's assets live in a smart-contract wallet tied to their profile NFT. Transfer the NFT → transfer everything.
- **Self-serve onboarding** — no CLI faucet needed. Starter tokens are sent automatically on profile mint.
- **Two working games** with real on-chain state (random drops, block-based staking)
- **On-chain DEX** — constant-product AMM with real liquidity pools
- **P2P Marketplace** — fully functional buy/sell/list flow with fee distribution
- **GasPaymaster** — architectural pattern for paying gas with game tokens (ERC-2771 forwarding)
- **Achievement system** — on-chain badges + cumulative reputation score
- **Session keys** — InterwovenKit auto-sign support for frictionless gameplay (toggle in header)

## Judging Notes

The marketplace supports full P2P item trading. To pre-populate listings for demo purposes:

```bash
npx hardhat run scripts/seed-marketplace.ts --network minievm
```

For a two-player demo, open a second browser/incognito window with a different wallet.

## Project Structure

```
contracts/        Solidity smart contracts
scripts/          Deploy, wire, seed, and faucet scripts
test/             Hardhat test suite
frontend/         React + Vite frontend
  src/
    components/   Layout, ProfileGate
    hooks/        useContracts, usePlayerProfile, useTBA, useAutoSign
    lib/          ABIs, addresses, constants
    pages/        All page components
```

## License

MIT
