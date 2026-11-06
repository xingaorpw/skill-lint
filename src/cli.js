#!/usr/bin/env node
/**
 * skill-lint CLI
 *
 *   node src/cli.js [paths...] [--json] [--threshold 80]
 *
 * 不给路径时，默认扫描 ./skills 和 ~/.claude/skills。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from './frontmatter.js';
import { rules } from './rules.js';
import { scoreSkill, grade } from './score.js';
import { renderJson, renderText } from './report.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

/** 递归找出所有 SKILL.md。 */
export function findSkillFiles(root, out = [], depth = 0) {
  if (depth > 8) return out;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      findSkillFiles(full, out, depth + 1);
    } else if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') {
      out.push(full);
    }
  }
  return out;
}

/** 读取并解析一批文件，构建 ctx 列表（两趟：先建全部，再跑跨文件规则）。 */
export function buildContexts(files) {
  const contexts = [];
  for (const file of files) {
    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      content = '';
    }
    const parsed = parse(content);
    contexts.push({
      file,
      data: parsed.data,
      body: parsed.body,
      hasFrontmatter: parsed.hasFrontmatter,
      allSkills: contexts,
    });
  }
  return contexts;
}

/** 对每个 ctx 跑所有规则，返回结果列表。 */
export function lintContexts(contexts) {
  return contexts.map((ctx) => {
    const issues = [];
    for (const rule of rules) {
      const hit = rule.check(ctx);
      if (hit) {
        issues.push({
          id: rule.id,
          level: rule.level,
          weight: rule.weight,
          message: hit.message,
          hint: hit.hint ?? '',
        });
      }
    }
    const score = scoreSkill(issues);
    return { file: ctx.file, score, grade: grade(score), issues };
  });
}

export function lintFiles(files) {
  return lintContexts(buildContexts(files));
}

function defaultRoots() {
  const roots = [resolve('skills')];
  const claude = join(homedir(), '.claude', 'skills');
  if (existsSync(claude)) roots.push(claude);
  return roots;
}

function collectFiles(roots) {
  const files = [];
  const seen = new Set();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let stat;
    try {
      stat = statSync(root);
    } catch {
      continue;
    }
    const found = stat.isDirectory() ? findSkillFiles(root) : [root];
    for (const file of found) {
      if (seen.has(file)) continue;
      seen.add(file);
      files.push(file);
    }
  }
  return files;
}

function parseArgs(argv) {
  const opts = { paths: [], json: false, threshold: 80, color: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--threshold') {
      opts.threshold = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg.startsWith('--threshold=')) {
      opts.threshold = Number.parseInt(arg.split('=')[1], 10);
    } else if (arg === '--no-color') {
      opts.color = false;
    } else if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (!arg.startsWith('-')) {
      opts.paths.push(arg);
    }
  }
  if (!Number.isFinite(opts.threshold)) opts.threshold = 80;
  return opts;
}

const HELP = `skill-lint —— 给 AI agent 的 SKILL.md 做体检

用法:
  skill-lint [paths...] [--json] [--threshold 80] [--no-color]

参数:
  paths         要扫描的目录或 SKILL.md 文件；默认 ./skills 和 ~/.claude/skills
  --json        输出机器可读的 JSON
  --threshold   低于该分数时退出码为 1（默认 80）
  --no-color    关闭颜色
`;

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const roots = opts.paths.length > 0 ? opts.paths.map((p) => resolve(p)) : defaultRoots();
  const files = collectFiles(roots);

  if (files.length === 0) {
    process.stdout.write(
      `没有找到任何 SKILL.md。\n\n找过的位置：\n${roots.map((r) => `  - ${r}`).join('\n')}\n\n` +
        '用 skill-lint <目录> 指定一个包含 SKILL.md 的目录。\n',
    );
    return 0;
  }

  const results = lintFiles(files);
  const color = opts.color && process.stdout.isTTY && !process.env.NO_COLOR;

  if (opts.json) {
    process.stdout.write(`${renderJson(results, { threshold: opts.threshold })}\n`);
  } else {
    process.stdout.write(`${renderText(results, { threshold: opts.threshold, color })}\n`);
  }

  return results.some((r) => r.score < opts.threshold) ? 1 : 0;
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(thisFile)) {
  process.exitCode = main();
}
