#!/usr/bin/env bash
# PixelVault VPS Setup Script
# Run this on a fresh Ubuntu 22.04/24.04 VPS (Hetzner CX22)
#
# Usage:
#   scp deploy/vps-setup.sh root@VPS_IP:/root/ && ssh root@VPS_IP bash /root/vps-setup.sh
#

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ─── Check root ──────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    fail "Run as root: sudo bash $0"
fi

echo ""
ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    GO_ARCH="arm64"
    info "Detected ARM64 architecture (Oracle Cloud / ARM VPS)"
else
    GO_ARCH="amd64"
    info "Detected x86_64 architecture"
fi

echo "╔══════════════════════════════════════════════╗"
echo "║   PixelVault VPS Setup (Ubuntu 22.04/24.04)  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Step 1: System updates + essentials ─────────────────
info "Step 1/7: Updating system and installing packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    nginx certbot python3-certbot-nginx \
    curl wget git unzip jq ufw \
    build-essential ca-certificates

ok "System packages installed"

# ─── Step 2: Create service user ─────────────────────────
info "Step 2/7: Creating pixelvault service user..."
if ! id -u pixelvault &>/dev/null; then
    useradd -m -s /bin/bash pixelvault
    ok "User 'pixelvault' created"
else
    ok "User 'pixelvault' already exists"
fi

# ─── Step 3: Install Go (needed for weave/minitiad) ──────
info "Step 3/7: Installing Go 1.22..."
GO_VERSION="1.22.5"
if ! command -v go &>/dev/null || ! go version | grep -q "$GO_VERSION"; then
    wget -q "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -O /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz

    # Set PATH for all users
    cat > /etc/profile.d/golang.sh << 'GOEOF'
export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$PATH:$GOROOT/bin:$GOPATH/bin
GOEOF
    source /etc/profile.d/golang.sh
    ok "Go ${GO_VERSION} installed"
else
    source /etc/profile.d/golang.sh 2>/dev/null || true
    ok "Go already installed: $(go version)"
fi

# ─── Step 4: Install Weave CLI ───────────────────────────
info "Step 4/7: Installing Weave CLI..."
if ! command -v weave &>/dev/null; then
    # Install weave for the pixelvault user
    su - pixelvault -c 'curl -sSL https://weave.initia.xyz/install.sh | bash' || true
    # Also make it available system-wide
    if [[ -f /home/pixelvault/.weave/bin/weave ]]; then
        ln -sf /home/pixelvault/.weave/bin/weave /usr/local/bin/weave
        ok "Weave CLI installed"
    else
        warn "Weave CLI install may have failed — check manually"
        warn "Try: su - pixelvault -c 'curl -sSL https://weave.initia.xyz/install.sh | bash'"
    fi
else
    ok "Weave CLI already installed"
fi

# ─── Step 5: Firewall setup ─────────────────────────────
info "Step 5/7: Configuring firewall (UFW)..."
ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing

# SSH (essential!)
ufw allow 22/tcp comment "SSH"

# HTTP/HTTPS for nginx
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Initia P2P (needed for node sync)
ufw allow 26656/tcp comment "Tendermint P2P"

# Do NOT expose 8545, 26657, 1317 — nginx proxies those
ufw --force enable
ok "Firewall configured (SSH:22, HTTP:80, HTTPS:443, P2P:26656)"

# ─── Step 6: nginx setup ────────────────────────────────
info "Step 6/7: Configuring nginx..."

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Copy our config (will be placed manually or via scp)
if [[ -f /root/pixelvault.conf ]]; then
    cp /root/pixelvault.conf /etc/nginx/sites-available/pixelvault
    ln -sf /etc/nginx/sites-available/pixelvault /etc/nginx/sites-enabled/pixelvault
    nginx -t && systemctl reload nginx
    ok "nginx configured with pixelvault proxy"
else
    warn "No pixelvault.conf found at /root/pixelvault.conf"
    warn "Copy it manually: scp deploy/nginx/pixelvault.conf root@VPS_IP:/root/"
    warn "Then run: cp /root/pixelvault.conf /etc/nginx/sites-available/pixelvault"
    warn "          ln -sf /etc/nginx/sites-available/pixelvault /etc/nginx/sites-enabled/"
    warn "          nginx -t && systemctl reload nginx"
fi

systemctl enable nginx
ok "nginx enabled on boot"

# ─── Step 7: systemd service for node ────────────────────
info "Step 7/7: Installing systemd service..."
if [[ -f /root/minievm-node.service ]]; then
    cp /root/minievm-node.service /etc/systemd/system/minievm-node.service
    systemctl daemon-reload
    ok "minievm-node.service installed (not started — transfer node data first)"
else
    warn "No minievm-node.service found at /root/"
    warn "Copy it manually: scp deploy/systemd/minievm-node.service root@VPS_IP:/root/"
    warn "Then run: cp /root/minievm-node.service /etc/systemd/system/ && systemctl daemon-reload"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo ""
ok "VPS base setup complete!"
echo ""
echo "Next steps:"
echo "  1. Transfer your node data (see DEPLOYMENT.md)"
echo "  2. Start the node: systemctl start minievm-node"
echo "  3. (Optional) Set up SSL with a domain"
echo "  4. Update Vercel env vars to point here"
echo ""
echo "  Node status:  systemctl status minievm-node"
echo "  Node logs:    journalctl -u minievm-node -f"
echo "  nginx status: systemctl status nginx"
echo ""
echo "═══════════════════════════════════════════════"
