# Quick Reminder — Windows Setup Guide

The reminder daemon runs silently in the background and delivers Windows toast notifications when your reminders are due. This guide walks you through the one-time setup.

---

## Prerequisites

- Windows 10 or 11
- Python 3.8 or later
- PowerShell 5.1 or later (built into Windows)

**Check if Python is installed:**
```powershell
python --version
```
If you see `Python 3.x.x`, you're ready. If not, install it:
```powershell
winget install Python.Python.3
```
Or download from https://www.python.org/downloads/ (check "Add Python to PATH" during install).

---

## Install (one command)

`<skill-folder>` is the folder this skill was installed in, the one that holds its `SKILL.md`. Ask the agent for the path if you're unsure.

Open PowerShell and run:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& "<skill-folder>\scripts\setup.ps1"
```

The script will:
1. Verify Python is installed
2. Copy the daemon to `%USERPROFILE%\.clawshelf\bin\`
3. Register a Task Scheduler entry that starts the daemon at every login
4. Start the daemon immediately
5. Fire a test toast notification to confirm everything works

---

## Verify it's working

After setup, you should see a Windows toast notification in the bottom-right corner saying "Reminder daemon is running!".

To manually check the daemon:
```powershell
# Is it running?
$pid = Get-Content "$env:USERPROFILE\.clawshelf\remind-daemon.pid"
Get-Process -Id $pid

# View recent logs
Get-Content "$env:USERPROFILE\.clawshelf\remind-daemon.log" -Tail 20
```

---

## Managing the daemon

**Stop:**
```powershell
Stop-Process -Id (Get-Content "$env:USERPROFILE\.clawshelf\remind-daemon.pid")
```

**Restart:**
```powershell
Start-ScheduledTask "ClawShelf Reminder Daemon"
```

**View scheduled task:**
```powershell
Get-ScheduledTask "ClawShelf Reminder Daemon"
```

---

## Notifications not appearing?

1. **Check Windows notification settings:**
   Settings → System → Notifications → ensure notifications are enabled for PowerShell / your terminal
   
2. **Focus Assist / Do Not Disturb:**
   If Focus Assist is on, notifications are suppressed. Disable it or add ClawShelf as a priority app.

3. **Check the log for errors:**
   ```powershell
   Get-Content "$env:USERPROFILE\.clawshelf\remind-daemon.log" -Tail 50
   ```

---

## Uninstall

```powershell
# Stop and remove the scheduled task
Stop-ScheduledTask "ClawShelf Reminder Daemon" -ErrorAction SilentlyContinue
Unregister-ScheduledTask "ClawShelf Reminder Daemon" -Confirm:$false

# Remove daemon files
Remove-Item "$env:USERPROFILE\.clawshelf\bin\remind-daemon.py" -Force
Remove-Item "$env:USERPROFILE\.clawshelf\remind-daemon.pid" -Force -ErrorAction SilentlyContinue
```

Your reminders JSON at `%USERPROFILE%\.clawshelf\reminders.json` is preserved.
