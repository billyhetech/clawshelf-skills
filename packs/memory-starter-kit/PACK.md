---
name: memory-starter-kit
description: Equip your agent with persistent memory and personal context to maintain continuity and recognize user preferences across every session. Includes basic-memory and personal-context.
license: MIT
skills:
  - basic-memory
  - personal-context
metadata:
  clawshelf:
    title: Memory Starter Kit
    summary: Equip your agent with persistent memory and personal context to maintain continuity and recognize user preferences across every session.
    summary_zh: 为 Agent 配齐持久记忆和个人档案，跨对话保持连贯，记住你的偏好。
    category: productivity
    version: 1.1.0
    release_notes: Now installs from the public clawshelf-skills repo with one command.
---

# Memory Starter Kit

Two skills that give your agent a memory:

- **basic-memory** — saves and recalls facts, decisions and preferences across conversations.
- **personal-context** — builds a profile (name, role, timezone, goals, style) so the agent knows who it works with.

Install both:

```bash
npx skills add billyhetech/clawshelf-skills --skill basic-memory --skill personal-context
```
