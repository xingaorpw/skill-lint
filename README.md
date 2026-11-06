# skill-lint

> 给 AI agent 的 `SKILL.md` 做体检：触发词模糊、缺示例、token 太贵、多个 skill 抢同一个意图。

[![tests](https://github.com/xingaorpw/skill-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/xingaorpw/skill-lint/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

---

## 它解决什么问题

Skill 是给 agent 看的说明书。它不像代码，写错了**不会报错**——只会让模型在该用的时候想不起来用。

一个典型的坏 skill：

```markdown
---
name: report_writer
description: 写报告
---

帮我写周报。
```

三个问题，一个都不会报错：

1. `report_writer` 不是 kebab-case，某些加载器直接忽略
2. `description` 只有三个字——模型要靠它判断「什么时候该选我」，信息量不够就等于没写
3. 正文没有示例，模型只能猜输出长什么样

`skill-lint` 把这 10 类问题变成可检查的规则，并给出一个能进 CI 的分数。

### 真实输出

拿它扫一组真实安装的 skill：

```
$ node src/cli.js ~/.codex/skills --no-color
skill-lint · 共 5 个 skill

  !  84 B  ~/.codex/skills/.system/imagegen/SKILL.md
      ! description-length     description 长度为 570，不在 20–200 区间
        ↳ 太短说不清触发场景，太长会挤占上下文；建议 1–2 句，先写触发条件再写覆盖范围。
      ! body-too-long          正文 18550 字符，超过 12000 字符的 token 预算线
        ↳ 把背景资料拆到 references/，SKILL.md 只保留触发条件、流程和必要示例。

  ✗  72 C  ~/.codex/skills/.system/openai-docs/SKILL.md
      ✗ frontmatter-missing    缺少 frontmatter，agent 读不到 name 和 description
        ↳ 在文件第一行添加 ---，写入 name / description，再用 --- 结束。

  !  84 B  ~/.codex/skills/.system/review-agent/SKILL.md
      ! no-examples            正文没有代码块示例

  ✗  72 C  ~/.codex/skills/.system/skill-creator/SKILL.md
      ✗ frontmatter-missing    缺少 frontmatter，agent 读不到 name 和 description
      ! body-too-long          正文 15540 字符，超过 12000 字符的 token 预算线

  ✗  72 C  ~/.codex/skills/.system/skill-installer/SKILL.md
      ✗ frontmatter-missing    缺少 frontmatter，agent 读不到 name 和 description

──────────────────────────────────────────────────────────
  平均分 77 · 不达标 3 个（阈值 80）
```

连内置 skill 都有 3 个不达标。

---

## 快速开始

零依赖，不需要安装：

```bash
node src/cli.js                      # 扫 ./skills 和 ~/.claude/skills
node src/cli.js path/to/skills       # 扫指定目录
node src/cli.js a/SKILL.md b/SKILL.md  # 也可以直接点文件
```

或者全局装：

```bash
npm install -g .
skill-lint ~/.claude/skills
```

### 参数

| 参数 | 作用 |
|---|---|
| `--json` | 输出机器可读结果 |
| `--threshold 80` | 低于该分数时退出码为 1 |
| `--no-color` | 关闭颜色（非 TTY 环境自动关闭） |

---

## 检查哪些项

| 规则 | 级别 | 检查内容 |
|---|---|---|
| `frontmatter-missing` | error | 文件开头没有 `---` 包裹的元信息 |
| `name-missing` | error | 缺 `name` |
| `name-format` | warn | 不是 kebab-case，或长度不在 2–40 |
| `description-missing` | error | 缺 `description` |
| `description-length` | warn | 长度不在 20–200 |
| `description-trigger` | warn | 没有「Use when / 当…时 / 触发」这类场景词 |
| `no-examples` | warn | 正文没有代码块 |
| `no-heading` | warn | 正文没有 `##` 二级标题 |
| `body-too-long` | warn | 正文超过 12000 字符 |
| `trigger-overlap` | warn | 和另一个 skill 的 description 关键词 Jaccard 相似度 > 0.35 |

### 关于 `trigger-overlap`

这是最有意思的一条。两个 skill 如果都在描述「写周报」，模型每次都要猜选哪个——结果通常是随机挑一个，或者两个都调。

做法：把 description 切成关键词集合（英文去停用词，中文退化成 bigram），两两算 Jaccard 相似度。超过 0.35 就提示「和 xxx 抢同一个意图」。

这不是真正的语义相似度，但对「用词高度重合」这种情况非常有效，而且完全离线、零依赖、结果可复现。

---

## 打分规则

从 100 分开始扣，error 扣 20，warn 扣 8，最低 0 分。

| 分数 | 等级 |
|---|---|
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| 40–59 | D |
| 0–39 | F |

---

## 在 CI 里用

```yaml
- name: lint skills
  run: |
    node src/cli.js skills --threshold 80
```

分数掉下 80 就红。如果你的 skill 放在仓库里，这一条能防止别人提交一个「模型永远想不起来用」的 skill。

---

## 已知限制

- **只认 `SKILL.md`**，不认别的文件名。
- **`trigger-overlap` 是关键词重叠，不是语义**。两个用词完全不同但意思相同的 skill 检不出来；反过来，两个都在讲「代码」的无关 skill 可能误报。
- **中文分词是 bigram**，粗糙但够用。真正的分词需要词典，会破坏零依赖。
- **`body-too-long` 的 12000 字符线是经验值**，不同模型的上下文预算不一样。
- 不检查 skill 的**实际执行效果**——那是 `pr-reviewer-bench` 那类评测工具的事。

## License

[MIT](LICENSE) © 2026 xingaorpw
