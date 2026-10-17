# ClawShelf Skills

Free [Agent Skills](https://agentskills.io) made by [ClawShelf](https://clawshelf.com). Each skill is a standard `SKILL.md` folder, so it works in Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode, OpenClaw and every other agent that supports the format.

[中文说明](./README.zh-CN.md)

## Install

```bash
# pick skills interactively
npx skills add billyhetech/clawshelf-skills

# or install one skill
npx skills add billyhetech/clawshelf-skills --skill basic-memory

# keep them up to date
npx skills update
```

Prefer to browse first? Every skill has a page with examples on [clawshelf.com/skills](https://clawshelf.com/skills).

## Skills

| Skill | What it does |
|---|---|
| [`basic-memory`](./skills/basic-memory) | Persistent memory across conversations: saves and recalls facts, decisions and preferences. |
| [`personal-context`](./skills/personal-context) | A personal profile (name, role, timezone, goals, style) so your agent knows who it is working with. |

## How this repo works

- **Only skills made by ClawShelf live here.** Third-party skills listed on ClawShelf install from their authors' own repos and stay credited to them.
- Every change is a pull request. CI checks that each `SKILL.md` follows the spec and that the skills CLI can discover it.
- Merging to `main` publishes the update: `npx skills update` picks it up, and clawshelf.com refreshes its catalog.
- Premium (Pro) skills are not in this repo; they install from clawshelf.com with an API key.

## License

MIT — see [LICENSE](./LICENSE).
