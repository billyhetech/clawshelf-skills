---
name: quick-reminder
description: Sets, manages, and delivers reminders using plain natural language. Use this skill whenever the user expresses any intent to be reminded of something later — "remind me", "don't let me forget", "set an alarm for", "tell me to", "in 30 minutes...", "every Monday...", "I need to remember to...", "show my reminders", "cancel reminder", "snooze". The trigger is reminder intent, not specific wording — "I should really call my dentist tomorrow" is a reminder waiting to be set.
license: MIT
compatibility: "Desktop notifications need Python 3 and a one-time background service installed by the bundled setup script (macOS, Linux, Windows). Reminders live in ~/.clawshelf/reminders.json, outside the project folder, so sandboxed agents ask before writing it."
metadata:
  version: "1.1.0"
  clawshelf-title: "Quick Reminder"
  clawshelf-summary: "Set, manage, and receive reminders in plain natural language."
  clawshelf-summary-zh: "用自然语言设置、管理和接收提醒。"
  clawshelf-category: "productivity"
  clawshelf-release-notes: "Works the same in every Agent Skills client: reminders move to ~/.clawshelf/reminders.json (re-run setup once; existing reminders move over automatically), and there is no agent-specific step anymore."
---

# Quick Reminder

## Purpose

Turn "remind me…" into a reminder that actually fires, whichever agent the user is talking to. The agent writes reminders to one shared file; a small background service delivers them as system notifications, even after the session ends.

## Rules

- Always show the resolved clock time next to relative wording ("in 1 hour" → "3:15 PM"). A misread time won't surface until it fires.
- Ask before cancelling or editing a reminder the user didn't clearly identify.
- Keep reminder text short: extract the core action from verbose input.
- If the background service isn't installed, say so before saving. Otherwise the reminder will be saved but never delivered.

## First-time setup

Reminders are delivered by a background service that watches `~/.clawshelf/reminders.json` and fires OS notifications. The user runs this once. The scripts are in this skill's `scripts/` folder; `<skill-folder>` is the folder that holds this `SKILL.md`, so give the user its full path:

| Platform | Command |
|----------|---------|
| Windows | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; & "<skill-folder>\scripts\setup.ps1"` |
| macOS / Linux | `bash "<skill-folder>/scripts/setup.sh"` |

For a step-by-step guide, read the matching file in `references/` (setup-windows.md, setup-macos.md, or setup-linux.md).

The service is running if `~/.clawshelf/remind-daemon.pid` exists. Setup from an earlier version used a different folder: re-running setup moves existing reminders over automatically.

**Without the service:** still save the reminder, tell the user it won't pop up on its own, and offer to run setup. If the agent supports scheduled tasks, it may also schedule its own notification for the same time. Either way, list due reminders whenever the user checks in ("what's due?", "show my reminders").

---

## How it works

1. **You** write the reminder to `~/.clawshelf/reminders.json`
2. **The service** polls the file every 30 seconds and fires a native OS notification when the trigger time arrives
3. It runs in the background, independent of which agent or session is active, so reminders survive session restarts and work with any agent

---

## Setting a reminder

### Step 1: Parse the time

Translate what the user says into an absolute target datetime:

| What the user says | What it means |
|---|---|
| "in 30 minutes" | now + 30 min |
| "at 3pm" | today 15:00 (or tomorrow if already past) |
| "tomorrow morning" | tomorrow 09:00 |
| "in 60 seconds" | now + 1 min (the service polls every 30s; anything under 30s rounds up to next minute) |
| "every Friday at 5pm" | recurring, Friday 17:00 |

Smart defaults for vague timing:
- "later" / no time given (before noon): now + 2 hours
- "later" (after 6pm): tomorrow 09:00
- Day of week only ("every Monday"): 09:00 that day
- "end of day": 17:00

### Step 2: Write to reminders.json

Save to `~/.clawshelf/reminders.json` (create the file and folder if they don't exist). The values below are an example:

```json
{
  "id": "rem_001",
  "text": "Call Grace",
  "trigger_time": "2026-04-05T14:33:00",
  "recurring": null,
  "status": "active",
  "created": "2026-04-05T14:32:00"
}
```

Use **local time** (no timezone suffix) for `trigger_time` — the service reads it as local time.

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

### Step 3: Confirm to the user

```
⏰ Reminder set!
📝 "Call Grace"
🕐 Today at 2:33 PM (in 1 minute)
```

---

## Delivering reminders

The service handles delivery automatically. When `trigger_time` arrives, the user gets:
- **Windows**: WinRT toast notification (bottom-right corner)
- **macOS**: System notification (Notification Center)
- **Linux**: `notify-send` desktop notification (or `wall` broadcast if no desktop)

---

## Managing reminders

**List** — "show my reminders" / "what reminders do I have":

Read `~/.clawshelf/reminders.json` and show active entries:
```
📋 Active Reminders (3):
1. Call Grace — Today 2:33 PM
2. Submit timesheet — Every Friday 5:00 PM
3. Review PR — Tomorrow 9:00 AM

Say "cancel 1" to remove, or "snooze 1 for 1 hour" to delay.
```

**Cancel**: "cancel reminder 1" or "remove the Grace one"
→ Set `status: "cancelled"` in JSON

**Snooze**: "snooze 1 for 1 hour"
→ Advance `trigger_time` in JSON

**Edit**: "change reminder 1 to 4pm"
→ Update `trigger_time` in JSON

If you also scheduled an agent task for a reminder, cancel or move it to match.

---

## Keeping reminder text useful

Extract the core action from verbose input. "Remind me that I need to follow up with the Acme team about the Q3 renewal proposal" → `"Follow up: Acme Q3 renewal"`. The notification fires at a glance; it needs to be readable instantly.

If the user has more than 50 active reminders, gently suggest a review before adding more.
