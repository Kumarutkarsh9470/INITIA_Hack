#!/usr/bin/env bash
# ============================================================================
#  Install cloudflared Named Tunnel as a systemd service
#
#  Usage: sudo bash scripts/install-tunnel-service.sh
#
#  Prerequisites: Run scripts/setup-named-tunnel.sh first
#
#  This installs a systemd service that:
#    - Starts the tunnel automatically on boot
#    - Restarts it if it crashes
#    - Runs independently of any terminal session
# ============================================================================
set -euo pipefail

CONFIG="$HOME/.cloudflared/config.yml"

if [[ ! -f "$CONFIG" ]]; then
  echo "✗ No tunnel config found at $CONFIG"
  echo "  Run first: bash scripts/setup-named-tunnel.sh"
  exit 1
fi

echo "Installing cloudflared as a systemd service..."

# cloudflared has a built-in service installer
cloudflared service install

echo ""
echo "✓ Installed! The tunnel will now start automatically on boot."
echo ""
echo "  Check status:  systemctl status cloudflared"
echo "  View logs:     journalctl -u cloudflared -f"
echo "  Stop:          sudo systemctl stop cloudflared"
echo "  Start:         sudo systemctl start cloudflared"
echo "  Disable:       sudo systemctl disable cloudflared"
