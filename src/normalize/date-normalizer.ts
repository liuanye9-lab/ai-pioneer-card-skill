/**
 * Date normalization (PRD §9.3, SPEC §6, SKILL §6).
 *
 * Converts common date formats to the canonical `M月D日` form, including
 * ranges (`8.9-8.15` -> `8月9日—8月15日`). It NEVER invents a year, weekday,
 * timezone, or "today"; only semantically-equivalent reformatting is allowed.
 */

export interface DateNormalization {
  source: string;
  normalized: string;
  semantic_equal: true;
}

// Range: two dates joined by - — ~ 至 到. Try range before single.
const RANGE_SEPARATORS = ["—", "-", "~", "～", "至", "到"];

/**
 * Match a single month/day token in supported numeric or CJK forms.
 * Supported: 0809, 8.9, 08.09, 8/9, 08/09, 8-9, 08-09, 8月9, 8月9日
 */
function parseSingleDate(token: string): { month: number; day: number } | null {
  const t = token.trim();

  // 8月9日 / 8月9 / 8月9号
  const cjkMatch = t.match(new RegExp(`^(\\d{1,2})月(\\d{1,2})[日号]?$`));
  if (cjkMatch) {
    return validate(Number(cjkMatch[1]), Number(cjkMatch[2]));
  }

  // 0809 (exactly 4 digits, MMDD)
  const compact = t.match(/^(\d{2})(\d{2})$/);
  if (compact) {
    return validate(Number(compact[1]), Number(compact[2]));
  }

  // 8.9 / 08.09 / 8/9 / 08/09 / 8-9 / 08-09
  const sep = t.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})$/);
  if (sep) {
    return validate(Number(sep[1]), Number(sep[2]));
  }

  return null;
}

function validate(month: number, day: number): { month: number; day: number } | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
}

function format({ month, day }: { month: number; day: number }): string {
  return `${month}月${day}日`;
}

/**
 * Normalize a single date-like token. Returns null when not a date so that
 * plain numbers (prices, counts) are never mis-treated as dates.
 */
export function normalizeDateToken(token: string): DateNormalization | null {
  // Try range first.
  for (const sepChar of RANGE_SEPARATORS) {
    const idx = findRangeSeparator(token, sepChar);
    if (idx > 0) {
      const left = token.slice(0, idx);
      const right = token.slice(idx + sepChar.length);
      const a = parseSingleDate(left);
      const b = parseSingleDate(right);
      if (a && b) {
        const normalized = `${format(a)}—${format(b)}`;
        return { source: token, normalized, semantic_equal: true };
      }
    }
  }

  const single = parseSingleDate(token);
  if (single) {
    const normalized = format(single);
    if (normalized === token.trim()) {
      // Already canonical — still report equal so callers can dedupe.
      return { source: token, normalized, semantic_equal: true };
    }
    return { source: token, normalized, semantic_equal: true };
  }
  return null;
}

/**
 * Avoid treating a compact "8-9" inside a bare hyphen-minus of a range that
 * is actually one date (like "8-9"). We only split on a separator when both
 * sides independently parse. For the hyphen we must be careful because it is
 * also a valid single-date separator; findRangeSeparator only reports a split
 * point when there is a plausible date on both sides.
 */
function findRangeSeparator(token: string, sep: string): number {
  // Find a separator that is NOT the only separator of a simple single date.
  // Strategy: scan every occurrence; return the first that yields two valid
  // dates when split.
  let from = 0;
  for (;;) {
    const idx = token.indexOf(sep, from);
    if (idx < 0) return -1;
    const left = token.slice(0, idx);
    const right = token.slice(idx + sep.length);
    if (parseSingleDate(left) && parseSingleDate(right)) {
      return idx;
    }
    from = idx + sep.length;
  }
}

// Fold full-width digits/colon so 全角 dates in free text normalize too (D6).
function foldFullWidthDigits(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\uFF1A/g, ":");
}

/**
 * Strip any inline URL (and its 提交地址/链接 lead-in) from body copy — links
 * belong on buttons, never jammed into card text. Shared by the IA reward path
 * and the editable-body assembler.
 */
export function stripInlineUrls(text: string): string {
  return text
    .replace(/(?:提交|报名|活动|课程|详情|大赛|地址|链接|入口|网址)?[:：]?\s*https?:\/\/[^\s，。；、）)]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[，、,]\s*$/, "")
    .trim();
}

