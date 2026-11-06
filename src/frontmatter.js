/**
 * 一个刻意保持很小的 SKILL.md frontmatter 解析器。
 *
 * 只支持本项目需要的 YAML 子集：
 *   - key: value
 *   - key: |
 *       multi-line text
 *   - key:
 *       - item
 *
 * 解析失败时不抛异常，而是返回 hasFrontmatter: false，让规则层统一处理。
 */

const OPEN_FENCE = '---';

function failed(text) {
  return { data: {}, body: text, hasFrontmatter: false };
}

function unquote(raw) {
  const value = raw.trim();
  if (value.length < 2) return value;

  const first = value[0];
  const last = value[value.length - 1];
  if (first === '"' && last === '"') {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (first === "'" && last === "'") {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function countIndent(line) {
  return /^[ \t]*/.exec(line)[0].length;
}

export function parse(content) {
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);

  if (lines.length === 0 || lines[0].trim() !== OPEN_FENCE) {
    return failed(text);
  }

  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === OPEN_FENCE) {
      close = i;
      break;
    }
  }

  if (close === -1) return failed(text);

  const frontmatterLines = lines.slice(1, close);
  const data = {};
  let i = 0;

  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];

    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i += 1;
      continue;
    }

    // 顶层 key 必须顶格；缩进行由块或数组消费。
    const match = /^([A-Za-z0-9_.-]+):(?:[ \t]*(.*))?$/.exec(line);
    if (!match) return failed(text);

    const key = match[1];
    const rest = (match[2] ?? '').trimEnd();

    if (rest === '|' || rest === '|-' || rest === '|+') {
      i += 1;
      const block = [];

      while (i < frontmatterLines.length) {
        const blockLine = frontmatterLines[i];
        if (blockLine.trim() === '') {
          block.push('');
          i += 1;
          continue;
        }
        if (countIndent(blockLine) === 0) break;
        block.push(blockLine);
        i += 1;
      }

      const nonEmpty = block.filter((entry) => entry.trim() !== '');
      const minIndent = nonEmpty.length
        ? Math.min(...nonEmpty.map((entry) => countIndent(entry)))
        : 0;

      const value = block
        .map((entry) => {
          if (entry.trim() === '') return '';
          return entry.slice(Math.min(minIndent, countIndent(entry)));
        })
        .join('\n')
        .replace(/\n+$/, '');

      data[key] = value;
      continue;
    }

    if (rest === '') {
      i += 1;
      const items = [];

      while (i < frontmatterLines.length) {
        const itemLine = frontmatterLines[i];
        if (itemLine.trim() === '') {
          i += 1;
          continue;
        }

        const item = /^[ \t]+-[ \t]*(.*)$/.exec(itemLine);
        if (!item) break;
        items.push(unquote(item[1]));
        i += 1;
      }

      data[key] = items.length > 0 ? items : '';
      continue;
    }

    data[key] = unquote(rest);
    i += 1;
  }

  return {
    data,
    body: lines.slice(close + 1).join('\n'),
    hasFrontmatter: true,
  };
}
