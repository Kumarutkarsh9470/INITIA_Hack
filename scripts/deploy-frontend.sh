#!/usr/bin/env bash
# ============================================================================
#  PixelVault Frontend Deploy Script (Simplified)
#
#  Usage: bash scripts/deploy-frontend.sh
#
#  This script ONLY handles building + deploying to Vercel.
#  Tunnel management is handled separately:
#    - Quick tunnels: bash scripts/quick-deploy.sh   (ephemeral, for testing)
#    - Named tunnels: bash scripts/run-named-tunnels.sh (permanent, for prod)
#
#  If you haven't set up tunnels yet, run quick-deploy.sh instead.
# ============================================================================
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
cd "$FRONTEND_DIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║        PixelVault Frontend Deployer              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Install deps if needed ───────────────────────────────────────
if [[ ! -d node_modules ]]; then
  echo "⏳ Installing dependencies..."
  npm ci --silent
  echo "✓ Dependencies installed"
  echo ""
fi

# ── Step 2: Build ────────────────────────────────────────────────────────
echo "⏳ Building frontend..."
if ! npm run build 2>&1 | tail -5; then
  echo "✗ Build failed! Fix errors above before deploying."
  exit 1
fi
echo "✓ Build successful"
echo ""

# ── Step 3: Deploy ───────────────────────────────────────────────────────
echo "⏳ Deploying to Vercel production..."
if ! vercel --prod 2>&1 | tail -5; then
  echo "✗ Vercel deploy failed"
  exit 1
fi
echo ""

# ── Step 4: Verify ───────────────────────────────────────────────────────
echo "⏳ Waiting for deployment to propagate..."
sleep 10

echo "⏳ Verifying..."
VERIFY_OK=false
for attempt in $(seq 1 5); do
  VERIFY=$(curl -sS -m 10 -X POST https://pixelvault-two.vercel.app/evm-rpc \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$VERIFY" | grep -q "result"; then
    VERIFY_OK=true
    break
  fi
  echo "  Attempt $attempt/5..."
  sleep 5
done

if [ "$VERIFY_OK" = true ]; then
  echo "✓ Deployment verified! EVM RPC working"
else
  echo "⚠ Verification timed out."
  echo "  Are tunnels running? Check with: pgrep -fa cloudflared"
  echo "  Quick fix: bash scripts/quick-deploy.sh"
  echo "  Permanent fix: bash scripts/setup-named-tunnel.sh"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deploy complete!                             ║"
echo "║  Site: https://pixelvault-two.vercel.app         ║"
echo "╚══════════════════════════════════════════════════╝"
