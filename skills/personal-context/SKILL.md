---
name: personal-context
description: Builds a personal profile so your agent knows your name, role, timezone, goals, and communication style, starting with a short friendly onboarding the first time. Use this skill when users say 'update my profile', 'edit my preferences', 'who am I to you', 'what do you know about me', 'personalize your responses', when no profile exists yet, or when users say the agent's tone or style feels off.
license: MIT
metadata:
  version: "1.2.0"
  clawshelf-title: "Personal Context"
  clawshelf-summary: "Personalize every session by building a persistent profile that remembers your name, timezone, and communication style."
  clawshelf-summary-zh: "建立一份持久的个人档案，记住你的名字、时区和沟通风格，让每次对话都更贴合你。"
  clawshelf-category: "productivity"
  clawshelf-release-notes: "Works in any Agent Skills client: the profile lives in a relative .clawshelf/ folder (an existing me.json in the agent's memory folder keeps working), and session-start loading falls back to on-demand."
---

# Personal Context

## Purpose

A new agent treats every user like a stranger. This skill runs a short onboarding conversation the first time you meet a user, then uses the resulting profile to personalize every session that follows — the right name, the right tone, the right focus.

## Rules

- Ask onboarding questions one at a time, and let the user skip any of them.
- Only change the profile after the user confirms. Never infer and auto-update.
- Never store passwords, financial data, health records, or anything the user would expect to be confidential.
- The profile sets defaults, not limits. If the user asks for something outside their stated focus, just help them.

## Profile Location

`.clawshelf/personal-context/me.json` (see Saving Data). If the agent's own memory folder already holds a `me.json` from an earlier version of this skill, keep using that file instead.

This is a human-readable, user-editable file. Some agents also keep a profile of their own that they update automatically; the two can coexist. When they conflict, prefer what the user told you in `me.json`.

See `references/profile-schema.md` for the full field definitions and an annotated example.

## When to Activate

**First meeting:** If no `me.json` exists, run onboarding before engaging with the user's first message — unless they seem to be in the middle of something urgent, in which case finish helping them first and ask at the end.

**On demand:** Any of these should trigger the skill:
- "update my profile" / "edit my preferences"
- "who am I to you?" / "what do you know about me?"
- "personalize your responses" / "you don't seem to know me"

## First-Time Onboarding

Ask questions **one at a time** — never dump them all at once. The user can say "skip" at any point; a partial profile is better than none.

Suggested sequence:
1. "What should I call you?"
2. "What do you do for work?" *(role + company or project)*
3. "What's your timezone?" *(or just your city is fine)*
4. "What would you most like me to help you with?" *(e.g., coding, writing, scheduling, research)*
5. "Any preferences on how I communicate?" *(e.g., keep it brief, I like bullet points, casual tone)*

After collecting answers, save to `me.json` and confirm with a short summary. The details below are an example — use the user's own answers:

```
Got it, Sam! I'll remember:
• Product designer at a startup
• Pacific Time (Los Angeles)
• Main focus: content creation and product dev
• Style: concise and direct

Say "update my profile" anytime to change any of this.
```

## Using the Profile Every Session

When a session starts, read `me.json` if it exists and let it shape how you respond:

- **Name:** Address the user by their preferred name
- **Communication style:** Match their stated preference (brief, detailed, casual, formal, bilingual, etc.)
- **Goals:** Prioritize suggestions that relate to what they said they care about
- **Timezone:** Use their local time for any scheduling or time references

Skills load only when a request matches them, so a fresh session won't read the profile by itself. After onboarding, offer once to add this line to the agent's always-on instructions (only after the user approves): "At the start of each session, load my profile with the personal-context skill." Without that line, read the profile whenever this skill is active.

## Updating the Profile

When the user shares information that conflicts with what's saved:

1. Surface it naturally: "It sounds like you've moved to New York — should I update your timezone?"
2. Only write after explicit confirmation — don't infer and auto-update
3. Record the change in `me.json` under `"history"` with a timestamp

Why ask first? Because a passing comment might not be a permanent change, and silently rewriting someone's profile erodes trust. A one-line confirmation is worth it.

## Integration with basic-memory

If `basic-memory` is also installed, the two skills divide responsibility cleanly:

- `me.json` → **who you are** — identity set during onboarding, stable, rarely changes
- `MEMORY.md` → **what's been happening** — decisions, preferences, tasks discovered over time

Don't duplicate identity facts (name, role, timezone) in `MEMORY.md` if they're already in `me.json`. Let each file own its layer.

## Privacy

If sensitive information comes up during onboarding, skip it and explain briefly: "I'll leave that out — I don't store sensitive personal data."

## Saving Data

Save this skill's files under `.clawshelf/personal-context/`, a relative folder in the agent's working directory, and create it on first use. Every ClawShelf skill uses the same `.clawshelf/` folder, so they can read each other's data. If the user names a different folder, use that. If the agent can't write files, keep the state in the conversation and give the user the content to save.
