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

### 1. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

---

## For Contributors — Frontend Development

> **You do NOT need your own blockchain node.** The Vite dev server automatically proxies
> API calls to the production chain running on our Contabo VPS.

### Setup (3 commands)

```bash
git clone https://github.com/Kumarutkarsh9470/INITIA_Hack.git
cd INITIA_Hack/frontend
npm install
npm run dev
```

That's it. Open `http://localhost:5173` in your browser.

### What happens under the hood

- The Vite dev server proxies `/evm-rpc`, `/cosmos-rpc`, `/cosmos-rest` to the production server at `207.180.203.32`
- `/api/faucet` and `/api/fund-gas` are proxied to the production Vercel deployment automatically (no PRIVATE_KEY needed locally)
- Contract addresses are bundled from `deployed-addresses.json` (already in the repo)
- No `.env` file needed — defaults work out of the box

### Getting test tokens

1. Connect your wallet (InterwovenKit / Initia Wallet)
2. Create a profile — starter tokens (10,000 PXL + 500 DNGN + 500 HRV) are sent automatically on profile mint

### Frontend tech stack

- React 18 + TypeScript
- Vite 5 + Tailwind CSS
- wagmi 2 + viem 2
- @initia/interwovenkit-react
- react-router-dom

### Key files

```
frontend/
  src/
    main.tsx              # App entry, InterwovenKit providers, chain config
    App.tsx               # Router
    pages/                # All page components
    hooks/
      useContracts.ts     # viem publicClient for contract reads
      useWallet.tsx       # InterwovenKit wallet hook (sendTx)
    lib/
      addresses.ts        # Reads deployed-addresses.json
      abis/               # Contract ABIs (JSON)
    components/
      Layout.tsx          # Navbar + page layout
      ErrorBoundary.tsx   # Crash boundary
  deployed-addresses.json # Production contract addresses (auto-imported)
  vite.config.ts          # Dev proxy → production server
```

---

## For Contributors — Smart Contract Development

> **Only needed if you're modifying Solidity contracts.** Frontend-only contributors can skip this section.

### Running tests locally (no chain needed)

```bash
# From the project root
npm install
npx hardhat test
```

All tests run against Hardhat's in-memory EVM — no external chain required.

### Deploying to a local Hardhat node

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy + wire
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/wire.ts --network localhost
```

### Deploying to the production chain

> ⚠️ **Only do this if you need to redeploy contracts.** This overwrites production.

1. Get the deployer private key from the team lead
2. Create a `.env` file in the project root (see `.env.example`):
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
4. Copy addresses to frontend:
   ```bash
   cp deployed-addresses.json frontend/src/lib/deployed-addresses.json
   ```

### Contract tech stack

- Solidity 0.8.25 (viaIR enabled, Cancun EVM target)
- Hardhat 2.28.6
- OpenZeppelin Contracts 5.x

---

## Production Deployment

The production instance runs on a Contabo VPS at `207.180.203.32`:

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80 | Reverse proxy (rate-limited) |
| minitiad (EVM RPC) | 8545 | MiniEVM JSON-RPC |
| minitiad (Cosmos RPC) | 26657 | Tendermint RPC |
| minitiad (REST) | 1317 | Cosmos LCD/REST API |

Nginx routes:
- `/health` → health check
- `/evm-rpc` → EVM JSON-RPC
- `/cosmos-rpc` → Cosmos RPC
- `/cosmos-rest` → Cosmos REST

Frontend is hosted on Vercel at https://pixelvault-two.vercel.app with serverless functions proxying API calls to the VPS.

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
