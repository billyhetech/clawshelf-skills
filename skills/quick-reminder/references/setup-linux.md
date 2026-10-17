# Quick Reminder — Linux Setup Guide

The reminder daemon polls `~/.clawshelf/reminders.json` and delivers desktop notifications via `notify-send` (or `wall` as fallback) when reminders are due.

---

## Prerequisites

- Python 3.8 or later
- `notify-send` for desktop notifications (optional but recommended)

**Check Python:**
```bash
python3 --version
```
Install if missing:
```bash
# Ubuntu/Debian
sudo apt install python3

# Fedora/RHEL
sudo dnf install python3

# Arch
sudo pacman -S python
```

**Install notify-send (for desktop notifications):**
```bash
# Ubuntu/Debian
sudo apt install libnotify-bin

# Fedora
sudo dnf install libnotify

# Arch
sudo pacman -S libnotify
```

If `notify-send` is not available, the daemon falls back to broadcasting via `wall` (prints to all terminal sessions).

---

## Install (one command)

`<skill-folder>` is the folder this skill was installed in, the one that holds its `SKILL.md`. Ask the agent for the path if you're unsure.

```bash
bash "<skill-folder>/scripts/setup.sh"
```

The script detects your init system and configures accordingly:

| Init system | Method |
|---|---|
| systemd | User service (`~/.config/systemd/user/`) |
| Other (SysV, OpenRC) | Startup line in `~/.bashrc` / `~/.zshrc` |

---

## Verify it's working

```bash
# Check daemon is running
cat ~/.clawshelf/remind-daemon.pid | xargs ps -p

# View logs
tail -30 ~/.clawshelf/remind-daemon.log
```

For systemd setups:
```bash
systemctl --user status clawshelf-reminder
```

---

## Managing the daemon

### systemd

```bash
# Stop
systemctl --user stop clawshelf-reminder

# Start
systemctl --user start clawshelf-reminder

# Restart
systemctl --user restart clawshelf-reminder

# View logs
journalctl --user -u clawshelf-reminder -n 50
```

### Non-systemd (manual)

```bash
# Stop
kill $(cat ~/.clawshelf/remind-daemon.pid)

# Start
python3 ~/.clawshelf/bin/remind-daemon.py &

# Check status
ps aux | grep remind-daemon
```

---

## Fish shell users

The setup script adds a startup line to `~/.bashrc` / `~/.zshrc` but not Fish config. Add manually:

```fish
# ~/.config/fish/config.fish
if not test -f ~/.clawshelf/remind-daemon.pid; or not kill -0 (cat ~/.clawshelf/remind-daemon.pid) 2>/dev/null
    python3 ~/.clawshelf/bin/remind-daemon.py &
end
```

---

## Running without a desktop (headless / server)

If there's no desktop environment, `notify-send` won't work. The daemon falls back to `wall` which broadcasts to all terminal sessions. For a headless setup, consider piping reminders to a different channel (webhook, email) by modifying the `_notify_linux` function in `remind-daemon.py`.

---

## Uninstall

### systemd
```bash
systemctl --user disable --now clawshelf-reminder
rm ~/.config/systemd/user/clawshelf-reminder.service
systemctl --user daemon-reload
```

### Non-systemd
Remove the lines added to `~/.bashrc` (look for `# ClawShelf Reminder Daemon`), then:
```bash
kill $(cat ~/.clawshelf/remind-daemon.pid) 2>/dev/null
```

### Both
```bash
rm ~/.clawshelf/bin/remind-daemon.py
rm -f ~/.clawshelf/remind-daemon.pid
```

Your reminders JSON at `~/.clawshelf/reminders.json` is preserved.
