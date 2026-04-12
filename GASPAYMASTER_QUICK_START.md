# PixelVault GasPaymaster + Item Utility — Quick Start Guide

## What's New

### 🔋 GasPaymaster (Pay Gas with Game Tokens)
Players can now use **DNGN** or **HRV** to pay for transaction gas instead of native **GAS** tokens.

**Why it matters**: "Real differentiator, judges can actually see and experience it" — shows the power of meta-transactions for game economies.

### 🎁 Item Utility (Passive Bonuses)
Items in inventory now grant passive bonuses. Shows concept with UI demonstrations.

**Why it matters**: Demonstrates how items create economic value and player progression.

---

## Using GasPaymaster

### Quick Start
1. Go to **Dungeon Drops** or **Harvest Field**
2. Look for the toggle: **"Pay gas with DNGN"** or **"Pay gas with HRV"**
3. Enable the toggle (blue = enabled, gray = disabled)
4. Play the game — gas is paid with game tokens instead of native GAS

### On First Use
- You'll see two approval prompts (standard ERC20 behavior)
  - First: Approve gas sponsorship tokens to GasPaymaster
  - Second: Do the game action (dungeon run, harvest, etc.)
- Subsequent actions only need one transaction

### Payment History
- Go to **Gas Settings** page
- Scroll to **"Payment History"** section
- See all your gas payments with tokens used and PXL equivalent

### Exchange Rates
- Also in **Gas Settings**
- Shows how many DNGN/HRV equals 1 PXL
- Updates from the DEX automatically

---

## Viewing Item Bonuses

### Dungeon Drops
1. Go to **Dungeon Drops** page
2. If you own items, scroll down to **"Your Equipment"**
3. See all held items with:
   - Emoji icon (⚔️🛡️👑)
   - Rarity (Common, Rare, Legendary)  
   - Bonus description
   - Quantity owned (×N)

**Available items**:
- **Common Sword** (×60% drop) → +5% crit chance
- **Rare Shield** (×30% drop) → +10% defense, -1 DNGN entry fee
- **Legendary Crown** (×10% drop) → +25% loot quality, -3 DNGN entry fee

### Harvest Field
1. Go to **Harvest Field** page
2. If you own the Seasonal Bundle, see **"Active Bonus"** section
3. Shows: 🌾 Seasonal Harvest Bundle → +15% staking reward multiplier
4. When calculating rewards, the UI shows both:
   - Base reward: `100 HRV`
   - With bonus: `115 HRV`

---

## How It Works (Technical)

### GasPaymaster Flow
```
You toggle "Pay gas with DNGN" → 
TBA approves GasPaymaster for 5 DNGN →
You click "Enter Dungeon" →
Frontend routes through GasPaymaster.executeWithGameToken(DNGN, 5e18, DungeonDrops, calldata) →
GasPaymaster takes 5 DNGN, swaps to PXL via DEX →
GasPaymaster forwards the game call using ERC-2771 meta-tx →
Game sees TBA as sender, charges 10 DNGN entry fee →
Unused PXL refunded to TBA →
Event logged: GasSponsored(TBA, DNGN, 5e18, pxlReceived, DungeonDrops, true)
```

### Why This Is Cool
1. **No native gas needed** — Player never touches native GAS token
2. **DEX integration** — Game tokens automatically converted to PXL for gas
3. **ERC-2771 meta-tx** — Smart contract forwards the call with sender appended
4. **Refund mechanism** — Unused PXL returned to player
5. **Event transparency** — On-chain record of all gas payments

---

## localStorage Preferences

The toggles are saved in your browser:
- **DungeonDrops**: Key `pv-gas-dungeon` → "on" or "off"
- **HarvestField**: Key `pv-gas-harvest` → "on" or "off"

**Persist across**: Browser sessions, page reloads  
**Reset on**: Browser cache clear, incognito mode exit, localStorage deletion

---

## Troubleshooting

### "Approval failed"
- Check that you have enough DNGN/HRV in your account
- First use requires two approvals (normal for ERC20 + meta-tx)

### "Payment History is empty"
- History only shows after you've used GasPaymaster
- Enable the toggle and complete one action
- Then check Gas Settings → Payment History

### "Exchange rates showing 0"
- DEX might not have enough liquidity
- Wait a moment and refresh
- Fallback values used if query fails

### "Cosmos REST endpoint failing"
- This is tunnel connectivity (not your issue)
- EVM RPC still works fine
- Game functionality unaffected

---

## Deployment Information

**Live Site**: https://pixelvault-two.vercel.app

**Deploy Script**: `bash scripts/deploy-frontend.sh`
- Starts new cloudflared tunnels
- Builds locally
- Updates Vercel env vars
- Deploys to production
- Verifies end-to-end

**Keep terminal open** — tunnels run in background

---

## FAQ

**Q: Will these bonuses be enforced on-chain?**  
A: Currently they're UI-only (suitable for hackathon). Phase 2 will enforce them in smart contracts.

**Q: Can I turn off GasPaymaster?**  
A: Yes! Toggle is on by default but can be disabled. You'll pay with native GAS instead.

**Q: How much gas do I pay?**  
A: Fixed 5 tokens per action (5 DNGN for Dungeon, 5 HRV for Harvest). Gets swapped to PXL.

**Q: Do I need to approve every time?**  
A: First action needs two approvals. After that, only one transaction per action (fast).

**Q: What if I have 0 of an item?**  
A: Bonuses don't show in UI. They only appear if you own ≥1 of the item.

**Q: Can I trade items for bonuses?**  
A: Yes! Buy items in Marketplace or BarterMarket, then get instant bonuses (for UI demonstrations).

---

## Code Reference

### Files Updated
- `frontend/src/hooks/useTBA.ts` — `executeViaPaymaster()` function
- `frontend/src/pages/DungeonDrops.tsx` — Gas toggle + item UI
- `frontend/src/pages/HarvestField.tsx` — Gas toggle + bonus display
- `frontend/src/pages/GasSettings.tsx` — Status page
- `scripts/deploy-frontend.sh` — Enhanced deployment

### Contract Addresses (from deployed-addresses.json)
- GasPaymaster: `0xb45a24715BEE2B761167b46aFB69A4A9822bee6e`
- DungeonDrops: `0x7285b97D6FdCc3716C198d54A2842e5eb5a4D1F8`
- HarvestField: `0xFf1ab7297E4E800f0BB4F804Cd4F42441fc6a338`
- PixelVaultDEX: `0x117d29c5a273b80e86BdE477ff53C5861a73BD7d`

---

**Last Updated**: Today  
**Feature Status**: ✅ Production  
**Documentation**: IMPLEMENTATION_SUMMARY.md (in repo root)
