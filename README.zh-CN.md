# ClawShelf Skills

[ClawShelf](https://clawshelf.com) 出品的免费 [Agent Skills](https://agentskills.io)。每个技能都是标准的 `SKILL.md` 文件夹，可在 Claude Code、Codex、Cursor、Gemini CLI、GitHub Copilot、OpenCode、OpenClaw 等所有支持该格式的 Agent 中使用。

[English](./README.md)

## 安装

```bash
# 交互式选择技能
npx skills add billyhetech/clawshelf-skills

# 只安装一个技能
npx skills add billyhetech/clawshelf-skills --skill basic-memory

# 保持最新
npx skills update
```

想先看看效果？每个技能在 [clawshelf.com/skills](https://clawshelf.com/skills) 都有介绍页。

## 技能列表

| 技能 | 作用 |
|---|---|
| [`basic-memory`](./skills/basic-memory) | 跨对话的持久记忆：保存并找回事实、决定和偏好。 |
| [`personal-context`](./skills/personal-context) | 个人档案（姓名、角色、时区、目标、沟通风格），让 Agent 知道它在为谁工作。 |

## 仓库规则

- **这里只放 ClawShelf 自己做的技能。** ClawShelf 上收录的第三方技能从原作者的仓库安装，并注明作者。
- 所有改动都走 Pull Request，CI 会检查每个 `SKILL.md` 是否符合规范、能否被 skills CLI 发现。
- 合并到 `main` 即发布：`npx skills update` 会拿到更新，clawshelf.com 也会同步刷新。
- 付费（Pro）技能不在这个仓库，通过 clawshelf.com 用 API Key 安装。

## 许可

MIT，见 [LICENSE](./LICENSE)。
