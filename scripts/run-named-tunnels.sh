#!/usr/bin/env bash
# ============================================================================
#  Run Named Tunnels — Daily use script
#
#  Usage: bash scripts/run-named-tunnels.sh
#
#  Prerequisites: Run scripts/setup-named-tunnel.sh first (one-time setup)
#
#  This starts the cloudflared tunnel with your permanent config.
#  URLs never change. No Vercel redeploy needed.
# ============================================================================
set -euo pipefail

CONFIG="$HOME/.cloudflared/config.yml"

echo "╔══════════════════════════════════════════════════╗"
echo "║  PixelVault Named Tunnel Runner                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Verify config exists
if [[ ! -f "$CONFIG" ]]; then
  echo "✗ No tunnel config found at $CONFIG"
  echo "  Run first: bash scripts/setup-named-tunnel.sh"
  exit 1
fi

# Verify local node is running
if ! curl -sS -m 5 http://localhost:8545 -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' >/dev/null 2>&1; then
  echo "✗ Local EVM node is not running!"
  echo "  Start it with: weave rollup start"
  exit 1
fi
echo "✓ Local node is running"

# Show config
echo "✓ Tunnel config: $CONFIG"
echo ""
echo "  Routes:"
grep 'hostname:' "$CONFIG" | while read -r line; do
  echo "    $line"
done
echo ""

# Kill any existing tunnel
pkill -f 'cloudflared tunnel run' 2>/dev/null || true
sleep 1

# Run tunnel in foreground (Ctrl+C to stop)
echo "Starting tunnel... (Ctrl+C to stop)"
echo "═════════════════════════════════════════════"
exec cloudflared tunnel run
