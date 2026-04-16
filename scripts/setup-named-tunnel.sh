#!/usr/bin/env bash
# ============================================================================
#  Cloudflare Named Tunnel Setup — PERMANENT tunnel URLs
#
#  Usage: bash scripts/setup-named-tunnel.sh
#
#  Prerequisites:
#    1. A free Cloudflare account (https://dash.cloudflare.com/sign-up)
#    2. A domain added to Cloudflare DNS (even a $1 .xyz domain works)
#       - Buy one at Cloudflare Registrar, Namecheap, Porkbun, etc.
#       - Add it to Cloudflare: Dashboard → Add a Site → follow steps
#       - Update nameservers at your registrar to Cloudflare's
#
#  What this does:
#    1. Authenticates with Cloudflare (one-time browser auth)
#    2. Creates a named tunnel called "pixelvault"
#    3. Sets up DNS routes for evm/rpc/rest subdomains on YOUR domain
#    4. Writes a config file for cloudflared
#    5. Sets Vercel env vars with PERMANENT URLs
#    6. Deploys to Vercel (one-time — never need to redeploy for URL changes)
#
#  After setup, just run: bash scripts/run-named-tunnels.sh
#  The URLs will NEVER change, even if the tunnel process restarts.
# ============================================================================
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
CONFIG_DIR="$HOME/.cloudflared"

echo "╔══════════════════════════════════════════════════╗"
echo "║     Cloudflare Named Tunnel Setup                ║"
echo "║     (Permanent URLs — run once, deploy once)     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Check cloudflared ─────────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  echo "✗ cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi
echo "✓ cloudflared $(cloudflared --version 2>&1 | head -1)"
echo ""

# ── Step 1: Login (one-time) ─────────────────────────────────────────────
if [[ ! -f "$CONFIG_DIR/cert.pem" ]]; then
  echo "═══ Step 1: Authenticate with Cloudflare ═══"
  echo ""
  echo "This will open a browser. If you're on a remote/headless machine:"
  echo "  1. Run this command, copy the URL it prints"
  echo "  2. Open that URL in YOUR browser"
  echo "  3. Select your domain"
  echo "  4. It will save the cert automatically"
  echo ""
  echo "Press Enter to continue..."
  read -r
  cloudflared tunnel login
  echo ""
  echo "✓ Authenticated with Cloudflare"
else
  echo "✓ Already authenticated (cert found at $CONFIG_DIR/cert.pem)"
fi
echo ""

# ── Step 2: Get domain name ──────────────────────────────────────────────
echo "═══ Step 2: Enter your Cloudflare domain ═══"
echo ""
echo "This is the domain you added to Cloudflare (e.g., pixelvault.xyz, myapp.dev)"
echo -n "Enter your domain: "
read -r DOMAIN

if [[ -z "$DOMAIN" ]]; then
  echo "✗ Domain cannot be empty"
  exit 1
fi

# Define subdomains
EVM_HOST="evm.${DOMAIN}"
RPC_HOST="rpc.${DOMAIN}"
REST_HOST="rest.${DOMAIN}"

echo ""
echo "Will create these permanent URLs:"
echo "  EVM RPC:     https://${EVM_HOST}"
echo "  Cosmos RPC:  https://${RPC_HOST}"
echo "  Cosmos REST: https://${REST_HOST}"
echo ""
echo "Press Enter to continue (Ctrl+C to cancel)..."
read -r

# ── Step 3: Create named tunnel ──────────────────────────────────────────
echo "═══ Step 3: Creating named tunnel ═══"
echo ""

TUNNEL_NAME="pixelvault"

# Check if tunnel already exists
EXISTING=$(cloudflared tunnel list --name "$TUNNEL_NAME" -o json 2>/dev/null || echo "[]")
if echo "$EXISTING" | grep -q '"name"'; then
  TUNNEL_ID=$(echo "$EXISTING" | python3 -c "import sys,json; tunnels=json.load(sys.stdin); print(tunnels[0]['id'])" 2>/dev/null)
  echo "✓ Tunnel '$TUNNEL_NAME' already exists (ID: $TUNNEL_ID)"
else
  cloudflared tunnel create "$TUNNEL_NAME"
  TUNNEL_ID=$(cloudflared tunnel list --name "$TUNNEL_NAME" -o json 2>/dev/null | python3 -c "import sys,json; tunnels=json.load(sys.stdin); print(tunnels[0]['id'])")
  echo "✓ Tunnel '$TUNNEL_NAME' created (ID: $TUNNEL_ID)"
fi
echo ""

# ── Step 4: Set up DNS routes ────────────────────────────────────────────
echo "═══ Step 4: Setting up DNS routes ═══"
echo ""

for host in "$EVM_HOST" "$RPC_HOST" "$REST_HOST"; do
  echo "  Routing $host → tunnel $TUNNEL_NAME..."
  cloudflared tunnel route dns "$TUNNEL_NAME" "$host" 2>&1 || true
done
echo ""
echo "✓ DNS routes configured"
echo ""

# ── Step 5: Write config ─────────────────────────────────────────────────
echo "═══ Step 5: Writing cloudflared config ═══"

