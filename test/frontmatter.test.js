import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/frontmatter.js';

test('解析普通 frontmatter', () => {
  const result = parse('---\nname: weekly-report\ndescription: Use when the user asks for a weekly report.\n---\n\n# Weekly\n');
  assert.equal(result.hasFrontmatter, true);
  assert.equal(result.data.name, 'weekly-report');
  assert.equal(result.data.description, 'Use when the user asks for a weekly report.');
  assert.match(result.body, /# Weekly/);
});

test('解析多行块', () => {
  const text = ['---', 'name: x-skill', 'description: |', '  line one', '  line two', '---', '', 'body'].join('\n');
  const result = parse(text);
  assert.equal(result.hasFrontmatter, true);
  assert.equal(result.data.description, 'line one\nline two');
});

test('解析数组', () => {
  const text = ['---', 'name: x', 'tags:', '  - one', '  - two', '---', ''].join('\n');
  const result = parse(text);
  assert.deepEqual(result.data.tags, ['one', 'two']);
});

test('没有 frontmatter 时返回原文', () => {
  const result = parse('# just a heading\n');
  assert.equal(result.hasFrontmatter, false);
  assert.deepEqual(result.data, {});
  assert.match(result.body, /just a heading/);
});

test('缺少结束分隔符视为无 frontmatter', () => {
  const result = parse('---\nname: broken\n\n# no close\n');
  assert.equal(result.hasFrontmatter, false);
});

test('去掉 BOM', () => {
  const result = parse('\uFEFF---\nname: bom\n---\n');
  assert.equal(result.hasFrontmatter, true);
  assert.equal(result.data.name, 'bom');
});

test('引号会被剥离', () => {
  const result = parse('---\nname: "quoted"\ndescription: \'single\'\n---\n');
  assert.equal(result.data.name, 'quoted');
  assert.equal(result.data.description, 'single');
});

test('空输入不抛异常', () => {
  const result = parse('');
  assert.equal(result.hasFrontmatter, false);
});
