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

/**
 * Scan free text and return every date normalization plus the text with
 * dates replaced by their canonical form. Used by copy normalization.
 */
export function normalizeDatesInText(text: string): {
  text: string;
  normalizations: DateNormalization[];
} {
  const normalizations: DateNormalization[] = [];

  // Order matters: match ranges and explicit CJK forms before bare numbers.
  const patterns: RegExp[] = [
    // range like 8.9-8.15, 8/9-8/15, 8月9日-8月15日, 8月9日至8月15日
    new RegExp(
      `(\\d{1,2}[./-]\\d{1,2}|\\d{1,2}月\\d{1,2}[日号]?)\\s*[—\\-~～至到]\\s*(\\d{1,2}[./-]\\d{1,2}|\\d{1,2}月\\d{1,2}[日号]?)`,
      "g",
    ),
    // CJK single 8月9日 / 8月9
    /(\d{1,2}月\d{1,2}[日号]?)/g,
    // numeric 8.9 / 08/09 / 8-9 (require boundary that is not a digit)
    /(?<![\d.])(\d{1,2}[./-]\d{1,2})(?![\d.])/g,
    // compact 0809 (4 digits) only when clearly a date context is handled by caller;
    // here we conservatively convert standalone 4-digit tokens that look like MMDD.
    /(?<!\d)(\d{4})(?!\d)/g,
  ];

  let working = text;
  for (const pattern of patterns) {
    working = working.replace(pattern, (match) => {
      // For compact 4-digit, only treat as date when it parses to a valid MMDD.
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