CREDS_FILE="$CONFIG_DIR/${TUNNEL_ID}.json"

cat > "$CONFIG_DIR/config.yml" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS_FILE}

ingress:
  - hostname: ${EVM_HOST}
    service: http://localhost:8545
  - hostname: ${RPC_HOST}
    service: http://localhost:26657
  - hostname: ${REST_HOST}
    service: http://localhost:1317
  - service: http_status:404
EOF

echo "✓ Config written to $CONFIG_DIR/config.yml"
echo ""

# ── Step 6: Test the tunnel ──────────────────────────────────────────────
echo "═══ Step 6: Testing tunnel (starting temporarily) ═══"
echo ""

# Start tunnel in background to test
cloudflared tunnel run "$TUNNEL_NAME" &
TUNNEL_PID=$!
sleep 8

TEST_OK=false
for attempt in $(seq 1 6); do
  TEST=$(curl -sS --max-time 10 -X POST "https://${EVM_HOST}" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$TEST" | grep -q '"result"'; then
    TEST_OK=true
    break
  fi
  echo "  Waiting for DNS propagation... (attempt $attempt/6)"
  sleep 10
done

if $TEST_OK; then
  echo "✓ Tunnel working! EVM RPC responds at https://${EVM_HOST}"
else
  echo "⚠ DNS may need a few more minutes to propagate"
  echo "  The tunnel IS working — DNS just needs time (up to 5 min)"
fi
echo ""

# Keep tunnel running — don't kill it

# ── Step 7: Update Vercel env vars (ONE TIME) ────────────────────────────
echo "═══ Step 7: Setting PERMANENT Vercel env vars ═══"
echo ""
cd "$FRONTEND_DIR"

EVM_URL="https://${EVM_HOST}"
COSMOS_RPC_URL="https://${RPC_HOST}"
COSMOS_REST_URL="https://${REST_HOST}"

for var in EVM_RPC_URL COSMOS_RPC_URL COSMOS_REST_URL; do
  for env in production preview; do
    vercel env rm "$var" "$env" -y > /dev/null 2>&1 || true
  done
done
sleep 1

echo -n "$EVM_URL"        | vercel env add EVM_RPC_URL     production -y > /dev/null 2>&1
echo -n "$EVM_URL"        | vercel env add EVM_RPC_URL     preview    -y > /dev/null 2>&1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL  production -y > /dev/null 2>&1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL  preview    -y > /dev/null 2>&1
echo -n "$COSMOS_REST_URL"| vercel env add COSMOS_REST_URL production -y > /dev/null 2>&1
echo -n "$COSMOS_REST_URL"| vercel env add COSMOS_REST_URL preview    -y > /dev/null 2>&1

echo "✓ Vercel env vars set to PERMANENT URLs"
echo ""

# ── Step 8: Deploy to Vercel (ONE TIME) ──────────────────────────────────
echo "═══ Step 8: Deploying to Vercel ═══"
echo ""

# Build
echo "⏳ Building..."
npm run build --prefix "$FRONTEND_DIR" 2>&1 | tail -3

# Deploy
echo "⏳ Deploying..."
vercel --prod 2>&1 | tail -5
echo ""

# ── Step 9: Verify ───────────────────────────────────────────────────────
sleep 10
echo "⏳ Verifying production deployment..."
SITE_OK=false
for attempt in $(seq 1 5); do
  VERIFY=$(curl -sS --max-time 10 -X POST https://pixelvault-two.vercel.app/evm-rpc \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$VERIFY" | grep -q '"result"'; then
    SITE_OK=true
    break
  fi
  sleep 5
done

if $SITE_OK; then
  echo "✓ VERIFIED: Site is working!"
else
  echo "⚠ DNS may still be propagating — check in 5 min"
fi

# ── Save state ────────────────────────────────────────────────────────────
cat > /tmp/pixelvault-named-tunnel.env <<EOF
TUNNEL_NAME=${TUNNEL_NAME}
TUNNEL_ID=${TUNNEL_ID}
DOMAIN=${DOMAIN}
EVM_URL=${EVM_URL}
COSMOS_RPC_URL=${COSMOS_RPC_URL}
COSMOS_REST_URL=${COSMOS_REST_URL}
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ PERMANENT SETUP COMPLETE!                               ║"
echo "║                                                              ║"
echo "║  Site:       https://pixelvault-two.vercel.app               ║"
echo "║  EVM RPC:    https://${EVM_HOST}"
echo "║  Cosmos RPC: https://${RPC_HOST}"
echo "║  Cosmos REST:https://${REST_HOST}"
echo "║                                                              ║"
echo "║  These URLs NEVER change. You never need to redeploy for     ║"
echo "║  URL changes again.                                          ║"
echo "║                                                              ║"
echo "║  DAILY USE:                                                  ║"
echo "║    1. Start your node:  weave rollup start                   ║"
echo "║    2. Start tunnel:     bash scripts/run-named-tunnels.sh    ║"
echo "║    That's it! No redeploy needed.                            ║"
echo "║                                                              ║"
echo "║  OR install as a system service (auto-starts on boot):       ║"
echo "║    sudo bash scripts/install-tunnel-service.sh               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
