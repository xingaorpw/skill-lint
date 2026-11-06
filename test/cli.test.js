import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSkillFiles, lintFiles } from '../src/cli.js';

const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));

const GOOD = `---
name: weekly-report
description: Use when the user asks to write a weekly report. Covers format and tone.
---

## 工作流

\`\`\`bash
weekly-report --week 42
\`\`\`
`;

const BAD = `# 没有 frontmatter 的 skill

纯文字，没有示例，没有标题。
`;

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), 'skill-lint-'));
  mkdirSync(join(root, 'good'), { recursive: true });
  mkdirSync(join(root, 'bad'), { recursive: true });
  writeFileSync(join(root, 'good', 'SKILL.md'), GOOD, 'utf8');
  writeFileSync(join(root, 'bad', 'SKILL.md'), BAD, 'utf8');
  return root;
}

test('findSkillFiles 递归找到所有 SKILL.md', () => {
  const root = makeTree();
  try {
    const files = findSkillFiles(root);
    assert.equal(files.length, 2);
    assert.ok(files.every((f) => f.toLowerCase().endsWith('skill.md')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('lintFiles：好的高分，坏的报 frontmatter 缺失', () => {
  const root = makeTree();
  try {
    const results = lintFiles(findSkillFiles(root));
    const good = results.find((r) => r.file.includes('good'));
    const bad = results.find((r) => r.file.includes('bad'));

    assert.ok(good.score >= 90, `好的应该 >= 90，实际 ${good.score}`);
    assert.ok(bad.score < 70, `坏的应该 < 70，实际 ${bad.score}`);
    assert.ok(bad.issues.some((i) => i.id === 'frontmatter-missing'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI --json 输出可解析且字段完整', () => {
  const root = makeTree();
  try {
    const out = execFileSync(process.execPath, [CLI, root, '--json', '--threshold', '0'], { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    assert.equal(parsed.total, 2);
    assert.equal(typeof parsed.average, 'number');
    assert.equal(parsed.skills.length, 2);
    assert.ok(parsed.skills.every((s) => typeof s.score === 'number' && s.grade));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI 在空目录下友好退出（退出码 0）', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-lint-empty-'));
  try {
    const out = execFileSync(process.execPath, [CLI, root], { encoding: 'utf8' });
    assert.match(out, /没有找到任何 SKILL\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI --threshold 触发退出码 1', () => {
  const root = makeTree();
  try {
    let code = 0;
    try {
      execFileSync(process.execPath, [CLI, root, '--threshold', '95'], { encoding: 'utf8' });
    } catch (err) {
      code = err.status;
    }
    assert.equal(code, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
