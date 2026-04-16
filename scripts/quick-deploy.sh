#!/usr/bin/env bash
# ============================================================================
#  Quick Deploy — Get the site up RIGHT NOW with Quick Tunnels
#
#  Usage: bash scripts/quick-deploy.sh
#
#  This uses ephemeral Quick Tunnels. The site will work for hours but tunnels
#  may die. For permanent stability, use: bash scripts/setup-named-tunnel.sh
# ============================================================================
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
PIDDIR="/tmp/pixelvault-tunnels"
mkdir -p "$PIDDIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║     PixelVault Quick Deploy (Ephemeral Tunnels)  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Verify local node ────────────────────────────────────────────
echo "⏳ Checking local node..."
if ! curl -sS -m 5 http://localhost:8545 -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' >/dev/null 2>&1; then
  echo "✗ Local EVM node (port 8545) is not running!"
  echo "  Start it with: weave rollup start"
  exit 1
fi
echo "✓ Local node is running (EVM:8545, Cosmos RPC:26657, REST:1317)"
echo ""

# ── Step 2: Kill old tunnels ─────────────────────────────────────────────
echo "⏳ Killing old cloudflared processes..."
pkill -f 'cloudflared tunnel' 2>/dev/null || true
sleep 2
rm -f "$PIDDIR"/*.pid "$PIDDIR"/*.log "$PIDDIR"/*.url
echo "✓ Old tunnels cleared"
echo ""

# ── Step 3: Start 3 tunnels as background processes (no tmux) ────────────
start_tunnel() {
  local name="$1" port="$2"
  local logfile="$PIDDIR/${name}.log"
  local pidfile="$PIDDIR/${name}.pid"
  local urlfile="$PIDDIR/${name}.url"

  > "$logfile"
  nohup cloudflared tunnel --protocol http2 --url "http://localhost:${port}" \
    > "$logfile" 2>&1 &
  echo $! > "$pidfile"
  echo "  Started $name tunnel (PID $(cat "$pidfile"), port $port)"
}

echo "⏳ Starting tunnels..."
start_tunnel "evm" 8545
start_tunnel "cosmos-rpc" 26657
start_tunnel "cosmos-rest" 1317
echo ""

# ── Step 4: Wait for URLs ────────────────────────────────────────────────
echo "⏳ Waiting for tunnel URLs..."
MAX_WAIT=60
EVM_URL="" COSMOS_RPC_URL="" COSMOS_REST_URL=""

for i in $(seq 1 $MAX_WAIT); do
  [[ -z "$EVM_URL" ]] && EVM_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$PIDDIR/evm.log" 2>/dev/null | head -1 || true)
  [[ -z "$COSMOS_RPC_URL" ]] && COSMOS_RPC_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$PIDDIR/cosmos-rpc.log" 2>/dev/null | head -1 || true)
  [[ -z "$COSMOS_REST_URL" ]] && COSMOS_REST_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$PIDDIR/cosmos-rest.log" 2>/dev/null | head -1 || true)

  if [[ -n "$EVM_URL" && -n "$COSMOS_RPC_URL" && -n "$COSMOS_REST_URL" ]]; then
    break
  fi
  printf "  %d/%ds  EVM:%s  RPC:%s  REST:%s\r" "$i" "$MAX_WAIT" \
    "${EVM_URL:+✓}" "${COSMOS_RPC_URL:+✓}" "${COSMOS_REST_URL:+✓}"
  sleep 1
done
echo ""

if [[ -z "$EVM_URL" || -z "$COSMOS_RPC_URL" || -z "$COSMOS_REST_URL" ]]; then
  echo "✗ Failed to get all tunnel URLs within ${MAX_WAIT}s"
  echo "  EVM:         ${EVM_URL:-MISSING}"
  echo "  Cosmos RPC:  ${COSMOS_RPC_URL:-MISSING}"
  echo "  Cosmos REST: ${COSMOS_REST_URL:-MISSING}"
  echo ""
  echo "  Check logs: cat $PIDDIR/evm.log"
  exit 1
fi

# Save URLs for the watchdog
echo "$EVM_URL" > "$PIDDIR/evm.url"
echo "$COSMOS_RPC_URL" > "$PIDDIR/cosmos-rpc.url"
echo "$COSMOS_REST_URL" > "$PIDDIR/cosmos-rest.url"

echo "✓ Tunnels active:"
echo "  EVM RPC:     $EVM_URL"
echo "  Cosmos RPC:  $COSMOS_RPC_URL"
echo "  Cosmos REST: $COSMOS_REST_URL"
echo ""

# ── Step 5: Verify at least the EVM tunnel works ─────────────────────────
echo "⏳ Verifying EVM tunnel (may take ~15s for DNS)..."
VERIFIED=false
for attempt in $(seq 1 6); do
  TEST=$(curl -sS --max-time 10 -X POST "$EVM_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$TEST" | grep -q '"result"'; then
    VERIFIED=true
    break
  fi
  echo "  Attempt $attempt/6 — waiting for DNS..."
  sleep 5
done

if $VERIFIED; then
  echo "✓ EVM tunnel verified"
else
  echo "⚠ EVM tunnel not yet reachable (DNS may need more time)"
  echo "  Continuing — Vercel's DNS resolvers are often faster"
fi
echo ""

# ── Step 6: Update Vercel env vars ───────────────────────────────────────
echo "⏳ Updating Vercel environment variables..."
cd "$FRONTEND_DIR"

for var in EVM_RPC_URL COSMOS_RPC_URL COSMOS_REST_URL; do
  for env in production preview; do
    vercel env rm "$var" "$env" -y > /dev/null 2>&1 || true
  done
done
sleep 1

echo -n "$EVM_URL"        | vercel env add EVM_RPC_URL    production -y > /dev/null 2>&1
echo -n "$EVM_URL"        | vercel env add EVM_RPC_URL    preview    -y > /dev/null 2>&1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL production -y > /dev/null 2>&1
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL preview    -y > /dev/null 2>&1
echo -n "$COSMOS_REST_URL"| vercel env add COSMOS_REST_URL production -y > /dev/null 2>&1
echo -n "$COSMOS_REST_URL"| vercel env add COSMOS_REST_URL preview    -y > /dev/null 2>&1

echo "✓ Vercel env vars updated"
echo ""

# ── Step 7: Deploy to Vercel ─────────────────────────────────────────────
echo "⏳ Deploying to Vercel production..."
vercel --prod 2>&1 | tail -5
echo ""

# ── Step 8: Verify deployment ────────────────────────────────────────────
echo "⏳ Waiting for deployment to propagate (10s)..."
sleep 10

echo "⏳ Verifying production site..."
SITE_OK=false
for attempt in $(seq 1 5); do
  VERIFY=$(curl -sS --max-time 10 -X POST https://pixelvault-two.vercel.app/evm-rpc \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' 2>&1 || true)
  if echo "$VERIFY" | grep -q '"result"'; then
    SITE_OK=true
    break
  fi
  echo "  Attempt $attempt/5..."
  sleep 5
done

if $SITE_OK; then
  echo "✓ Site verified! EVM RPC working through Vercel"
else
  echo "⚠ Verification timed out — may need a few more seconds"
  echo "  Test: curl -X POST https://pixelvault-two.vercel.app/evm-rpc -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"id\":1}'"
fi

echo ""

# ── Step 9: Start watchdog ───────────────────────────────────────────────
echo "⏳ Starting background watchdog..."
nohup bash "$(cd "$(dirname "$0")" && pwd)/tunnel-watchdog-v2.sh" \
  >> /tmp/tunnel-watchdog.log 2>&1 &
WATCHDOG_PID=$!
echo "$WATCHDOG_PID" > "$PIDDIR/watchdog.pid"
echo "✓ Watchdog running (PID $WATCHDOG_PID)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deploy complete!                             ║"
echo "║  Site: https://pixelvault-two.vercel.app         ║"
echo "║                                                  ║"
echo "║  Tunnel PIDs: cat /tmp/pixelvault-tunnels/*.pid  ║"
echo "║  Watchdog log: tail -f /tmp/tunnel-watchdog.log  ║"
echo "║                                                  ║"
echo "║  ⚠  Quick Tunnels are ephemeral!                 ║"
echo "║  For permanent stability, run:                   ║"
echo "║    bash scripts/setup-named-tunnel.sh            ║"
echo "╚══════════════════════════════════════════════════╝"
