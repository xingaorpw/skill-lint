import { test } from 'node:test';
import assert from 'node:assert/strict';

import { grade, scoreSkill } from '../src/score.js';

const error = { id: 'e', level: 'error', weight: 20 };
const warn = { id: 'w', level: 'warn', weight: 8 };

test('没有问题是 100 分', () => {
  assert.equal(scoreSkill([]), 100);
});

test('error 扣 20，warn 扣 8', () => {
  assert.equal(scoreSkill([error]), 80);
  assert.equal(scoreSkill([warn]), 92);
  assert.equal(scoreSkill([error, warn]), 72);
});

test('不会低于 0', () => {
  assert.equal(scoreSkill([error, error, error, error, error, error]), 0);
});

test('不会高于 100', () => {
  assert.equal(scoreSkill([]), 100);
});

test('grade 边界', () => {
  assert.equal(grade(100), 'A');
  assert.equal(grade(90), 'A');
  assert.equal(grade(89), 'B');
  assert.equal(grade(75), 'B');
  assert.equal(grade(74), 'C');
  assert.equal(grade(60), 'C');
  assert.equal(grade(59), 'D');
  assert.equal(grade(40), 'D');
  assert.equal(grade(39), 'F');
  assert.equal(grade(NaN), 'F');
});
