# PixelVault — Contract Replacement & GitHub Workflow

## Overview
This repo contains the **lead developer's contracts** plus deployment/test infrastructure. When juniors submit replacement contracts, follow this guide to swap them in, verify nothing broke, and push to GitHub for the team.

---

## Step 1: Push the Base Repo to GitHub (one-time setup)

```bash
# In the project root (/root/try/pixelvault)
git init
git add .
git commit -m "Initial commit: lead dev contracts + deploy/test infra"

# Create a repo on GitHub (replace with your org/username)
# Option A: GitHub CLI
gh repo create <your-org>/pixelvault --private --source=. --push

# Option B: Manual
git remote add origin git@github.com:<your-org>/pixelvault.git
git branch -M main
git push -u origin main
```

---

## Step 2: Replace Contracts (when juniors submit theirs)

```bash
# Create a branch for the junior's contracts
git checkout -b junior/<junior-name>-contracts

# Replace the specific contract file(s)
# Example: junior rewrote DungeonDrops
cp /path/to/junior/DungeonDrops.sol contracts/DungeonDrops.sol

# If they also changed interfaces:
cp /path/to/junior/IDungeonDrops.sol contracts/interfaces/IDungeonDrops.sol
```

---

## Step 3: Compile & Check for Breaking Changes

```bash
# Compile — this will catch Solidity errors
npx hardhat compile

# Run the interface diff checker
npx ts-node scripts/check-interfaces.ts
```

The checker compares compiled artifacts against `CONTRACT_SNAPSHOT.json` and reports:
- 🔴 **Breaking changes** — constructor params changed, functions removed/modified
- 🟡 **Warnings** — new functions added, param renames

---

## Step 4: Fix Breaking Changes

Based on the diff report, update these files:

| What changed                   | File(s) to update                                         |
|-------------------------------|----------------------------------------------------------|
| Constructor params            | `scripts/deploy.ts`, `test/shared/fixtures.ts`            |
| Function renamed/removed      | `scripts/wire.ts`, `test/*.test.ts`, deploy guide prompts |
| Event renamed/removed         | `test/*.test.ts`, frontend event listeners                |
| New dependencies added        | `scripts/deploy.ts` (deployment order may change)          |
| Role names changed            | `scripts/wire.ts`, `test/shared/fixtures.ts`               |

### Quick fix pattern:
```bash
# 1. Read the diff report
npx ts-node scripts/check-interfaces.ts 2>&1 | tee /tmp/diff-report.txt

# 2. Fix deploy.ts and wire.ts based on the report

# 3. Fix test fixtures
# test/shared/fixtures.ts must mirror deploy.ts + wire.ts exactly

# 4. Run all tests to verify
npx hardhat test

# 5. If tests pass, regenerate typechain
npx hardhat compile  # typechain auto-generates
```

---

## Step 5: Update the Snapshot

After fixing everything and all tests pass:

```bash
# Update the snapshot to reflect the new contract interfaces
# (Ask AI to regenerate CONTRACT_SNAPSHOT.json based on new contracts)
```

---

## Step 6: Push & Let Team Clone

```bash
# Commit the changes
git add .
git commit -m "feat: integrate <junior-name>'s contracts + fix deploy/wire/tests"
git push origin junior/<junior-name>-contracts

# Merge to main when ready
git checkout main
git merge junior/<junior-name>-contracts
git push origin main
```

### For juniors cloning to their Initia appchain:

```bash
git clone git@github.com:<your-org>/pixelvault.git
cd pixelvault
npm install

# Create .env with their Initia appchain details
cat > .env << 'EOF'
PRIVATE_KEY=<their-private-key>
RPC_URL=<their-minievm-rpc-url>
EOF

# Deploy to their appchain
npx hardhat run scripts/deploy.ts --network minievm
npx hardhat run scripts/wire.ts --network minievm

# Run tests locally first
npx hardhat test
```

---

## File Reference

| File | Purpose |
|------|---------|
| `CONTRACT_SNAPSHOT.json` | Frozen interface snapshot of all 14 contracts |
| `scripts/check-interfaces.ts` | Compares new contracts against snapshot, reports diffs |
| `scripts/deploy.ts` | 12-step deployment script |
| `scripts/wire.ts` | Post-deploy wiring (roles, items, badges, pools) |
| `test/shared/fixtures.ts` | Test fixture that mirrors deploy+wire |
| `deployed-addresses.json` | Auto-generated addresses (gitignored) |
| `PixelVault_Developer_Guide.docx` | Frontend dev guide for juniors |

---

## Typical AI Prompt for Fixing After Replacement

After running the diff checker, paste the output to your AI and say:

> "Here is the diff report from check-interfaces.ts after I replaced [contract name]. 
> Fix deploy.ts, wire.ts, and test/shared/fixtures.ts to match the new contract interfaces. 
> The snapshot of the original interfaces is in CONTRACT_SNAPSHOT.json."
