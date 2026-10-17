# Morning Brief Data Setup — Linux

## One-Click Install

Open a terminal and run:

```bash
bash ~/.openclaw/skills/morning-brief/scripts/setup.sh
```

The script handles everything automatically. You only need to click through ~5 steps in the browser (Google authorization page, about 3 minutes).

---

## What the Script Does

1. **Installs gogcli** (via package manager, Go toolchain, or direct binary download)
2. **Opens Google Cloud Console** and guides you through creating an OAuth credential file
3. **Completes OAuth authorization in your browser** (read-only — cannot send or delete emails)
4. **Saves config** to `~/.openclaw/.env`
5. **Verifies** that calendar and email connections succeeded

---

## Headless / Server Environments

If no browser is available, the script automatically switches to `--manual` mode: it generates an authorization URL, you open it on another device, then paste the callback URL back into the terminal.

---

## If the Script Path Is Wrong

```bash
find ~/.openclaw/skills -name "setup.sh" 2>/dev/null
```

---

## Disconnect / Reset

```bash
gog auth remove you@gmail.com
rm ~/.openclaw/.env
```

---

## FAQ

**Q: `gog` command not found after install**
```bash
export PATH="$HOME/.local/bin:$HOME/go/bin:$PATH"
```
Add this line to `~/.bashrc` or `~/.zshrc` and restart your terminal.

**Q: Secret Service error**
```bash
sudo apt install libsecret-tools gnome-keyring   # Debian/Ubuntu
```
Or add `GOG_KEYRING_PASSWORD=your_password` to `.env` to use an encrypted file backend instead.

**Q: I only want to connect Calendar, not Gmail**
```bash
gog auth add you@gmail.com --readonly --scopes calendar.readonly
```
