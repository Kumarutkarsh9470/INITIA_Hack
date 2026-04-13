#!/usr/bin/env bash
# ============================================================================
#  Tunnel Watchdog — keeps cloudflared tunnels alive and Vercel in sync
#
#  Usage:
#    bash scripts/tunnel-watchdog.sh          # run in foreground
#    nohup bash scripts/tunnel-watchdog.sh &  # run in background
#
#  What it does:
#    - Every 60 seconds, tests all 3 tunnel URLs
#    - If any tunnel is dead: restarts it, extracts new URL, updates Vercel
#      env var, triggers a Vercel redeploy
#    - Logs everything to /tmp/tunnel-watchdog.log
# ============================================================================
set -uo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
CHECK_INTERVAL=60  # seconds between checks

# Tunnel state files
EVM_LOG=/tmp/cf-evm.log
RPC_LOG=/tmp/cf-cosmos-rpc.log
REST_LOG=/tmp/cf-cosmos-rest.log
URL_FILE=/tmp/tunnel-urls.env  # persisted current URLs

LOG=/tmp/tunnel-watchdog.log

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# Load saved URLs if they exist
load_urls() {
  [[ -f "$URL_FILE" ]] && source "$URL_FILE"
}

save_urls() {
  cat > "$URL_FILE" <<EOF
EVM_URL="$EVM_URL"
RPC_URL="$RPC_URL"
REST_URL="$REST_URL"
EOF
}

# Extract URL from a cloudflared log file
extract_url() {
  grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$1" 2>/dev/null | head -1
}

# Test if a tunnel URL is responsive
test_tunnel() {
  local url="$1"
  local type="$2"  # evm, rpc, rest

  [[ -z "$url" ]] && return 1

  if [[ "$type" == "evm" ]]; then
    local resp
    resp=$(curl -sS --max-time 8 "$url" \
      -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' 2>/dev/null)
    echo "$resp" | grep -q '"result"' && return 0
  elif [[ "$type" == "rpc" ]]; then
    local resp
    resp=$(curl -sS --max-time 8 "$url/status" 2>/dev/null)
    echo "$resp" | grep -q 'node_info' && return 0
  elif [[ "$type" == "rest" ]]; then
    local resp
    resp=$(curl -sS --max-time 8 "$url/cosmos/base/tendermint/v1beta1/node_info" 2>/dev/null)
    echo "$resp" | grep -q 'node_info' && return 0
  fi
  return 1
}

# Start a single tunnel, wait for URL
start_tunnel() {
  local port="$1"
  local logfile="$2"

  # Kill any existing tunnel for this port
  pkill -f "cloudflared.*localhost:${port}" 2>/dev/null || true
  sleep 1

  > "$logfile"
  cloudflared tunnel --protocol http2 --url "http://localhost:${port}" > "$logfile" 2>&1 &

  # Wait up to 15s for URL
  for i in $(seq 1 15); do
    local url
    url=$(extract_url "$logfile")
    if [[ -n "$url" ]]; then
      echo "$url"
      return 0
    fi
    sleep 1
  done
  echo ""
  return 1
}

# Update a single Vercel env var and redeploy
update_vercel_env() {
  local varname="$1"
  local value="$2"

  cd "$FRONTEND_DIR"
  vercel env rm "$varname" production -y 2>/dev/null || true
  echo "$value" | vercel env add "$varname" production -y 2>/dev/null
  log "  Updated Vercel: $varname"
}

do_redeploy() {
  log "  Triggering Vercel redeploy..."
  cd "$FRONTEND_DIR"
  local out
  out=$(vercel --prod 2>&1 | tail -3)
  log "  $out"
}

# ---- MAIN LOOP ----

log "=== Tunnel Watchdog started ==="
log "Check interval: ${CHECK_INTERVAL}s"

# Initialize: ensure tunnels are running
EVM_URL=""
RPC_URL=""
REST_URL=""
load_urls

# On first run, check if tunnels exist at all
if ! pgrep -f 'cloudflared.*localhost:8545' >/dev/null 2>&1; then
  log "No EVM tunnel running, starting..."
  EVM_URL=$(start_tunnel 8545 "$EVM_LOG")
  log "  EVM: $EVM_URL"
fi

if ! pgrep -f 'cloudflared.*localhost:26657' >/dev/null 2>&1; then
  log "No Cosmos RPC tunnel running, starting..."
  RPC_URL=$(start_tunnel 26657 "$RPC_LOG")
  log "  RPC: $RPC_URL"
fi

if ! pgrep -f 'cloudflared.*localhost:1317' >/dev/null 2>&1; then
  log "No Cosmos REST tunnel running, starting..."
  REST_URL=$(start_tunnel 1317 "$REST_LOG")
  log "  REST: $REST_URL"
fi

# If we don't have URLs yet, extract from existing logs
[[ -z "$EVM_URL" ]] && EVM_URL=$(extract_url "$EVM_LOG")
[[ -z "$RPC_URL" ]] && RPC_URL=$(extract_url "$RPC_LOG")
[[ -z "$REST_URL" ]] && REST_URL=$(extract_url "$REST_LOG")

save_urls
log "Current URLs: EVM=$EVM_URL  RPC=$RPC_URL  REST=$REST_URL"

NEED_REDEPLOY=false

while true; do
  sleep "$CHECK_INTERVAL"
  NEED_REDEPLOY=false

  # Test EVM tunnel
  if ! test_tunnel "$EVM_URL" "evm"; then
    log "EVM tunnel DEAD — restarting..."
    EVM_URL=$(start_tunnel 8545 "$EVM_LOG")
    if [[ -n "$EVM_URL" ]]; then
      log "  New EVM: $EVM_URL"
      update_vercel_env "EVM_RPC_URL" "$EVM_URL"
      NEED_REDEPLOY=true
    else
      log "  ERROR: EVM tunnel failed to start"
    fi
  fi

  # Test Cosmos RPC tunnel
  if ! test_tunnel "$RPC_URL" "rpc"; then
    log "Cosmos RPC tunnel DEAD — restarting..."
    RPC_URL=$(start_tunnel 26657 "$RPC_LOG")
    if [[ -n "$RPC_URL" ]]; then
      log "  New RPC: $RPC_URL"
      update_vercel_env "COSMOS_RPC_URL" "$RPC_URL"
      NEED_REDEPLOY=true
    else
      log "  ERROR: RPC tunnel failed to start"
    fi
  fi

  # Test Cosmos REST tunnel
  if ! test_tunnel "$REST_URL" "rest"; then
    log "Cosmos REST tunnel DEAD — restarting..."
    REST_URL=$(start_tunnel 1317 "$REST_LOG")
    if [[ -n "$REST_URL" ]]; then
      log "  New REST: $REST_URL"
      update_vercel_env "COSMOS_REST_URL" "$REST_URL"
      NEED_REDEPLOY=true
    else
      log "  ERROR: REST tunnel failed to start"
    fi
  fi

  if $NEED_REDEPLOY; then
    save_urls
    do_redeploy
    log "Redeploy complete. New URLs active."
  fi
done
