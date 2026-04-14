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
#  5. Builds locally to validate
#  6. Deploys to Vercel production
#  7. Verifies the deployment works end-to-end
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
pkill -f 'cloudflared tunnel' 2>/dev/null || true
sleep 2
echo "✓ Old tunnels stopped"
echo ""

# ── Step 2: Verify local node is running ──────────────────────────────────
echo "⏳ Checking local node..."
if ! curl -sS -m 5 http://localhost:8545 -X POST \
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

cloudflared tunnel --url http://localhost:8545 > /tmp/cf-evm.log 2>&1 &
EVM_PID=$!
cloudflared tunnel --url http://localhost:26657 > /tmp/cf-cosmos-rpc.log 2>&1 &
RPC_PID=$!
cloudflared tunnel --url http://localhost:1317 > /tmp/cf-cosmos-rest.log 2>&1 &
REST_PID=$!

# Wait for all 3 tunnel URLs (up to 45s)
MAX_WAIT=45
EVM_URL="" COSMOS_RPC_URL="" COSMOS_REST_URL=""
for i in $(seq 1 $MAX_WAIT); do
  [[ -z "$EVM_URL" ]] && EVM_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-evm.log 2>/dev/null | head -1 || true)
  [[ -z "$COSMOS_RPC_URL" ]] && COSMOS_RPC_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-cosmos-rpc.log 2>/dev/null | head -1 || true)
  [[ -z "$COSMOS_REST_URL" ]] && COSMOS_REST_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-cosmos-rest.log 2>/dev/null | head -1 || true)

  if [[ -n "$EVM_URL" && -n "$COSMOS_RPC_URL" && -n "$COSMOS_REST_URL" ]]; then
    break
  fi
  echo -ne "  Waiting for tunnel URLs... ${i}/${MAX_WAIT}s\r"
  sleep 1
done
echo ""

if [[ -z "$EVM_URL" || -z "$COSMOS_RPC_URL" || -z "$COSMOS_REST_URL" ]]; then
  echo "✗ Failed to get all tunnel URLs within ${MAX_WAIT}s"
  echo "  EVM:         ${EVM_URL:-MISSING}"
  echo "  Cosmos RPC:  ${COSMOS_RPC_URL:-MISSING}"
  echo "  Cosmos REST: ${COSMOS_REST_URL:-MISSING}"
  echo ""
  echo "  Check logs: cat /tmp/cf-evm.log"
  exit 1
fi

echo "✓ Tunnels started:"
echo "  EVM RPC:     $EVM_URL"
echo "  Cosmos RPC:  $COSMOS_RPC_URL"
echo "  Cosmos REST: $COSMOS_REST_URL"
echo ""

# ── Step 4: Verify tunnels are working ───────────────────────────────────
echo "⏳ Verifying tunnels..."
for attempt in $(seq 1 8); do
  EVM_TEST=$(curl -sS -m 10 -X POST "$EVM_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$EVM_TEST" | grep -q "result"; then
    break
  fi
  if [[ $attempt -eq 8 ]]; then
    echo "✗ EVM tunnel not responding after 8 attempts"
    exit 1
  fi
  echo "  EVM tunnel not ready yet (attempt $attempt/8)..."
  sleep 3
done
echo "✓ EVM tunnel verified"

echo "⏳ Verifying Cosmos REST tunnel..."
for attempt in $(seq 1 20); do
  REST_TEST=$(curl -sS -m 15 \
    "$COSMOS_REST_URL/cosmos/base/tendermint/v1beta1/node_info" || true)

  if echo "$REST_TEST" | grep -q "default_node_info"; then
    echo "✓ Cosmos REST tunnel verified"
    break
  fi

  if [[ $attempt -eq 20 ]]; then
    echo "✗ Cosmos REST tunnel not responding after 20 attempts"
    echo "Last response: $REST_TEST"
    exit 1
  fi

  echo "  Cosmos REST tunnel not ready yet (attempt $attempt/20)..."
  sleep 5
done
echo "✓ Cosmos REST tunnel verified"
echo ""

# ── Step 5: Install deps if needed ───────────────────────────────────────
if [[ ! -d node_modules ]]; then
  echo "⏳ Installing dependencies..."
  npm ci --silent
  echo "✓ Dependencies installed"
  echo ""
fi

# ── Step 6: Build locally to validate ────────────────────────────────────
echo "⏳ Building frontend locally..."
if ! npm run build 2>&1 | tail -5; then
  echo "✗ Build failed! Fix errors above before deploying."
  exit 1
fi
echo "✓ Build successful"
echo ""

# ── Step 7: Update Vercel env vars ───────────────────────────────────────
echo "⏳ Updating Vercel environment variables..."

# Remove old values (suppress all output, ignore failures)
for var in EVM_RPC_URL COSMOS_RPC_URL COSMOS_REST_URL; do
  for env in production preview development; do
    vercel env rm "$var" "$env" -y > /dev/null 2>&1 || true
  done
done

# Small delay to let Vercel process removals
sleep 1

# Add new values for production + preview
echo -n "$EVM_URL" | vercel env add EVM_RPC_URL production -y > /dev/null 2>&1
echo -n "$EVM_URL" | vercel env add EVM_RPC_URL preview -y > /dev/null 2>&1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL production -y > /dev/null 2>&1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL preview -y > /dev/null 2>&1
echo -n "$COSMOS_REST_URL" | vercel env add COSMOS_REST_URL production -y > /dev/null 2>&1
echo -n "$COSMOS_REST_URL" | vercel env add COSMOS_REST_URL preview -y > /dev/null 2>&1

echo "✓ Vercel env vars updated"
echo ""

# ── Step 8: Deploy ───────────────────────────────────────────────────────
echo "⏳ Deploying to Vercel production..."
if ! vercel --prod 2>&1 | tail -5; then
  echo "✗ Vercel deploy failed"
  exit 1
fi
echo ""

# ── Step 9: Verify deployment ────────────────────────────────────────────
echo "⏳ Waiting 8s for deployment to propagate..."
sleep 8

echo "⏳ Verifying deployment..."
VERIFY_OK=false
for attempt in $(seq 1 5); do
  VERIFY=$(curl -sS -m 10 -X POST https://pixelvault-two.vercel.app/evm-rpc \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$VERIFY" | grep -q "result"; then
    VERIFY_OK=true
    break
  fi
  echo "  Deployment not ready yet (attempt $attempt/5)..."
  sleep 5
done

if [ "$VERIFY_OK" = true ]; then
  echo "✓ Deployment verified! EVM RPC working through Vercel"
else
  echo "⚠ Deployment verification timed out. It may need a few more seconds."
  echo "  Test manually: curl -X POST https://pixelvault-two.vercel.app/evm-rpc -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"id\":1}'"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deploy complete!                             ║"
echo "║  Site: https://pixelvault-two.vercel.app         ║"
echo "║                                                  ║"
echo "║  Tunnel PIDs: EVM=$EVM_PID RPC=$RPC_PID REST=$REST_PID"
echo "║  ⚠  Keep this terminal open — tunnels die if    ║"
echo "║     the machine sleeps or terminal closes.       ║"
echo "╚══════════════════════════════════════════════════╝"
