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
- 合并到 `master` 即发布：`npx skills update` 会拿到更新，clawshelf.com 也会同步刷新。
- 付费（Pro）技能不在这个仓库，通过 clawshelf.com 用 API Key 安装。

## 发布（维护者）

每次推送到 `master` 且改动了 `skills/` 或 `packs/`，`.github/workflows/publish.yml` 会自动把有改动的技能打包、上传到 ClawShelf 的存储，并更新 clawshelf.com 上的页面。修改 `version` 会新增一条更新日志。`SKILL.md` frontmatter 的可选字段：

```yaml
metadata:
  clawshelf:
    title: Basic Memory          # 显示名称（默认取文件夹名）
    summary: One sentence …      # ≤ 300 字符（默认取 description 第一句）
    summary_zh: 一句话中文简介      # ≤ 200 字符
    category: productivity       # clawshelf.com 的分类
    version: 1.1.0               # 修改即记录一次发布
    release_notes: What changed  # 默认使用提交信息
```

套装放在 `packs/<name>/PACK.md`，用 `skills:` 列出包含的技能。

## 许可

MIT，见 [LICENSE](./LICENSE)。
