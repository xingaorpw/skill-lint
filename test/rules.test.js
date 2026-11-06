import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bodyTooLong,
  descriptionLength,
  descriptionMissing,
  descriptionTrigger,
  frontmatterMissing,
  jaccard,
  nameFormat,
  nameMissing,
  noExamples,
  noHeading,
  tokenizeDescription,
  triggerOverlap,
} from '../src/rules.js';

function ctx(overrides = {}) {
  return {
    file: overrides.file ?? 'demo/SKILL.md',
    hasFrontmatter: overrides.hasFrontmatter ?? true,
    data: overrides.data ?? {
      name: 'demo-skill',
      description: 'Use when the user asks for a demo. Covers the basic flow.',
    },
    body: overrides.body ?? '## 工作流\n\n```bash\ndemo run\n```\n',
    allSkills: overrides.allSkills ?? [],
  };
}

test('frontmatter-missing：无 frontmatter 报错', () => {
  assert.ok(frontmatterMissing.check(ctx({ hasFrontmatter: false })));
  assert.equal(frontmatterMissing.check(ctx()), null);
});

test('name-missing：缺 name 报错，无 frontmatter 时不重复报', () => {
  const missing = ctx({ data: { description: 'Use when x' } });
  assert.ok(nameMissing.check(missing));
  assert.equal(nameMissing.check(ctx({ hasFrontmatter: false })), null);
});

test('name-format：kebab-case 通过，下划线不通过', () => {
  assert.equal(nameFormat.check(ctx()), null);
  const bad = ctx({ data: { name: 'Bad_Name', description: 'Use when x' } });
  assert.ok(nameFormat.check(bad));
});

test('name-format：长度边界', () => {
  assert.ok(nameFormat.check(ctx({ data: { name: 'a', description: 'Use when x' } })));
  assert.equal(nameFormat.check(ctx({ data: { name: 'ab', description: 'Use when x' } })), null);
});

test('description-missing：缺失时报错', () => {
  assert.ok(descriptionMissing.check(ctx({ data: { name: 'x' } })));
});

test('description-length：过短和过长都报', () => {
  assert.ok(descriptionLength.check(ctx({ data: { name: 'x', description: 'too short' } })));
  const long = 'a'.repeat(201);
  assert.ok(descriptionLength.check(ctx({ data: { name: 'x', description: long } })));
  assert.equal(descriptionLength.check(ctx()), null);
});

test('description-trigger：没有触发词时提示', () => {
  const noTrigger = ctx({ data: { name: 'x', description: 'A tool that formats markdown tables nicely.' } });
  assert.ok(descriptionTrigger.check(noTrigger));
  const chinese = ctx({ data: { name: 'x', description: '当用户要求写周报时使用，覆盖格式与语气。' } });
  assert.equal(descriptionTrigger.check(chinese), null);
});

test('no-examples：没有代码块时提示', () => {
  assert.ok(noExamples.check(ctx({ body: '## 说明\n\n纯文字，没有示例。' })));
  assert.equal(noExamples.check(ctx()), null);
});

test('no-heading：没有二级标题时提示', () => {
  assert.ok(noHeading.check(ctx({ body: '只有正文\n```\nx\n```' })));
  assert.equal(noHeading.check(ctx()), null);
});

test('body-too-long：超过 12000 字符时提示', () => {
  assert.ok(bodyTooLong.check(ctx({ body: 'x'.repeat(12001) })));
  assert.equal(bodyTooLong.check(ctx({ body: 'x'.repeat(12000) })), null);
});

test('jaccard 基本性质', () => {
  assert.equal(jaccard(new Set(['a']), new Set(['a'])), 1);
  assert.equal(jaccard(new Set(['a']), new Set(['b'])), 0);
  assert.equal(jaccard(new Set(), new Set(['a'])), 0);
});

test('tokenizeDescription：英文去停用词，中文转 bigram', () => {
  const tokens = tokenizeDescription('Use when the user wants 周报');
  assert.ok(tokens.has('user'));
  assert.equal(tokens.has('the'), false);
  assert.ok(tokens.has('周报'));
});

test('trigger-overlap：高相似能检出，不相关检不出', () => {
  const a = ctx({
    file: 'a/SKILL.md',
    data: { name: 'write-report', description: 'Use when the user asks to write a weekly report document.' },
  });
  const b = ctx({
    file: 'b/SKILL.md',
    data: { name: 'make-report', description: 'Use when the user asks to write a weekly report document.' },
  });
  const c = ctx({
    file: 'c/SKILL.md',
    data: { name: 'deploy-k8s', description: 'Use when deploying containers to a kubernetes cluster.' },
  });

  a.allSkills = [a, b, c];
  b.allSkills = [a, b, c];
  c.allSkills = [a, b, c];

  assert.ok(triggerOverlap.check(a), '相似的应该报冲突');
  assert.equal(triggerOverlap.check(c), null, '不相关的不该报');
});

test('trigger-overlap：自己不会和自己冲突', () => {
  const a = ctx({ file: 'a/SKILL.md' });
  a.allSkills = [a];
  assert.equal(triggerOverlap.check(a), null);
});
