---
name: morning-brief
description: Generates a concise prioritized daily briefing — weather, today's schedule, urgent email highlights, and a suggested action plan. Use this skill whenever the user says "morning brief", "daily brief", "brief me", "what's my day look like", "today's plan", or even just "good morning". Also activate for mid-day or evening requests about the day's remaining schedule or tomorrow's preview. Don't wait for the user to explicitly ask for a "briefing" — if they're checking in on their day, this skill is the right response.
metadata:
  version: "1.0.0"
  clawshelf-title: "Morning Brief"
  clawshelf-summary: "A concise, prioritized daily briefing: weather, today's schedule, urgent email highlights, and a suggested action plan."
  clawshelf-summary-zh: "每天一份精简的晨间简报：天气、今日日程、紧急邮件要点和建议的行动计划。"
  clawshelf-category: "productivity"
  clawshelf-release-notes: "First release in the public clawshelf-skills repo."
---

# Morning Brief

## Purpose

Give the user a single-screen view of their morning so they don't have to open four apps before coffee. The value is in synthesis: weather, calendar, and email individually tell you nothing; together they tell you how to prioritize your day. Every section should connect to that goal — if it doesn't help the user decide what to do first, it doesn't belong in the briefing.

---

## Step 1: Check Data Source Status

Before building the briefing, silently check whether gogcli is set up:

```bash
gog --version          # is gogcli installed?
gog auth list          # is an account authorized?
cat ~/.openclaw/.env   # is config present?
```

Proceed based on what's available:

| Status | Action |
|---|---|
| gogcli installed + account authorized | Fetch real data, build briefing |
| Only calendar authorized | Real calendar, email fallback message |
| Only email authorized | Real email, calendar fallback message |
| Not installed or not authorized | Run Setup Flow (Step 2) |

---

## Step 2: Setup Flow (First Use or After Reset)

Run this when gogcli is missing or no account is authorized. The goal is minimal friction — use the one-click setup script, not a manual walkthrough.

### Ask first

> "Connect Google Calendar and Gmail for real data? (y/n)"

- **No** → Skip. The briefing will show placeholder connect prompts.
- **Yes** → Run the setup script below. It handles everything automatically — the user only needs to click through one Google browser page.

### Run the setup script

Detect OS and run the matching script from this skill's `scripts/` directory:

**Windows** — tell the user to open PowerShell and run:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& "<skill-path>\scripts\setup.ps1"
```

**macOS / Linux** — tell the user to open Terminal and run:
```bash
bash "<skill-path>/scripts/setup.sh"
```

The script will:
1. Auto-download and install gogcli
2. Open Google Cloud Console in the browser (user clicks through 5 steps — about 3 minutes)
3. Run OAuth authorization automatically
4. Save config to `~/.openclaw/.env`
5. Verify the connection

If the user is unsure where `<skill-path>` is, find it with:
```bash
# macOS/Linux
find ~/.openclaw/skills -name "setup.sh" 2>/dev/null

# Windows PowerShell
Get-ChildItem -Path "$env:USERPROFILE\.openclaw\skills" -Recurse -Filter "setup.ps1"
```

### Resetting Access

To disconnect at any time:
```bash
gog auth remove you@gmail.com
rm ~/.openclaw/.env
# Windows: Remove-Item "$env:USERPROFILE\.openclaw\.env"
```
The next morning brief will re-enter Setup Flow.

---

## Step 3: App Config (First Use)

On first run, also ask for:
1. **City** — for weather (e.g., "Los Angeles")
2. **Wake time** — for scheduled delivery (e.g., "7:00 AM")
3. **Priority email senders** — optional (e.g., "boss@company.com")

Save to `~/.openclaw/morning-brief-config.json`:
```json
{
  "city": "Los Angeles",
  "wake_time": "07:00",
  "priority_senders": ["boss@company.com"],
  "timezone": "America/Los_Angeles"
}
```

---

## Step 4: Fetch Data

When gogcli is configured, load .env and fetch all sections in parallel:

```bash
source ~/.openclaw/.env

# Calendar: today's events
gog calendar events list --today --json

# Email: unread from last 24h, read-only
gog gmail search 'is:unread newer_than:1d' --json --readonly
```

For weather, use web search for the configured city.

---

## Building the Briefing

### Weather
```
☀️ Weather: 72°F, Sunny → High 78°F / Low 62°F
   No umbrella needed today.
```

### Schedule
From `gog calendar events list --today --json`. Highlight the next upcoming event.

```
📅 Today (3 events):
   09:00  Team standup (30 min)
   11:00  Client call — Acme Corp (1 hr)
   14:00  Dentist (1 hr)
   ⏰ Next: Team standup in 2 hours
```

If not connected: `📅 Calendar: Say "connect calendar" to set up Google Calendar.`

### Email Highlights
From `gog gmail search 'is:unread newer_than:1d' --json --readonly`.

Surface emails from priority senders and subjects containing "urgent", "ASAP", or "deadline". Show total unread count.

```
📧 Email (12 unread, 2 priority):
   🔴 boss@company.com — "Q3 budget approval needed"
   🟡 client@example.com — "Contract revision attached"
```

If not connected: `📧 Email: Say "connect email" to set up Gmail (read-only).`

### Suggested Plan
Cross-reference email urgency with calendar gaps. Give the user a concrete sequence — not generic advice.

```
📋 Suggested plan:
   1. Reply to budget email before standup (10 min)
   2. Review contract before client call
   3. 15:00–16:00 looks open — good slot for deep work
```

---

## Output Format

```
☀️ Good morning! Here's your brief for [Weekday, Month Day]:
━━━━━━━━━━━━━━━━━━━━━━━
[Weather]
[Schedule]
[Email Highlights]
[Suggested Plan]
━━━━━━━━━━━━━━━━━━━━━━━
Have a great day! ☕
```

Aim for a single screen. Trim detail before adding more.

---

## Time-of-Day Variants

- **Mid-day**: Show remaining events, pending emails, end-of-day checklist
- **Evening**: Show tomorrow's preview — next-day schedule and any upcoming deadlines

---

## Boundaries

The briefing informs — it doesn't act. Never reply to emails, modify calendar events, or take any write actions. If the user wants to act on something, they'll ask explicitly.

If any data source fails, skip that section and note it briefly. A partial briefing delivered cleanly beats an error.
