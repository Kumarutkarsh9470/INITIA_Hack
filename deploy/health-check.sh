#!/usr/bin/env bash
# Health check script — run on VPS or remotely to verify all endpoints
# Usage: ./health-check.sh <BASE_URL>
# Example: ./health-check.sh http://123.45.67.89

set -euo pipefail

BASE_URL="${1:-http://localhost}"
BASE_URL="${BASE_URL%/}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

check() {
    local name="$1" url="$2" method="${3:-GET}" data="${4:-}"
    local args=(-s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15)

    if [[ "$method" == "POST" ]]; then
        args+=(-X POST -H "Content-Type: application/json" -d "$data")
    fi

    local code
    code=$(curl "${args[@]}" "$url" 2>/dev/null) || code="000"

    if [[ "$code" =~ ^2 ]]; then
        echo -e "  ${GREEN}✓${NC} $name (HTTP $code)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $name (HTTP $code)"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "Health Check: $BASE_URL"
echo "─────────────────────────────────────────"

check "Health endpoint" "$BASE_URL/health"

check "EVM RPC (eth_chainId)" \
    "$BASE_URL/evm-rpc" \
    "POST" \
    '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

check "EVM RPC (eth_blockNumber)" \
    "$BASE_URL/evm-rpc" \
    "POST" \
    '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":2}'

check "Cosmos RPC (status)" \
    "$BASE_URL/cosmos-rpc/status"

check "Cosmos REST (node info)" \
    "$BASE_URL/cosmos-rest/cosmos/base/tendermint/v1beta1/node_info"

echo "─────────────────────────────────────────"
echo -e "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  - Is the node running?    systemctl status minievm-node"
    echo "  - Is nginx running?       systemctl status nginx"
    echo "  - Check node logs:        journalctl -u minievm-node --no-pager -n 50"
    echo "  - Check nginx logs:       tail -20 /var/log/nginx/error.log"
    echo "  - Firewall open?          ufw status"
    exit 1
fi

echo ""
echo -e "${GREEN}All endpoints healthy!${NC}"
