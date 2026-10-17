---
name: quick-reminder
description: Sets, manages, and delivers reminders using plain natural language. Use this skill whenever the user expresses any intent to be reminded of something later — "remind me", "don't let me forget", "set an alarm for", "tell me to", "in 30 minutes...", "every Monday...", "I need to remember to...", "show my reminders", "cancel reminder", "snooze". The trigger is reminder intent, not specific wording. When someone says "I should really call my dentist tomorrow" — that's a reminder waiting to be set.
metadata:
  version: "1.0.0"
  clawshelf-title: "Quick Reminder"
  clawshelf-summary: "Set, manage, and receive reminders in plain natural language."
  clawshelf-summary-zh: "用自然语言设置、管理和接收提醒。"
  clawshelf-category: "productivity"
  clawshelf-release-notes: "First release in the public clawshelf-skills repo."
---

# Quick Reminder

## First-time setup (required)

Reminders are delivered by a background daemon that watches `~/.openclaw/reminders.json` and fires OS notifications. Run this once before using the skill:

| Platform | Command |
|----------|---------|
| Windows | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\skills\quick-reminder\scripts\setup.ps1` |
| macOS / Linux | `bash skills/quick-reminder/scripts/setup.sh` |

For a step-by-step guide, read the matching file in `references/` (setup-windows.md, setup-macos.md, or setup-linux.md).

If the user hasn't done setup yet and asks to set a reminder, prompt them to run setup first — otherwise the reminder will be saved but never delivered.

---

## How it works

1. **You** write the reminder to `~/.openclaw/reminders.json`
2. **The daemon** polls the file every 30 seconds and fires a native OS notification when the trigger time arrives
3. The daemon runs persistently in the background — independent of which agent or session is active

This means reminders survive session restarts and work in any agent (OpenClaw, opencode, Claude Code, etc.).

**In Claude Code only:** if `CronCreate` is available, you may optionally call it as an in-session backup for extra reliability. It's not required and should never replace the daemon-based flow.

---

## Setting a reminder

### Step 1: Parse the time

Translate what the user says into an absolute target datetime:

| What the user says | What it means |
|---|---|
| "in 30 minutes" | now + 30 min |
| "at 3pm" | today 15:00 (or tomorrow if already past) |
| "tomorrow morning" | tomorrow 09:00 |
| "in 60 seconds" | now + 1 min (daemon polls every 30s; anything under 30s rounds up to next minute) |
| "every Friday at 5pm" | recurring, Friday 17:00 |

Smart defaults for vague timing:
- "later" / no time given (before noon): now + 2 hours
- "later" (after 6pm): tomorrow 09:00
- Day of week only ("every Monday"): 09:00 that day
- "end of day": 17:00

### Step 2: Write to reminders.json

Save to `~/.openclaw/reminders.json` (create the file and directory if they don't exist):

```json
{
  "id": "rem_001",
  "text": "Call Grace",
  "trigger_time": "2026-04-05T14:33:00",
  "recurring": null,
  "cron_job_id": null,
  "status": "active",
  "created": "2026-04-05T14:32:00"
}
```

Use **local time** (no timezone suffix) for `trigger_time` — the daemon reads it as local time.

For recurring reminders, set the `recurring` field:
```json
"recurring": { "unit": "weekly", "interval": 1 }
```
Supported units: `"minutes"`, `"hourly"`, `"daily"`, `"weekly"`, `"monthly"`

The JSON file holds a list of reminder objects:
```json
[
  { "id": "rem_001", ... },
  { "id": "rem_002", ... }
]
```

### Step 3: (Claude Code only, optional) Call CronCreate

If you're in Claude Code and want an in-session backup notification, call CronCreate with `recurring: false` and save the returned job ID to `cron_job_id`. This is optional — skip it in any other agent.

### Step 4: Confirm to the user

```
⏰ Reminder set!
📝 "Call Grace"
🕐 Today at 2:33 PM (in 1 minute)
```

Always show the resolved clock time alongside relative wording — a misread time won't surface until it fires, and by then it's too late to catch.

---

## Delivering reminders

The daemon handles delivery automatically. When `trigger_time` arrives, the user gets:
- **Windows**: WinRT toast notification (bottom-right corner)
- **macOS**: System notification (Notification Center)
- **Linux**: `notify-send` desktop notification (or `wall` broadcast if no desktop)

---

## Managing reminders

**List** — "show my reminders" / "what reminders do I have":

Read `~/.openclaw/reminders.json` and show active entries:
```
📋 Active Reminders (3):
1. Call Grace — Today 2:33 PM
2. Submit timesheet — Every Friday 5:00 PM
3. Review PR — Tomorrow 9:00 AM

Say "cancel 1" to remove, or "snooze 1 for 1 hour" to delay.
```

**Cancel**: "cancel reminder 1" or "remove the Grace one"
→ Set `status: "cancelled"` in JSON
→ If `cron_job_id` is set (Claude Code), also call `CronDelete`

**Snooze**: "snooze 1 for 1 hour"
→ Advance `trigger_time` in JSON
→ If `cron_job_id` is set, delete old cron job and create a new one

**Edit**: "change reminder 1 to 4pm"
→ Update `trigger_time` in JSON (same cron_job_id handling as snooze)

---

## Keeping reminder text useful

Keep reminder text short — extract the core action from verbose input. "Remind me that I need to follow up with the Acme team about the Q3 renewal proposal" → `"Follow up: Acme Q3 renewal"`. The notification fires at a glance; it needs to be readable instantly.

If the user has more than 50 active reminders, gently suggest a review before adding more.
