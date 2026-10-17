#!/usr/bin/env bash
# ClawShelf Morning Brief — One-click setup (macOS / Linux)
# Run: bash setup.sh

set -e

GOG_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.clawshelf"
ENV_FILE="$CONFIG_DIR/morning-brief.env"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

step() { echo -e "\n${CYAN}$1${NC}"; }
ok()   { echo -e "  ${GREEN}v $1${NC}"; }
info() { echo -e "  ${YELLOW}> $1${NC}"; }
err()  { echo -e "  ${RED}x $1${NC}"; exit 1; }

clear
echo "======================================"
echo "  ClawShelf Morning Brief — Setup"
echo "======================================"

# ── Step 1: Install gogcli ───────────────────────────────────────────────────

step "Step 1/4  Install gogcli"

if command -v gog &>/dev/null; then
    ok "gogcli already installed: $(gog --version)"
else
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    if [[ "$OS" == "Darwin" ]] && command -v brew &>/dev/null; then
        info "Installing via Homebrew..."
        brew install steipete/tap/gogcli
        ok "Installed"

    elif command -v go &>/dev/null; then
        info "Installing via Go toolchain..."
        go install github.com/steipete/gogcli@latest
        export PATH="$HOME/go/bin:$PATH"
        ok "Installed"

    else
        info "Downloading pre-built binary..."
        mkdir -p "$GOG_DIR"

        case "$OS-$ARCH" in
            Darwin-x86_64)  PLATFORM="darwin-amd64" ;;
            Darwin-arm64)   PLATFORM="darwin-arm64" ;;
            Linux-x86_64)   PLATFORM="linux-amd64" ;;
            Linux-aarch64)  PLATFORM="linux-arm64" ;;
            *) err "Unsupported platform: $OS-$ARCH — download manually from https://github.com/steipete/gogcli/releases" ;;
        esac

        RELEASE_URL=$(curl -s "https://api.github.com/repos/steipete/gogcli/releases/latest" \
            | grep "browser_download_url" | grep "$PLATFORM" | cut -d'"' -f4 | head -1)

        [ -z "$RELEASE_URL" ] && err "Could not get download URL — check your internet connection"
        curl -L "$RELEASE_URL" -o "$GOG_DIR/gog"
        chmod +x "$GOG_DIR/gog"

        export PATH="$GOG_DIR:$PATH"
        SHELL_RC="$HOME/.bashrc"
        [[ "$SHELL" == *zsh* ]] && SHELL_RC="$HOME/.zshrc"
        grep -q "$GOG_DIR" "$SHELL_RC" 2>/dev/null || \
            echo "export PATH=\"$GOG_DIR:\$PATH\"" >> "$SHELL_RC"
        ok "Installed and added to PATH"
    fi
fi

# ── Step 2: Create Google OAuth credentials ──────────────────────────────────

step "Step 2/4  Create Google credentials (one-time, ~3 minutes)"
echo ""
echo "  A browser will open. Follow these 5 steps:"
echo ""
echo "  1  Click 'Select a project' (top) -> 'New Project' -> name it ClawShelf -> Create"
echo "  2  Left menu: APIs & Services -> Enable APIs"
echo "     Search and enable: Google Calendar API   and   Gmail API"
echo "  3  Left menu: OAuth consent screen -> External -> Create"
echo "     App name: ClawShelf -> Save and Continue (skip other pages)"
echo "     Test users page: add your Gmail address -> Save"
echo "  4  Left menu: Credentials -> Create Credentials -> OAuth client ID"
echo "     Application type: Desktop app -> Name: ClawShelf -> Create"
echo "  5  Click the download icon, save client_secret_xxx.json somewhere you can find it"
echo ""

read -rp "  Press Enter to open the browser..."

if [[ "$(uname -s)" == "Darwin" ]]; then
    open "https://console.cloud.google.com/apis/credentials"
else
    xdg-open "https://console.cloud.google.com/apis/credentials" 2>/dev/null || \
        echo "  Please open manually: https://console.cloud.google.com/apis/credentials"
fi

echo ""
info "After completing the 5 steps, paste the path to client_secret_xxx.json here:"
read -rp "  File path: " SECRET_PATH
SECRET_PATH="${SECRET_PATH//\'/}"
SECRET_PATH="${SECRET_PATH//\"/}"
SECRET_PATH="${SECRET_PATH/#\~/$HOME}"

[ -f "$SECRET_PATH" ] || err "File not found: $SECRET_PATH"
ok "Credentials file found"

# ── Step 3: Authorize account ────────────────────────────────────────────────

step "Step 3/4  Authorize Google account (read-only)"

gog auth credentials "$SECRET_PATH"
ok "Credentials imported (you can delete client_secret.json now)"

echo ""
read -rp "  Enter your Gmail address: " GMAIL
info "Opening browser for authorization..."
gog auth add "$GMAIL" --readonly
ok "Authorized (read-only: cannot send or delete emails)"

# ── Step 4: Save config ──────────────────────────────────────────────────────

step "Step 4/4  Save config"

mkdir -p "$CONFIG_DIR"
cat > "$ENV_FILE" << EOF
# ClawShelf Morning Brief config
# This file contains no passwords or tokens — safe to view

GOG_ACCOUNT=$GMAIL
GOG_JSON=true
EOF
ok "Config saved to $ENV_FILE"

# ── Verify ───────────────────────────────────────────────────────────────────

echo ""
info "Verifying connections..."
source "$ENV_FILE"

if gog calendar events list --today --json &>/dev/null; then
    ok "Google Calendar — connected"
else
    echo -e "  ${YELLOW}! Calendar returned no data (may just be an empty calendar)${NC}"
fi

if gog gmail search 'is:unread newer_than:1d' --json --readonly &>/dev/null; then
    ok "Gmail — connected (read-only)"
else
    echo -e "  ${YELLOW}! Gmail returned no data (check that authorization completed)${NC}"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "======================================"
echo -e "  ${GREEN}Setup complete!${NC}"
echo ""
echo "  Say 'good morning' to your agent to get your first real brief."
echo ""
echo "  To disconnect:   gog auth remove $GMAIL"
echo "  To reset config: rm \"$ENV_FILE\""
echo "======================================"
