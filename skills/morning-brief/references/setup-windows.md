# Morning Brief Data Setup — Windows

## One-Click Install

Open **PowerShell** (search "PowerShell" in the Start menu) and run these two lines:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& "<skill-folder>\scripts\setup.ps1"
```

The script handles everything automatically. You only need to click through ~5 steps in the browser (Google authorization page, about 3 minutes).

---

## What the Script Does

1. **Downloads gogcli** (Google CLI tool) and adds it to your PATH
2. **Opens Google Cloud Console** and guides you through creating an OAuth credential file
3. **Completes OAuth authorization in your browser** (read-only — cannot send or delete emails)
4. **Saves config** to `%USERPROFILE%\.clawshelf\morning-brief.env` (account name only, no passwords or tokens)
5. **Verifies** that calendar and email connections succeeded

---

## Finding the Skill Folder

`<skill-folder>` is the folder this skill was installed in, the one that holds its `SKILL.md`. Ask the agent for the path if you're unsure.

---

## Disconnect / Reset

```powershell
gog auth remove you@gmail.com
Remove-Item "$env:USERPROFILE\.clawshelf\morning-brief.env"
```

---

## FAQ

**Q: "cannot be loaded because running scripts is disabled on this system"**
The first line (`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`) fixes this. It only applies to the current PowerShell window and does not change any system settings.

**Q: Browser shows "Google hasn't verified this app"**
Click **Advanced** → **Go to Morning Brief (unsafe)**. This appears because the OAuth app is in test mode — only you will ever see this warning. It is expected and safe.

**Q: I only want to connect Calendar, not Gmail**
Skip the Gmail authorization step when the script prompts for it, or run afterward:
```powershell
gog auth add you@gmail.com --readonly --scopes calendar.readonly
```
