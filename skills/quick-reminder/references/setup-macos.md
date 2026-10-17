# Quick Reminder — macOS Setup Guide

The reminder daemon runs as a background launchd service and delivers macOS system notifications when your reminders are due.

---

## Prerequisites

- macOS 11 (Big Sur) or later
- Python 3.8 or later

**Check Python:**
```bash
python3 --version
```
If missing:
```bash
brew install python3
# or download from https://www.python.org/downloads/
```

---

## Install (one command)

`<skill-folder>` is the folder this skill was installed in, the one that holds its `SKILL.md`. Ask the agent for the path if you're unsure.

```bash
bash "<skill-folder>/scripts/setup.sh"
```

The script will:
1. Verify Python 3 is installed
2. Copy the daemon to `~/.clawshelf/bin/remind-daemon.py`
3. Register a launchd agent (`~/Library/LaunchAgents/com.clawshelf.reminder.plist`) that starts at login
4. Load the agent immediately
5. Send a test notification to confirm everything works

---

## Verify it's working

You should see a macOS notification: "Reminder daemon is running!"

To check manually:
```bash
# Is the daemon running?
cat ~/.clawshelf/remind-daemon.pid | xargs ps -p

# View logs
tail -30 ~/.clawshelf/remind-daemon.log

# Check launchd status
launchctl list | grep clawshelf
```

---

## Managing the daemon

**Stop:**
```bash
launchctl unload ~/Library/LaunchAgents/com.clawshelf.reminder.plist
```

**Start:**
```bash
launchctl load ~/Library/LaunchAgents/com.clawshelf.reminder.plist
```

**Restart:**
```bash
launchctl unload ~/Library/LaunchAgents/com.clawshelf.reminder.plist
launchctl load ~/Library/LaunchAgents/com.clawshelf.reminder.plist
```

---

## Notifications not appearing?

1. **System Settings → Notifications:**
   Find "Script Editor" or "Terminal" and ensure notifications are enabled. macOS routes `osascript` notifications through the app that runs it.

2. **Check for "Do Not Disturb" / Focus mode** being active.

3. **Check the log:**
   ```bash
   tail -50 ~/.clawshelf/remind-daemon.log
   ```

---

## Uninstall

```bash
# Stop and remove launchd agent
launchctl unload ~/Library/LaunchAgents/com.clawshelf.reminder.plist
rm ~/Library/LaunchAgents/com.clawshelf.reminder.plist

# Remove daemon
rm ~/.clawshelf/bin/remind-daemon.py
rm -f ~/.clawshelf/remind-daemon.pid
```

Your reminders JSON at `~/.clawshelf/reminders.json` is preserved.
