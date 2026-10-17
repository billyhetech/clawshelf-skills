---
name: permission-guard
description: Security watchdog that checks what installed agent skills actually do — unauthorized file access, suspicious outbound connections, dangerous commands — and produces a permission audit report. Use it when the user asks "what did my agent do", "check what my skill accessed", "permission report", "did my agent do anything weird", "what files did my agent touch", after installing a new skill to record a baseline, or whenever unexpected behavior is suspected.
license: MIT
compatibility: "Needs shell access to inspect recent file changes and network connections. Commands are given for macOS and Linux; on Windows, use the PowerShell equivalents."
metadata:
  version: "1.2.0"
  clawshelf-title: "Permission Guard"
  clawshelf-summary: "Secure your agent by monitoring skill behavior, detecting unauthorized access, and generating detailed permission audit reports."
  clawshelf-summary-zh: "监控已安装技能的行为，发现越权访问，并生成详细的权限审计报告。"
  clawshelf-category: "security"
  clawshelf-release-notes: "Works in any Agent Skills client, not only OpenClaw: the log and baselines live in a relative .clawshelf/ folder, network checks work on macOS too, and removal advice no longer assumes one agent's CLI."
---

# Permission Guard

## Purpose

Give users clear visibility into what their installed skills are actually doing — catching unexpected file access, suspicious network calls, dangerous commands, or behavior that goes beyond a skill's declared purpose.

## Rules

- Alert and recommend — never act unilaterally. Removing a skill is always the user's decision.
- Never print the contents of credential files. Report the path and the access, not the secret.
- When uncertain whether something is a violation, log and flag it rather than ignoring it.
- Avoid false positives where possible: a legitimate skill flagged incorrectly hurts trust in the watchdog more than missing a minor anomaly.
- The log stays local and is never transmitted anywhere.

## Behavior Log

Keep a running log at `.clawshelf/permission-guard/permission-guard.log` (see Saving Data). Record each notable agent action in this format:

```
[ISO-8601 timestamp] SKILL:[skill-name] ACTION:[file|network|command] TARGET:[path/url/cmd] STATUS:[ok|flagged|blocked]
```

Keep log files under 10MB — rotate monthly by renaming the old file to `permission-guard.log.YYYY-MM`.

## Security Checks

Run all four checks when producing a report, then summarize findings together. `$PG` below stands for `.clawshelf/permission-guard`.

### Check 1 — Sensitive File Access

Look for recent touches to credential and configuration files since the last check:

```bash
PG=.clawshelf/permission-guard
mkdir -p "$PG"
[ -f "$PG/last-check" ] || touch -t 202601010000 "$PG/last-check"
find ~ -newer "$PG/last-check" -type f 2>/dev/null \
  | grep -E '(\.ssh|\.aws|\.gnupg|\.config/gcloud|\.gitconfig|Library/Keychains|\.config/google-chrome|\.mozilla)' \
  | head -30
# Update the timestamp after the check:
touch "$PG/last-check"
```

Flag any match. The risk is concrete: a rogue skill reading an SSH private key while appearing to do something routine is a classic credential exfiltration path.

### Check 2 — Outbound Network Connections

Review active connections with whichever tool the system has:

```bash
# Linux
ss -tnp 2>/dev/null | grep -Ev '(127\.0\.0\.1|::1|LISTEN)'
# macOS (or Linux without ss)
lsof -nP -iTCP -sTCP:ESTABLISHED 2>/dev/null | grep -Ev '(127\.0\.0\.1|\[::1\])'
```

On Windows, use `Get-NetTCPConnection -State Established`.

Flag connections to:
- Unrecognized IPs or domains not associated with the skill's declared APIs
- Known data-sharing services (pastebin, webhook.site, file-sharing hosts)
- Any plaintext (non-HTTPS) connection carrying data

### Check 3 — Dangerous Command Patterns

Check the log for commands that signal permission abuse:

```bash
grep -E '(rm[[:space:]]+-rf|chmod[[:space:]]+777|curl.+\|[[:space:]]*(ba)?sh|wget.+\|[[:space:]]*(ba)?sh|crontab[[:space:]]+-[el]|useradd|sudo[[:space:]])' \
  .clawshelf/permission-guard/permission-guard.log 2>/dev/null | tail -20
```

These patterns don't automatically mean malicious intent, but each warrants a prompt explanation to the user before proceeding.

### Check 4 — Behavioral Drift

Compare what a skill actually did against what its name and description promise. The principle: a skill should only do what its declared purpose suggests.

Examples worth flagging:
- A "weather" skill writing to the filesystem
- An "email" skill accessing SSH keys
- A "calendar" skill running arbitrary shell commands
- Any skill POSTing data to a URL not listed in its declared API set

## Output Format

Produce this report structure, omitting sections that have no events:

```
🛡️ Permission Guard — Activity Report
════════════════════════════════════════
Period: [start] → [end]
Skills monitored: [N]

✅ Normal Activity ([X] events)
   [skill-name]: [description of expected action]

⚠️  Flagged — Investigate ([Y] events)
   [skill-name]: accessed [path] — [why this is suspicious]
   [skill-name]: outbound POST to [ip/domain] — [context]

🔴 Critical — Action Required ([Z] events)
   [skill-name]: [credential path] read + outbound connection in same session
   → Recommend removing [skill-name]

Assessment: [one-sentence summary]
════════════════════════════════════════
```

If everything is clean, say so plainly — unnecessary warnings erode trust in the watchdog over time.

## Critical Violation Response

When the same skill accesses a credential file AND makes an outbound connection in the same session, treat this as a critical violation rather than a routine flag. This combination is the signature pattern of credential exfiltration: access + transmission. Either alone might be incidental; together they constitute a plausible attack.

Steps to take:
1. Surface the alert immediately and prominently — don't bury it in the report
2. Show the user the exact file accessed and the destination of the outbound call
3. Recommend removing the skill: delete its folder from the agent's skills folder, or use the tool it was installed with (for example `npx skills remove [skill-name]`)
4. Ask the user whether to proceed with removal or investigate further first — the decision is theirs, not the watchdog's

## First-Run Baseline

After any new skill is installed, capture a baseline before the skill runs for the first time. This makes future behavioral drift detection much more precise.

```bash
PG=.clawshelf/permission-guard
mkdir -p "$PG/baselines"
ls -la ~/.ssh ~/.aws ~/.gnupg ~/.gitconfig 2>/dev/null \
  > "$PG/baselines/[skill-name]-baseline.txt"
touch "$PG/last-check"
```

## Saving Data

Save this skill's files under `.clawshelf/permission-guard/`, a relative folder in the agent's working directory, and create it on first use. Every ClawShelf skill uses the same `.clawshelf/` folder, so they can read each other's data. If the user names a different folder, use that. If the agent can't write files, keep the state in the conversation and give the user the content to save.
