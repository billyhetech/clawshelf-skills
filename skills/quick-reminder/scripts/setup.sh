#!/usr/bin/env bash
# ClawShelf Quick Reminder — One-click setup (macOS / Linux)
# Run: bash setup.sh

set -e

OPENCLAW_DIR="$HOME/.openclaw"
BIN_DIR="$OPENCLAW_DIR/bin"
DAEMON_SRC="$(cd "$(dirname "$0")" && pwd)/remind-daemon.py"
DAEMON_DEST="$BIN_DIR/remind-daemon.py"
PID_FILE="$OPENCLAW_DIR/remind-daemon.pid"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

step() { echo -e "\n${CYAN}$1${NC}"; }
ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
info() { echo -e "  ${YELLOW}▶ $1${NC}"; }
err()  { echo -e "  ${RED}✗ $1${NC}"; exit 1; }
warn() { echo -e "  ${YELLOW}! $1${NC}"; }

clear
echo "======================================"
echo "  ClawShelf Quick Reminder — Setup"
echo "======================================"

# ── Step 1: Check Python 3 ───────────────────────────────────────────────────

step "Step 1/4  Check Python 3"

PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        VER=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
        MAJOR=$(echo "$VER" | cut -d. -f1)
        if [ "$MAJOR" -ge 3 ]; then
            PYTHON="$cmd"
            ok "Found $cmd ($("$cmd" --version 2>&1))"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    err "Python 3 not found. Install it first:
  macOS:  brew install python3   or   https://www.python.org/downloads/
  Ubuntu: sudo apt install python3
  Fedora: sudo dnf install python3"
fi

# ── Step 2: Install daemon ───────────────────────────────────────────────────

step "Step 2/4  Install daemon"

[ -f "$DAEMON_SRC" ] || err "remind-daemon.py not found at: $DAEMON_SRC
  Make sure you run setup.sh from the skills/quick-reminder/scripts/ directory."

mkdir -p "$BIN_DIR"
cp "$DAEMON_SRC" "$DAEMON_DEST"
chmod +x "$DAEMON_DEST"
ok "Daemon installed to $DAEMON_DEST"

# ── Step 3: Configure auto-start ─────────────────────────────────────────────

step "Step 3/4  Configure auto-start"

OS="$(uname -s)"

if [[ "$OS" == "Darwin" ]]; then
    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_FILE="$PLIST_DIR/com.clawshelf.reminder.plist"
    mkdir -p "$PLIST_DIR"

    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clawshelf.reminder</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$DAEMON_DEST</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$OPENCLAW_DIR/remind-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>$OPENCLAW_DIR/remind-daemon.log</string>
</dict>
</plist>
EOF

    # Unload if already loaded (ignore errors)
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load "$PLIST_FILE"
    ok "launchd service registered (starts at login)"

elif [[ "$OS" == "Linux" ]]; then
    if command -v systemctl &>/dev/null && systemctl --user status &>/dev/null 2>&1; then
        # systemd user service
        SERVICE_DIR="$HOME/.config/systemd/user"
        SERVICE_FILE="$SERVICE_DIR/clawshelf-reminder.service"
        mkdir -p "$SERVICE_DIR"

        cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ClawShelf Reminder Daemon
After=default.target

[Service]
ExecStart=$PYTHON $DAEMON_DEST
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

        systemctl --user daemon-reload
        systemctl --user enable clawshelf-reminder.service
        systemctl --user restart clawshelf-reminder.service
        ok "systemd user service enabled (clawshelf-reminder.service)"

    else
        # Fallback: add to ~/.bashrc / ~/.profile
        warn "systemd not available — adding PID-guarded startup to shell profile"
        STARTUP_LINE="# ClawShelf Reminder Daemon"
        LAUNCH_LINE="[ -f \"$PID_FILE\" ] && kill -0 \$(cat \"$PID_FILE\") 2>/dev/null || ($PYTHON $DAEMON_DEST &)"

        SHELL_RC="$HOME/.bashrc"
        [[ "$SHELL" == *zsh* ]] && SHELL_RC="$HOME/.zshrc"
        [[ "$SHELL" == *fish* ]] && warn "Fish shell detected — add startup manually (see references/setup-linux.md)"

        if ! grep -q "ClawShelf Reminder Daemon" "$SHELL_RC" 2>/dev/null; then
            echo "" >> "$SHELL_RC"
            echo "$STARTUP_LINE" >> "$SHELL_RC"
            echo "$LAUNCH_LINE" >> "$SHELL_RC"
            ok "Startup line added to $SHELL_RC"
        else
            ok "Startup line already in $SHELL_RC"
        fi

        # Start now
        eval "$LAUNCH_LINE"
    fi
fi

# ── Step 4: Verify ───────────────────────────────────────────────────────────

step "Step 4/4  Verify"

sleep 2

# Check daemon is running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        ok "Daemon is running (PID $PID)"
    else
        warn "PID file exists but process not found — trying to start manually"
        $PYTHON "$DAEMON_DEST" &
        sleep 2
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            ok "Daemon started (PID $(cat "$PID_FILE"))"
        else
            warn "Could not confirm daemon status — check $OPENCLAW_DIR/remind-daemon.log"
        fi
    fi
else
    info "Starting daemon now..."
    $PYTHON "$DAEMON_DEST" &
    sleep 2
    if [ -f "$PID_FILE" ]; then
        ok "Daemon started (PID $(cat "$PID_FILE"))"
    else
        warn "Daemon may not have started — check $OPENCLAW_DIR/remind-daemon.log"
    fi
fi

# Fire a test notification
info "Sending test notification..."
if [[ "$OS" == "Darwin" ]]; then
    osascript -e 'display notification "Reminder daemon is running!" with title "⏰ ClawShelf"' 2>/dev/null && ok "Test notification sent" || warn "Notification sent (may appear shortly)"
elif command -v notify-send &>/dev/null; then
    notify-send "⏰ ClawShelf" "Reminder daemon is running!" && ok "Test notification sent" || warn "notify-send returned an error (may still work)"
else
    warn "notify-send not found — install libnotify for desktop notifications (sudo apt install libnotify-bin)"
    ok "Daemon is running — notifications will use 'wall' as fallback"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "======================================"
echo -e "  ${GREEN}Setup complete!${NC}"
echo ""
echo "  Reminders written by any agent to"
echo "  ~/.openclaw/reminders.json will now"
echo "  be delivered as system notifications."
echo ""
echo "  Daemon log:   $OPENCLAW_DIR/remind-daemon.log"
echo "  Stop daemon:  kill \$(cat $PID_FILE)"
echo "  Restart:      $PYTHON $DAEMON_DEST &"
echo "======================================"
