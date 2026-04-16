#!/usr/bin/env bash
# Update Vercel environment variables to point to VPS
# Usage: ./vercel-env-update.sh <VPS_URL>
# Example: ./vercel-env-update.sh http://123.45.67.89
# Example: ./vercel-env-update.sh https://pixelvault.example.xyz
#
# Prerequisites: vercel CLI installed and logged in

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <VPS_BASE_URL>"
    echo "Example: $0 http://123.45.67.89"
    echo "Example: $0 https://node.pixelvault.xyz"
    exit 1
fi

VPS_URL="${1%/}"  # Remove trailing slash

EVM_RPC_URL="${VPS_URL}/evm-rpc"
COSMOS_RPC_URL="${VPS_URL}/cosmos-rpc"
COSMOS_REST_URL="${VPS_URL}/cosmos-rest"

info "Setting Vercel env vars..."
info "  EVM_RPC_URL    = $EVM_RPC_URL"
info "  COSMOS_RPC_URL = $COSMOS_RPC_URL"
info "  COSMOS_REST_URL = $COSMOS_REST_URL"

cd "$(dirname "$0")/../frontend"

# Remove old values (ignore errors if they don't exist)
for env in EVM_RPC_URL COSMOS_RPC_URL COSMOS_REST_URL; do
    echo "y" | vercel env rm "$env" production 2>/dev/null || true
    echo "y" | vercel env rm "$env" preview 2>/dev/null || true
done

# Set new values for production and preview
echo -n "$EVM_RPC_URL"    | vercel env add EVM_RPC_URL production
echo -n "$EVM_RPC_URL"    | vercel env add EVM_RPC_URL preview
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL production
echo -n "$COSMOS_RPC_URL" | vercel env add COSMOS_RPC_URL preview
echo -n "$COSMOS_REST_URL" | vercel env add COSMOS_REST_URL production
echo -n "$COSMOS_REST_URL" | vercel env add COSMOS_REST_URL preview

ok "Vercel env vars updated"

info "Deploying to production..."
vercel --prod --yes

ok "Deployment complete!"

info "Verifying endpoints..."
VERCEL_URL=$(vercel inspect --json 2>/dev/null | jq -r '.url // empty' || echo "")
if [[ -z "$VERCEL_URL" ]]; then
    info "Verify manually: curl https://YOUR_VERCEL_URL/evm-rpc -X POST -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_chainId\",\"params\":[],\"id\":1}'"
else
    info "Testing: $VERCEL_URL/evm-rpc"
    curl -s -X POST "https://$VERCEL_URL/evm-rpc" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' || warn "Test failed — check logs"
fi

echo ""
ok "Done! Your deployment is now using the VPS at $VPS_URL"
