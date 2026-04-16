#!/usr/bin/env bash
# ============================================================================
#  Tunnel Watchdog v2 — Keeps Quick Tunnels alive without tmux
#
#  Runs as a plain background process. Monitors tunnel PIDs and local
#  connectivity. If a tunnel dies, restarts it + updates Vercel + redeploys.
#
#  Started automatically by quick-deploy.sh.
#  Log: /tmp/tunnel-watchdog.log
#  Kill: kill $(cat /tmp/pixelvault-tunnels/watchdog.pid)
# ============================================================================
set -uo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
PIDDIR="/tmp/pixelvault-tunnels"
CHECK_INTERVAL=45

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

is_tunnel_alive() {
  local name="$1" port="$2"
  local pidfile="$PIDDIR/${name}.pid"

  # Check PID exists and process is running
  if [[ ! -f "$pidfile" ]]; then return 1; fi
  local pid
  pid=$(cat "$pidfile")
  if ! kill -0 "$pid" 2>/dev/null; then return 1; fi

  # Check local port responds
  if [[ "$name" == "evm" ]]; then
    curl -sS --max-time 5 "http://localhost:${port}" \
      -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' 2>/dev/null | grep -q '"result"'
  elif [[ "$name" == "cosmos-rpc" ]]; then
    curl -sS --max-time 5 "http://localhost:${port}/status" 2>/dev/null | grep -q 'node_info'
  elif [[ "$name" == "cosmos-rest" ]]; then
    curl -sS --max-time 5 "http://localhost:${port}/cosmos/base/tendermint/v1beta1/node_info" 2>/dev/null | grep -q 'node_info'
  fi
}

restart_tunnel() {
  local name="$1" port="$2"
  local pidfile="$PIDDIR/${name}.pid"
  local logfile="$PIDDIR/${name}.log"
  local urlfile="$PIDDIR/${name}.url"

  # Kill old process
  if [[ -f "$pidfile" ]]; then
    kill "$(cat "$pidfile")" 2>/dev/null || true
  fi
  sleep 1

  # Start new tunnel
  > "$logfile"
  nohup cloudflared tunnel --protocol http2 --url "http://localhost:${port}" \
    > "$logfile" 2>&1 &
  echo $! > "$pidfile"

  # Wait for URL
  local url=""
  for i in $(seq 1 20); do
    url=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$logfile" 2>/dev/null | head -1 || true)
    if [[ -n "$url" ]]; then
      echo "$url" > "$urlfile"
      echo "$url"
      return 0
    fi
    sleep 1
  done
  echo ""
  return 1
}

update_vercel_and_redeploy() {
  local evm_url="$1" rpc_url="$2" rest_url="$3"
  cd "$FRONTEND_DIR"

  for var in EVM_RPC_URL COSMOS_RPC_URL COSMOS_REST_URL; do
    for env in production preview; do
      vercel env rm "$var" "$env" -y > /dev/null 2>&1 || true
    done
  done
  sleep 1

  echo -n "$evm_url"  | vercel env add EVM_RPC_URL    production -y > /dev/null 2>&1
  echo -n "$evm_url"  | vercel env add EVM_RPC_URL    preview    -y > /dev/null 2>&1
  echo -n "$rpc_url"  | vercel env add COSMOS_RPC_URL production -y > /dev/null 2>&1
  echo -n "$rpc_url"  | vercel env add COSMOS_RPC_URL preview    -y > /dev/null 2>&1
  echo -n "$rest_url" | vercel env add COSMOS_REST_URL production -y > /dev/null 2>&1
  echo -n "$rest_url" | vercel env add COSMOS_REST_URL preview    -y > /dev/null 2>&1

  log "  Vercel env vars updated, deploying..."
  vercel --prod > /dev/null 2>&1
  log "  Redeploy complete"
}

# ── Main loop ─────────────────────────────────────────────────────────────
log "=== Tunnel Watchdog v2 started (interval: ${CHECK_INTERVAL}s) ==="

while true; do
  sleep "$CHECK_INTERVAL"
  NEED_REDEPLOY=false

  for entry in "evm:8545" "cosmos-rpc:26657" "cosmos-rest:1317"; do
    name="${entry%%:*}"
    port="${entry##*:}"

    if ! is_tunnel_alive "$name" "$port"; then
      log "$name tunnel appears dead — restarting..."
      new_url=$(restart_tunnel "$name" "$port")
      if [[ -n "$new_url" ]]; then
        log "  $name restarted: $new_url"
        NEED_REDEPLOY=true
      else
        log "  ERROR: $name tunnel failed to start!"
      fi
    fi
  done

  if $NEED_REDEPLOY; then
    evm_url=$(cat "$PIDDIR/evm.url" 2>/dev/null || true)
    rpc_url=$(cat "$PIDDIR/cosmos-rpc.url" 2>/dev/null || true)
    rest_url=$(cat "$PIDDIR/cosmos-rest.url" 2>/dev/null || true)

    if [[ -n "$evm_url" && -n "$rpc_url" && -n "$rest_url" ]]; then
      log "Updating Vercel and redeploying..."
      update_vercel_and_redeploy "$evm_url" "$rpc_url" "$rest_url"
    else
      log "ERROR: Missing tunnel URLs, skipping redeploy"
    fi
  fi
done
