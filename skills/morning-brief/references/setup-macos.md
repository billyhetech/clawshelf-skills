# Morning Brief Data Setup — macOS

## One-Click Install

Open **Terminal** (Command+Space, search "Terminal") and run:

```bash
bash ~/.openclaw/skills/morning-brief/scripts/setup.sh
```

The script handles everything automatically. You only need to click through ~5 steps in the browser (Google authorization page, about 3 minutes).

---

## What the Script Does

1. **Installs gogcli** (via Homebrew if available, otherwise Go or direct download)
2. **Opens Google Cloud Console** and guides you through creating an OAuth credential file
3. **Completes OAuth authorization in your browser** (read-only — cannot send or delete emails)
4. **Saves config** to `~/.openclaw/.env`
5. **Verifies** that calendar and email connections succeeded

---

## If the Script Path Is Wrong

```bash
find ~/.openclaw/skills -name "setup.sh" 2>/dev/null
```

Copy the output path and run `bash <path>`.

---

## Disconnect / Reset

```bash
gog auth remove you@gmail.com
rm ~/.openclaw/.env
```

---

## FAQ

**Q: Homebrew installation is slow**
The script automatically falls back to Go or a direct binary download — no action needed.

**Q: Browser shows "Google hasn't verified this app"**
Click **Advanced** → **Go to Morning Brief (unsafe)**. This appears because the OAuth app is in test mode — only you will ever see this warning. It is expected and safe.

**Q: I only want to connect Calendar, not Gmail**
Skip the Gmail authorization step when the script prompts for it, or run afterward:
```bash
gog auth add you@gmail.com --readonly --scopes calendar.readonly
```
