#!/usr/bin/env python3
# ClawShelf Remind Daemon — cross-platform reminder delivery
# Polls ~/.openclaw/reminders.json every 30s and fires OS notifications.
# No pip installs required — uses only stdlib + native OS notification tools.

import json
import os
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

OPENCLAW_DIR = Path.home() / ".openclaw"
REMINDERS_FILE = OPENCLAW_DIR / "reminders.json"
PID_FILE = OPENCLAW_DIR / "remind-daemon.pid"
LOG_FILE = OPENCLAW_DIR / "remind-daemon.log"
POLL_INTERVAL = 30  # seconds
LOG_MAX_LINES = 500

# ── Logging ──────────────────────────────────────────────────────────────────

def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    print(line, end="", flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
        _trim_log()
    except Exception:
        pass

def _trim_log():
    try:
        lines = LOG_FILE.read_text(encoding="utf-8").splitlines(keepends=True)
        if len(lines) > LOG_MAX_LINES:
            LOG_FILE.write_text("".join(lines[-LOG_MAX_LINES:]), encoding="utf-8")
    except Exception:
        pass

# ── PID guard ────────────────────────────────────────────────────────────────

def already_running() -> bool:
    if not PID_FILE.exists():
        return False
    try:
        pid = int(PID_FILE.read_text().strip())
        if pid == os.getpid():
            return False
        # Check if process is alive
        if platform.system() == "Windows":
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True, text=True
            )
            return str(pid) in result.stdout
        else:
            os.kill(pid, 0)
            return True
    except (ValueError, ProcessLookupError, PermissionError):
        return False
    except Exception:
        return False

def write_pid():
    PID_FILE.write_text(str(os.getpid()))

def remove_pid():
    try:
        PID_FILE.unlink()
    except Exception:
        pass

# ── Notifications ─────────────────────────────────────────────────────────────

def notify(title: str, message: str):
    system = platform.system()
    try:
        if system == "Darwin":
            _notify_macos(title, message)
        elif system == "Linux":
            _notify_linux(title, message)
        elif system == "Windows":
            _notify_windows(title, message)
        else:
            log(f"REMINDER: {title} — {message}")
    except Exception as e:
        log(f"Notification failed ({e}), falling back to log: {title} — {message}")

def _notify_macos(title: str, message: str):
    safe_title = title.replace('"', '\\"').replace("'", "\\'")
    safe_msg = message.replace('"', '\\"').replace("'", "\\'")
    script = f'display notification "{safe_msg}" with title "{safe_title}"'
    subprocess.run(["osascript", "-e", script], check=True)

def _notify_linux(title: str, message: str):
    try:
        subprocess.run(["notify-send", title, message], check=True, timeout=5)
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        # Fallback: broadcast to all terminals
        try:
            subprocess.run(["wall", f"\n⏰ {title}\n{message}"], timeout=5)
        except Exception:
            log(f"REMINDER: {title} — {message}")

def _notify_windows(title: str, message: str):
    # Uses WinRT Toast via PowerShell — works on Windows 10/11, no dependencies
    safe_title = title.replace("'", "''")
    safe_msg = message.replace("'", "''")
    ps_script = f"""
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$template = @'
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>{safe_title}</text>
      <text>{safe_msg}</text>
    </binding>
  </visual>
</toast>
'@

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('ClawShelf').Show($toast)
"""
    subprocess.run(
        ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps_script],
        check=True, timeout=10
    )

# ── Reminder JSON ─────────────────────────────────────────────────────────────

def load_reminders() -> list:
    if not REMINDERS_FILE.exists():
        return []
    try:
        data = json.loads(REMINDERS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        # Support both list and {"reminders": [...]} formats
        if isinstance(data, dict) and "reminders" in data:
            return data["reminders"]
        return []
    except (json.JSONDecodeError, OSError):
        return []

def save_reminders(reminders: list):
    OPENCLAW_DIR.mkdir(parents=True, exist_ok=True)
    tmp = REMINDERS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(reminders, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(REMINDERS_FILE)

def parse_dt(s: str) -> datetime:
    """Parse ISO 8601 datetime string, always returning an aware UTC datetime."""
    s = s.strip()
    # Try with timezone info
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M%z"):
        try:
            return datetime.strptime(s, fmt).astimezone(timezone.utc)
        except ValueError:
            pass
    # Naive datetime — assume local time
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            local_dt = datetime.strptime(s, fmt)
            # Convert local naive to UTC
            local_ts = local_dt.timestamp()
            return datetime.fromtimestamp(local_ts, tz=timezone.utc)
        except ValueError:
            pass
    raise ValueError(f"Cannot parse datetime: {s!r}")

def next_recurring_time(reminder: dict, after: datetime) -> str | None:
    """Calculate the next trigger time for a recurring reminder."""
    recurring = reminder.get("recurring")
    if not recurring:
        return None
    try:
        original = parse_dt(reminder["trigger_time"])
    except Exception:
        return None

    unit = recurring.get("unit", "").lower()  # "daily", "weekly", "monthly"
    interval = int(recurring.get("interval", 1))

    from datetime import timedelta
    if unit == "daily":
        delta = timedelta(days=interval)
    elif unit == "weekly":
        delta = timedelta(weeks=interval)
    elif unit == "hourly":
        delta = timedelta(hours=interval)
    elif unit == "minutes":
        delta = timedelta(minutes=interval)
    else:
        return None

    # Advance until next occurrence is in the future
    next_dt = original
    while next_dt <= after:
        next_dt += delta

    # Return as ISO string without timezone (local time)
    local_next = datetime.fromtimestamp(next_dt.timestamp())
    return local_next.strftime("%Y-%m-%dT%H:%M:%S")

# ── Main poll loop ────────────────────────────────────────────────────────────

def poll_once():
    now = datetime.now(tz=timezone.utc)
    reminders = load_reminders()
    changed = False

    for r in reminders:
        if r.get("status") != "active":
            continue
        try:
            trigger = parse_dt(r["trigger_time"])
        except Exception as e:
            log(f"Skipping reminder {r.get('id', '?')}: bad trigger_time ({e})")
            continue

        if trigger <= now:
            text = r.get("text", "Reminder")
            log(f"Firing reminder: {text}")
            notify("⏰ Reminder", text)

            if r.get("recurring"):
                next_time = next_recurring_time(r, now)
                if next_time:
                    r["trigger_time"] = next_time
                    log(f"Rescheduled recurring reminder to {next_time}")
                else:
                    r["status"] = "delivered"
            else:
                r["status"] = "delivered"

            changed = True

    if changed:
        save_reminders(reminders)

def main():
    if already_running():
        print("ClawShelf reminder daemon is already running. Exiting.")
        sys.exit(0)

    OPENCLAW_DIR.mkdir(parents=True, exist_ok=True)
    write_pid()
    log("ClawShelf reminder daemon started")

    try:
        while True:
            try:
                poll_once()
            except Exception as e:
                log(f"Poll error: {e}")
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        log("Daemon stopped by user")
    finally:
        remove_pid()

if __name__ == "__main__":
    main()
