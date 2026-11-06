/**
 * 每条规则都是一个纯函数对象：{ id, level, weight, check(ctx) }。
 * check 返回 null 表示通过；返回 { message, hint } 表示命中。
 */

const ERROR = 'error';
const WARN = 'warn';
const ERROR_WEIGHT = 20;
const WARN_WEIGHT = 8;

export const STOPWORDS = new Set([
  'a',
  'the',
  'to',
  'and',
  'of',
  'in',
  'for',
  'is',
  'when',
  'use',
  'this',
  'that',
  'with',
]);

function descriptionOf(ctx) {
  const value = ctx?.data?.description;
  return typeof value === 'string' ? value.trim() : '';
}

function bodyOf(ctx) {
  return typeof ctx?.body === 'string' ? ctx.body : '';
}

function nameOf(ctx) {
  const value = ctx?.data?.name;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 英文按单词切；CJK 连续片段退化为 bigram（例如「周报」→「周报」）。
 * 这不是真正的分词，只是让中文 description 也能产生可比较的关键词集合。
 */
export function tokenizeDescription(description) {
  const tokens = new Set();
  const words = String(description ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

  for (const word of words) {
    const parts = word.match(/[\u3400-\u9fff]+|[^\u3400-\u9fff]+/gu) ?? [word];

    for (const part of parts) {
      if (/^[\u3400-\u9fff]+$/u.test(part)) {
        if (part.length === 1) {
          tokens.add(part);
        } else {
          for (let i = 0; i < part.length - 1; i += 1) {
            tokens.add(part.slice(i, i + 2));
          }
        }
      } else if (!STOPWORDS.has(part)) {
        tokens.add(part);
      }
    }
  }

  return tokens;
}

export function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  return intersection / (left.size + right.size - intersection);
}

export const frontmatterMissing = {
  id: 'frontmatter-missing',
  level: ERROR,
  weight: ERROR_WEIGHT,
  check(ctx) {
    if (ctx?.hasFrontmatter) return null;
    return {
      message: '缺少 frontmatter，agent 读不到 name 和 description',
      hint: '在文件第一行添加 ---，写入 name / description，再用 --- 结束。',
    };
  },
};

export const nameMissing = {
  id: 'name-missing',
  level: ERROR,
  weight: ERROR_WEIGHT,
  check(ctx) {
    if (ctx?.hasFrontmatter === false) return null;
    if (nameOf(ctx)) return null;
    return {
      message: 'frontmatter 缺少 name',
      hint: '添加 name: my-skill，使用小写字母、数字和连字符。',
    };
  },
};

export const nameFormat = {
  id: 'name-format',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    const name = nameOf(ctx);
    if (!name) return null;

    const valid = name.length >= 2
      && name.length <= 40
      && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);

    if (valid) return null;
    return {
      message: `name "${name}" 不是合法 kebab-case（要求 2–40 字符，仅 a-z0-9-）`,
      hint: '改成类似 weekly-report 的形式：全小写，单词之间用单个连字符。',
    };
  },
};

export const descriptionMissing = {
  id: 'description-missing',
  level: ERROR,
  weight: ERROR_WEIGHT,
  check(ctx) {
    if (ctx?.hasFrontmatter === false) return null;
    if (descriptionOf(ctx)) return null;
    return {
      message: 'frontmatter 缺少 description',
      hint: '写清楚「什么时候用」和「覆盖什么」，这是 agent 选择 skill 的主要依据。',
    };
  },
};

export const descriptionLength = {
  id: 'description-length',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    const description = descriptionOf(ctx);
    if (!description) return null;

    const length = description.length;
    if (length >= 20 && length <= 200) return null;

    return {
      message: `description 长度为 ${length}，不在 20–200 区间`,
      hint: '太短说不清触发场景，太长会挤占上下文；建议 1–2 句，先写触发条件再写覆盖范围。',
    };
  },
};

export const descriptionTrigger = {
  id: 'description-trigger',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    const description = descriptionOf(ctx);
    if (!description) return null;

    const lower = description.toLowerCase();
    const triggers = ['use when', 'when the user', '当', '触发', 'use this'];
    if (triggers.some((trigger) => lower.includes(trigger))) return null;

    return {
      message: 'description 里没有明确的触发场景词',
      hint: '加入 "Use when the user asks..." 或「当用户…时使用」，让模型知道何时该选它。',
    };
  },
};

export const noExamples = {
  id: 'no-examples',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    if (bodyOf(ctx).includes('```')) return null;
    return {
      message: '正文没有代码块示例',
      hint: '至少给一个最小可用示例（命令、输入/输出或调用片段），比纯描述更容易被执行。',
    };
  },
};

export const noHeading = {
  id: 'no-heading',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    if (/^##[ \t]+\S/m.test(bodyOf(ctx))) return null;
    return {
      message: '正文没有 ## 二级标题',
      hint: '用 ## 工作流、## 示例、## 注意事项 等二级标题组织内容，方便模型跳读。',
    };
  },
};

export const bodyTooLong = {
  id: 'body-too-long',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    const body = bodyOf(ctx);
    if (body.length <= 12000) return null;
    return {
      message: `正文 ${body.length} 字符，超过 12000 字符的 token 预算线`,
      hint: '把背景资料拆到 references/，SKILL.md 只保留触发条件、流程和必要示例。',
    };
  },
};

export const triggerOverlap = {
  id: 'trigger-overlap',
  level: WARN,
  weight: WARN_WEIGHT,
  check(ctx) {
    const description = descriptionOf(ctx);
    if (!description) return null;

    const ownTokens = tokenizeDescription(description);
    if (ownTokens.size === 0) return null;

    const allSkills = Array.isArray(ctx?.allSkills) ? ctx.allSkills : [];
    let best = null;

    for (const other of allSkills) {
      if (!other || other === ctx) continue;
      if (ctx.file && other.file && other.file === ctx.file) continue;

      const otherDescription = descriptionOf(other);
      if (!otherDescription) continue;

      const similarity = jaccard(ownTokens, tokenizeDescription(otherDescription));
      if (similarity <= 0.35) continue;
      if (!best || similarity > best.similarity) {
        best = { other, similarity };
      }
    }

    if (!best) return null;

    const otherName = nameOf(best.other);
    const label = otherName || best.other.file || '(未知 skill)';
    const location = best.other.file ? `，${best.other.file}` : '';
    return {
      message: `和 ${label} 抢同一个意图（description 关键词 Jaccard ${best.similarity.toFixed(2)}${location}）`,
      hint: '改写其中一个 description，明确输入、场景和边界；或把重叠部分合并成一个 skill。',
    };
  },
};

export const rules = [
  frontmatterMissing,
  nameMissing,
  nameFormat,
  descriptionMissing,
  descriptionLength,
  descriptionTrigger,
  noExamples,
  noHeading,
  bodyTooLong,
  triggerOverlap,
];

export default rules;
