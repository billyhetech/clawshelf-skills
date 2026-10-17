# ClawShelf Skills

[ClawShelf](https://clawshelf.com) 出品的免费 [Agent Skills](https://agentskills.io)。每个技能都是标准的 `SKILL.md` 文件夹，可在 Claude Code、Codex、Cursor、Gemini CLI、GitHub Copilot、OpenCode、OpenClaw 等所有支持 Agent Skills 标准的 Agent 中使用。

[English](./README.md)

## 安装

**任意 Agent**（通过 [skills CLI](https://github.com/vercel-labs/skills)）：

```bash
npx skills add billyhetech/clawshelf-skills                          # 交互式选择
npx skills add billyhetech/clawshelf-skills --skill basic-memory     # 只装一个
npx skills update                              # 保持最新
```

**Claude Code**：每个技能和每个套装同时也是这个插件市场里的插件：

```
/plugin marketplace add billyhetech/clawshelf-skills
/plugin install memory-starter-kit@clawshelf
```

## 套装

套装是把几个技能组合起来完成一件事的插件。里面的技能仍然是标准的 `SKILL.md` 文件夹，也可以单独安装。

| 套装 | 包含技能 | 任意 Agent 安装 | Claude Code |
|---|---|---|---|
| **Memory Starter Kit** — 为 Agent 配齐持久记忆和个人档案，跨对话保持连贯，记住你的偏好。 | `basic-memory`, `personal-context` | `npx skills add billyhetech/clawshelf-skills --skill basic-memory --skill personal-context` | `/plugin install memory-starter-kit --marketplace billyhetech/clawshelf-skills` |
| **Security First Kit** — 加固安装配置、监控 Agent 行为、安装前审查每个技能，一套装齐。 | `openclaw-hardening`, `permission-guard`, `skill-scanner` | `npx skills add billyhetech/clawshelf-skills --skill openclaw-hardening --skill permission-guard --skill skill-scanner` | `/plugin install security-first-kit --marketplace billyhetech/clawshelf-skills` |
| **Day One Kit** — 从第一天就井井有条：晨间简报、自然语言提醒，读到看到的内容一键摘要。 | `morning-brief`, `quick-reminder`, `smart-summarizer` | `npx skills add billyhetech/clawshelf-skills --skill morning-brief --skill quick-reminder --skill smart-summarizer` | `/plugin install day-one-kit --marketplace billyhetech/clawshelf-skills` |

## 技能

| 技能 | 作用 | Claude Code |
|---|---|---|
| [`basic-memory`](./skills/basic-memory) | 让 Agent 拥有持久记忆，自动保存每次对话中的事实、偏好和决定。 | `/plugin install basic-memory --marketplace billyhetech/clawshelf-skills` |
| [`morning-brief`](./skills/morning-brief) | 每天一份精简的晨间简报：天气、今日日程、紧急邮件要点和建议的行动计划。 | `/plugin install morning-brief --marketplace billyhetech/clawshelf-skills` |
| [`openclaw-hardening`](./skills/openclaw-hardening) | 在安装更多技能之前，排查 OpenClaw 的安全隐患：暴露的端口、缺失的鉴权和不安全的权限。 | `/plugin install openclaw-hardening --marketplace billyhetech/clawshelf-skills` |
| [`permission-guard`](./skills/permission-guard) | 监控已安装技能的行为，发现越权访问，并生成详细的权限审计报告。 | `/plugin install permission-guard --marketplace billyhetech/clawshelf-skills` |
| [`personal-context`](./skills/personal-context) | 建立一份持久的个人档案，记住你的名字、时区和沟通风格，让每次对话都更贴合你。 | `/plugin install personal-context --marketplace billyhetech/clawshelf-skills` |
| [`quick-reminder`](./skills/quick-reminder) | 用自然语言设置、管理和接收提醒。 | `/plugin install quick-reminder --marketplace billyhetech/clawshelf-skills` |
| [`skill-scanner`](./skills/skill-scanner) | 安装前扫描技能，找出恶意代码、提示词注入和权限滥用。 | `/plugin install skill-scanner --marketplace billyhetech/clawshelf-skills` |
| [`smart-summarizer`](./skills/smart-summarizer) | 几秒内把长文章、视频和 PDF 变成精简摘要：一句话结论、要点和可执行的行动项。 | `/plugin install smart-summarizer --marketplace billyhetech/clawshelf-skills` |

每个技能在 [clawshelf.com/skills](https://clawshelf.com/skills) 都有详情页。

## 仓库规则

- **这里只放 ClawShelf 自己做的技能。** ClawShelf 上收录的第三方技能从原作者的仓库安装，并注明作者。
- 套装定义在 [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json)（Claude Code 插件市场格式）。单技能条目由 `node scripts/marketplace.mjs` 自动生成，套装条目手工维护。
- 所有改动都走 Pull Request。CI 会运行官方的 [agentskills 校验](https://github.com/agentskills/agentskills)、`claude plugin validate`、仓库规则（`scripts/validate.mjs`），并确认 skills CLI 能发现每个技能。
- 合并到 `master` 即发布：`npx skills update` 和 Claude Code 插件更新会拿到新版本，clawshelf.com 也会同步刷新。
- 付费（Pro）技能不在这个仓库，Pro 会员在 clawshelf.com 或用 API Key 在 Agent 里安装。

## 发布（维护者）

每次推送到 `master` 且改动了 `skills/` 或 `.claude-plugin/`，`.github/workflows/publish.yml` 会把有改动的技能或套装打包、上传到 ClawShelf 的存储，并更新 clawshelf.com 上的页面。修改 `version` 会新增一条更新日志。

`SKILL.md` 的 metadata 遵循 Agent Skills 规范（值都是字符串的扁平映射）：

```yaml
metadata:
  version: "1.1.0"                       # 修改即记录一次发布
  clawshelf-title: "Basic Memory"        # 显示名称（默认取文件夹名）
  clawshelf-summary: "One sentence …"    # ≤ 300 字符（默认取 description 第一句）
  clawshelf-summary-zh: "一句话中文简介"     # ≤ 200 字符
  clawshelf-category: "productivity"     # clawshelf.com 的分类
  clawshelf-output-type: "video"         # 可选：video | slides | web | image | workflow
  clawshelf-release-notes: "What changed" # 默认使用提交信息
```

新增或改名技能后，运行 `node scripts/marketplace.mjs` 并提交 `.claude-plugin/marketplace.json`。

## 许可

MIT，见 [LICENSE](./LICENSE)。
