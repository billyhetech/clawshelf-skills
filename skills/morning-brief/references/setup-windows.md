# Morning Brief Data Setup — Windows

## One-Click Install

Open **PowerShell** (search "PowerShell" in the Start menu) and run these two lines:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& "$env:USERPROFILE\.openclaw\skills\morning-brief\scripts\setup.ps1"
```

The script handles everything automatically. You only need to click through ~5 steps in the browser (Google authorization page, about 3 minutes).

---

## What the Script Does

1. **Downloads gogcli** (Google CLI tool) and adds it to your PATH
2. **Opens Google Cloud Console** and guides you through creating an OAuth credential file
3. **Completes OAuth authorization in your browser** (read-only — cannot send or delete emails)
4. **Saves config** to `%USERPROFILE%\.openclaw\.env`
5. **Verifies** that calendar and email connections succeeded

---

## If the Script Path Is Wrong

Run this in PowerShell to find it:

```powershell
Get-ChildItem -Path "$env:USERPROFILE\.openclaw\skills" -Recurse -Filter "setup.ps1" | Select-Object FullName
```

Copy the full path from the output and use it in the run command.

---

## Disconnect / Reset

```powershell
gog auth remove you@gmail.com
Remove-Item "$env:USERPROFILE\.openclaw\.env"
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
