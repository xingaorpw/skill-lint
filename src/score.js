const ERROR_DEDUCTION = 20;
const WARN_DEDUCTION = 8;

function deductionFor(issue) {
  if (Number.isFinite(issue?.weight)) return issue.weight;
  if (issue?.level === 'error') return ERROR_DEDUCTION;
  if (issue?.level === 'warn') return WARN_DEDUCTION;
  return 0;
}

/**
 * 从 100 分开始扣分，最低 0 分。返回 0–100 的整数。
 */
export function scoreSkill(issues = []) {
  const list = Array.isArray(issues) ? issues : [];
  let score = 100;

  for (const issue of list) {
    score -= deductionFor(issue);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * A >= 90, B >= 75, C >= 60, D >= 40, 其余 F。
 */
export function grade(score) {
  if (!Number.isFinite(score)) return 'F';
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export { ERROR_DEDUCTION, WARN_DEDUCTION };
