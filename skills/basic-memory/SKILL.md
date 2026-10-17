---
name: basic-memory
description: Gives your agent persistent memory across conversations by saving facts, decisions, and preferences to a structured MEMORY.md and daily logs, and recalling them later. Use this skill whenever users say 'remember this', 'save this', 'don't forget', 'note that', 'what do you remember', 'forget [topic]', or share something worth keeping — even if they don't explicitly ask. Also use it at the start of a session to load prior context.
license: MIT
metadata:
  version: "1.2.0"
  clawshelf-title: "Basic Memory"
  clawshelf-summary: "Equip your agent with persistent memory by automatically saving facts, preferences, and decisions across every conversation session."
  clawshelf-summary-zh: "让 Agent 拥有持久记忆，自动保存每次对话中的事实、偏好和决定。"
  clawshelf-category: "productivity"
  clawshelf-release-notes: "Works in any Agent Skills client: it organizes the agent's own memory file when there is one, otherwise a relative .clawshelf/ folder, and session-start loading falls back to on-demand."
---

# Basic Memory

## Purpose

Without clear structure and save habits, important facts get buried or never written down at all. This skill teaches the agent exactly what to save, where to put it, and how to retrieve it — so memory actually works in practice.

## Rules

- Never save passwords, API keys, ID numbers, card numbers, or health data — not even if the user asks. Acknowledge verbally and skip the write.
- Distill each entry to one clear sentence. Never paste raw conversation.
- Ask before deleting anything, and show what would be removed.
- When a new fact contradicts a saved one, ask before overwriting it.
- Only write the memory files described below. Never touch an agent's internal memory index or database files.

## Where Memory Lives

Pick the memory folder once, then keep using it:

1. **The agent already has a memory file it loads on its own** (a built-in `MEMORY.md` in its workspace, for example): organize that file and its daily files in place. The agent keeps loading them automatically, and earlier memories stay where they are.
2. **Otherwise**: use `.clawshelf/basic-memory/` (see Saving Data).

```
<memory folder>/
├── MEMORY.md                  ← long-term facts
└── memory/
    └── YYYY-MM-DD.md          ← daily log
```

## MEMORY.md Structure

Organize `MEMORY.md` into four sections. Create any missing section on first write. The entries below are examples — replace them with the user's own.

```markdown
## Facts
- [2026-04-09] User's name is Sam. Works as a product designer at a startup.

## Preferences
- [2026-04-09] Prefers concise replies. Dislikes unnecessary preamble.

## Action Items
- [ ] [2026-04-09] Follow up on API integration by Friday.
- [x] [2026-04-08] Send draft proposal to team. (done)

## Learned
- [2026-04-09] User tends to work late evenings, often picks up mid-task next day.
```

## On Session Start

If the agent already loaded `MEMORY.md` on its own, use that context right away. Otherwise read `MEMORY.md` plus today's and yesterday's daily logs. Then scan for open Action Items and surface any that are overdue or relevant to the user's first message.

Skills load only when a request matches them, so a fresh session won't load memory by itself. Offer once to add this line to the agent's always-on instructions (only after the user approves): "At the start of each session, load memory with the basic-memory skill." Without that line, load memory the first time it comes up in a conversation.

## Auto-Save During Conversation

While this skill is active, detect and save without being asked when the user shares:

| Signal | Section | File |
|---|---|---|
| Name, job, company, location, family | `## Facts` | `MEMORY.md` |
| "I prefer…", "I hate…", "always use…" | `## Preferences` | `MEMORY.md` |
| "I decided to…", "let's go with…", deadlines | `## Action Items` | `MEMORY.md` |
| Project names, key people, recurring context | daily log | `memory/YYYY-MM-DD.md` |
| Patterns you've noticed about the user | `## Learned` | `MEMORY.md` |

After auto-saving, confirm briefly in one line: "Noted: [distilled fact]."

## Retrieving Memory

If the agent has built-in memory search tools, use them. Otherwise search the memory folder with the agent's own file search, and read `MEMORY.md` or a specific daily log directly when you need the full file.

## Explicit Commands

**"Remember this" / "Save this"**
1. Confirm: "Got it, I'll remember: [one-line summary]"
2. Write to the appropriate section

**"What do you remember about [topic]?"**
1. Search the memory files for the topic
2. Return matching entries with dates
3. If nothing found: "I don't have anything saved about [topic] yet."

**"Forget [topic]"**
1. Show the entries that would be removed
2. Ask for confirmation before deleting

**"Show all memories"**
Read `MEMORY.md` and report entry counts per section plus approximate size.

## Before a Session Ends

Some agents reset or compact long sessions without saving anything, so whatever was discussed but not written down is lost. If a session has been long or contained important decisions, offer before wrapping up — "Want me to save today's key points before you go?" — then write them to the daily log and update `MEMORY.md`.

## Integration with personal-context

If `personal-context` is also installed, the two skills complement each other:
- `me.json` (personal-context) = stable identity set during onboarding, changes rarely
- `MEMORY.md` (this skill) = evolving knowledge that grows with every conversation

Don't duplicate identity-level facts (name, role, timezone) in `MEMORY.md` if they're already in `me.json`. Use `MEMORY.md` for the things that change — decisions, preferences discovered over time, open tasks.

See `references/memory-hygiene.md` for size limits, archiving rules, and deduplication guidance.

## Saving Data

Save this skill's files under `.clawshelf/basic-memory/`, a relative folder in the agent's working directory, and create it on first use. Every ClawShelf skill uses the same `.clawshelf/` folder, so they can read each other's data. If the user names a different folder, use that. If the agent can't write files, keep the state in the conversation and give the user the content to save.
