/**
 * 输出层。renderText / renderJson 都是纯函数，方便测试。
 */

const RESET = '\u001b[0m';
const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';

const CJK = /[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;

export function displayWidth(text) {
  let width = 0;
  for (const char of String(text ?? '')) {
    width += CJK.test(char) ? 2 : 1;
  }
  return width;
}

export function pad(text, width) {
  return String(text) + ' '.repeat(Math.max(0, width - displayWidth(text)));
}

function paint(text, color, enabled) {
  return enabled ? `${color}${text}${RESET}` : String(text);
}

export function markerFor(score, threshold) {
  if (score >= 90) return { symbol: '✓', color: GREEN };
  if (score >= threshold) return { symbol: '!', color: YELLOW };
  return { symbol: '✗', color: RED };
}

function issueLine(issue, color) {
  const mark = issue.level === 'error'
    ? paint('✗', RED, color)
    : paint('!', YELLOW, color);
  const head = `      ${mark} ${pad(issue.id, 22)} ${issue.message}`;
  const lines = [head];
  if (issue.hint) lines.push(paint(`        ↳ ${issue.hint}`, DIM, color));
  return lines;
}

/**
 * @param {Array<{file:string, score:number, grade:string, issues:Array}>} results
 */
export function renderText(results, { threshold = 80, color = false } = {}) {
  const lines = [];
  lines.push(
    paint('skill-lint', BOLD, color) + paint(` · 共 ${results.length} 个 skill`, DIM, color),
  );
  lines.push('');

  const width = Math.min(
    60,
    Math.max(20, ...results.map((r) => displayWidth(r.file))),
  );

  for (const result of results) {
    const { symbol, color: markColor } = markerFor(result.score, threshold);
    const scoreText = `${String(result.score).padStart(3)} ${result.grade}`;
    lines.push(
      `  ${paint(symbol, markColor, color)} ${paint(scoreText, markColor, color)}  ${pad(result.file, width)}`,
    );
    for (const issue of result.issues) {
      lines.push(...issueLine(issue, color));
    }
    lines.push('');
  }

  const average = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;
  const below = results.filter((r) => r.score < threshold).length;

  lines.push(paint('─'.repeat(58), DIM, color));
  const summary = `  平均分 ${average} · 不达标 ${below} 个（阈值 ${threshold}）`;
  lines.push(paint(summary, below > 0 ? YELLOW : GREEN, color));

  return lines.join('\n');
}

export function renderJson(results, { threshold = 80 } = {}) {
  const average = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;
  return JSON.stringify(
    {
      threshold,
      total: results.length,
      average,
      belowThreshold: results.filter((r) => r.score < threshold).length,
      skills: results,
    },
    null,
    2,
  );
}

export { paint, GREEN, RED, YELLOW, DIM, BOLD };