// Words nearby that make an ambiguous numeric token (8.9 / 0809) actually a date.
const DATE_CONTEXT =
  /(日期|截止|开营|开赛|开始|开课|报名|提交|活动|大赛|deadline|截至|结束|举办|上线|发布|当天|之前|以前|前|起|到|至)/;
// Unit suffixes that PROVE a token is NOT a date (price/quantity/ordinal/rule…).
const NON_DATE_SUFFIX = /^\s*(元|万|亿|块|折|名|号|位|人|个|条|章|款|项|届|期|%|％|分|秒|页|GB|MB|KB|kg|千克|克|米|次)/;
// Prefixes that PROVE a token is NOT a date (extension/room/price/fee…).
const NON_DATE_PREFIX = /(分机|房间|会议室|价格|单价|售价|费用|费|编号|编码|工号|订单号|座位|电话|手机|QQ|版本|第|楼|座|室|号楼)\s*$/;

/**
 * Decide whether a matched numeric token at [idx, idx+len) in `text` should be
 * treated as a date. CJK forms (8月9日) are always dates; ambiguous numeric
 * forms (8.9 / 8-9 / 0809) require date context AND no unit prefix/suffix so we
 * never rewrite `8.9万元`, `会议室0809`, `第8.15条`, `价格8.9元` into dates (D5).
 */
function looksLikeDateInContext(
  text: string,
  idx: number,
  match: string,
  ambiguous: boolean,
): boolean {
  if (!ambiguous) return true; // explicit 8月9日 / ranges are unambiguous
  const before = text.slice(Math.max(0, idx - 6), idx);
  const after = text.slice(idx + match.length, idx + match.length + 4);
  if (NON_DATE_PREFIX.test(before)) return false;
  if (NON_DATE_SUFFIX.test(after)) return false;
  const around = text.slice(Math.max(0, idx - 8), idx + match.length + 8);
  return DATE_CONTEXT.test(around);
}

/**
 * Scan free text and return every date normalization plus the text with
 * dates replaced by their canonical form. Used by copy normalization.
 *
 * Ambiguous numeric tokens (bare `8.9`, `0809`) are only converted when a date
 * context word is nearby and no price/quantity/ordinal unit adjoins them, so
 * facts like `8.9万元奖金` / `会议室0809` / `第8.15条` are never corrupted.
 */
export function normalizeDatesInText(rawText: string): {
  text: string;
  normalizations: DateNormalization[];
} {
  const normalizations: DateNormalization[] = [];
  const text = foldFullWidthDigits(rawText);

  // pattern, ambiguous? — ambiguous forms get the context/unit gate.
  const patterns: Array<{ re: RegExp; ambiguous: boolean }> = [
    // CJK-marked range 8月9日-8月15日 / 8月9日至8月15日 (unambiguous — 月/日 markers)
    {
      re: new RegExp(`(\\d{1,2}月\\d{1,2}[日号]?)\\s*[—\\-~～至到]\\s*(\\d{1,2}月\\d{1,2}[日号]?)`, "g"),
      ambiguous: false,
    },
    // purely-numeric range 8.9-8.15 / 8/9-8/15 (AMBIGUOUS — a price/rule range like
    // 售价8.9-8.15元 or 第8.9-8.15条 must NOT become a date range; needs context + no unit)
    {
      re: /(?<![\d.])(\d{1,2}[./-]\d{1,2}\s*[—\-~～至到]\s*\d{1,2}[./-]\d{1,2})(?![\d.])/g,
      ambiguous: true,
    },
    // CJK single 8月9日 / 8月9 (unambiguous — the 月/日 markers make it a date)
    { re: /(\d{1,2}月\d{1,2}[日号]?)/g, ambiguous: false },
    // numeric 8.9 / 08/09 / 8-9 (AMBIGUOUS — needs context + no unit)
    { re: /(?<![\d.])(\d{1,2}[./-]\d{1,2})(?![\d.])/g, ambiguous: true },
    // compact 0809 (AMBIGUOUS — needs context + no unit)
    { re: /(?<!\d)(\d{4})(?!\d)/g, ambiguous: true },
  ];

  let working = text;
  for (const { re, ambiguous } of patterns) {
    working = working.replace(re, (match, ...args) => {
      // args: [...groups, offset, wholeString]; offset is second-to-last.
      const offset = args[args.length - 2] as number;
      if (!looksLikeDateInContext(working, offset, match, ambiguous)) return match;
      const norm = normalizeDateToken(match);
      if (norm) {
        normalizations.push(norm);
        return norm.normalized;
      }
      return match;
    });
  }

  return { text: working, normalizations };
}
