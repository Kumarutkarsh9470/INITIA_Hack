#!/usr/bin/env bash
# ============================================================================
#  PixelVault Frontend Deploy Script
#  Usage: bash scripts/deploy-frontend.sh
#
#  This script:
#  1. Kills old cloudflared tunnels
#  2. Starts 3 new tunnels (EVM, Cosmos RPC, Cosmos REST)
#  3. Waits for tunnel URLs to be assigned
#  4. Updates ALL Vercel env vars (production + preview)
#  5. Deploys to Vercel production
#  6. Verifies the deployment works end-to-end
# ============================================================================
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
cd "$FRONTEND_DIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║        PixelVault Frontend Deployer              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Kill old tunnels ──────────────────────────────────────────────
echo "⏳ Killing existing cloudflared tunnels..."
killall -9 cloudflared 2>/dev/null || true
sleep 2
echo "✓ Old tunnels stopped"
echo ""

# ── Step 2: Verify local node is running ──────────────────────────────────
echo "⏳ Checking local node..."
if ! curl -sS -m 3 http://localhost:8545 -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' >/dev/null 2>&1; then
  echo "✗ Local EVM node (port 8545) is not running!"
  echo "  Start it with: weave rollup start"
  exit 1
fi
echo "✓ Local EVM node is running"
echo ""

# ── Step 3: Start tunnels ────────────────────────────────────────────────
echo "⏳ Starting tunnels..."
rm -f /tmp/cf-evm.log /tmp/cf-cosmos-rpc.log /tmp/cf-cosmos-rest.log

nohup cloudflared tunnel --url http://localhost:8545 > /tmp/cf-evm.log 2>&1 &
nohup cloudflared tunnel --url http://localhost:26657 > /tmp/cf-cosmos-rpc.log 2>&1 &
nohup cloudflared tunnel --url http://localhost:1317 > /tmp/cf-cosmos-rest.log 2>&1 &

# Wait for all 3 tunnel URLs
MAX_WAIT=30
for i in $(seq 1 $MAX_WAIT); do
  EVM_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-evm.log 2>/dev/null | head -1 || true)
  COSMOS_RPC_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-cosmos-rpc.log 2>/dev/null | head -1 || true)
  COSMOS_REST_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-cosmos-rest.log 2>/dev/null | head -1 || true)

  if [[ -n "$EVM_URL" && -n "$COSMOS_RPC_URL" && -n "$COSMOS_REST_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$EVM_URL" || -z "$COSMOS_RPC_URL" || -z "$COSMOS_REST_URL" ]]; then
  echo "✗ Failed to get all tunnel URLs within ${MAX_WAIT}s"
  echo "  EVM:         ${EVM_URL:-MISSING}"
  echo "  Cosmos RPC:  ${COSMOS_RPC_URL:-MISSING}"
  echo "  Cosmos REST: ${COSMOS_REST_URL:-MISSING}"
  exit 1
fi

echo "✓ Tunnels started:"
echo "  EVM RPC:     $EVM_URL"
echo "  Cosmos RPC:  $COSMOS_RPC_URL"
echo "  Cosmos REST: $COSMOS_REST_URL"
echo ""

# ── Step 4: Verify tunnels are working ───────────────────────────────────
echo "⏳ Verifying tunnels..."
EVM_TEST=$(curl -sS -m 10 -X POST "$EVM_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1)

if ! echo "$EVM_TEST" | grep -q "result"; then
  echo "✗ EVM tunnel not responding: $EVM_TEST"
  exit 1
fi
echo "✓ EVM tunnel verified"

REST_TEST=$(curl -sS -m 10 "$COSMOS_REST_URL/cosmos/base/tendermint/v1beta1/node_info" 2>&1 | head -c 50)
if ! echo "$REST_TEST" | grep -q "node_info"; then
  echo "✗ Cosmos REST tunnel not responding: $REST_TEST"
  exit 1
fi
echo "✓ Cosmos REST tunnel verified"
echo ""

# ── Step 5: Update Vercel env vars ───────────────────────────────────────
echo "⏳ Updating Vercel environment variables..."

# Remove old values from all environments
for env in production preview development; do
  for var in EVM_RPC_URL COSMOS_RPC_URL COSMOS_REST_URL; do
    vercel env rm "$var" "$env" -y 2>/dev/null || true
  done
done

# Add new values for production + preview (both matter)
echo -n "$EVM_URL" | vercel env add EVM_RPC_URL production -y 2>&1 | tail -1
echo -n "$EVM_URL" | vercel env add EVM_RPC_URL preview -y 2>&1 | tail -1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL production -y 2>&1 | tail -1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL preview -y 2>&1 | tail -1
echo -n "$COSMOS_REST_URL" | vercel env add COSMOS_REST_URL production -y 2>&1 | tail -1
echo -n "$COSMOS_REST_URL" | vercel env add COSMOS_REST_URL preview -y 2>&1 | tail -1

echo "✓ Vercel env vars updated"
echo ""

# ── Step 6: Deploy ───────────────────────────────────────────────────────
echo "⏳ Deploying to Vercel production..."
DEPLOY_OUTPUT=$(vercel --prod 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://pixelvault-two\.vercel\.app' | head -1)
echo "$DEPLOY_OUTPUT" | tail -3
echo ""

# ── Step 7: Verify deployment ────────────────────────────────────────────
echo "⏳ Waiting 5s for deployment to propagate..."
sleep 5

echo "⏳ Verifying deployment..."
VERIFY=$(curl -sS -m 10 -X POST https://pixelvault-two.vercel.app/evm-rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1)

if echo "$VERIFY" | grep -q "result"; then
  echo "✓ Deployment verified! EVM RPC working through Vercel"
else
  echo "✗ Deployment verification failed: $VERIFY"
  echo "  The deployment may need a moment to propagate. Try again in 30s."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deploy complete!                             ║"
echo "║  Site: https://pixelvault-two.vercel.app         ║"
echo "║                                                  ║"
echo "║  ⚠  Keep this terminal open — tunnels die if    ║"
echo "║     the machine sleeps or terminal closes.       ║"
echo "╚══════════════════════════════════════════════════╝"
