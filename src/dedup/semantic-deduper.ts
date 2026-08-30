/**
 * Semantic Deduplication (PRD §9.5, SPEC §8, SKILL §8).
 *
 * The same fact should be expressed once. We compare candidate lines by:
 *   Exact -> Normalized -> Semantic (token overlap) -> Functional role.
 * If two lines are semantically equal AND share the same UI role, the lower
 * priority one is dropped. If they are semantically equal but functionally
 * different (e.g. a body line vs. a button label), BOTH are kept.
 */

import { normalizeDatesInText } from "../normalize/date-normalizer.js";

export type FunctionalRole = "header" | "body" | "cta" | "note";

export interface DedupCandidate {
  id: string;
  text: string;
  role: FunctionalRole;
  priority: number; // higher = keep preferentially
}

export interface DedupResult {
  kept: DedupCandidate[];
  removed: Array<{ candidate: DedupCandidate; duplicateOf: string; reason: string }>;
}

const STOPWORDS = new Set([
  "的", "了", "在", "是", "请", "大家", "记得", "我们", "你们", "小伙伴", "同学",
  "将", "会", "要", "和", "与", "及", "还", "就", "都", "也", "把", "被",
  "前", "后", "内", "中", "时", "时间",
]);

// Synonyms that mean the same thing → fold to one canonical token so reworded
// paraphrases (第一名/冠军, 一万/10000) are detected as duplicates.
const SYNONYMS: Array<[RegExp, string]> = [
  [/第一名|冠军|头名|状元/g, "冠军"],
  [/第二名|亚军/g, "亚军"],
  [/第三名|季军/g, "季军"],
  [/报名|注册|登记/g, "报名"],
  [/提交|上交|递交|上传/g, "提交"],
  [/截止|结束|终止|停止/g, "截止"],
  [/地点|地址|位置|场地/g, "地点"],
  [/奖金|奖励|奖品/g, "奖"],
];

/** Fold Chinese numerals + digit groups to a canonical number so 一万≈10000. */
function normalizeNumbers(text: string): string {
  const CN: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  return text
    // 一万 / 十万 / 两万 → <n>0000 ; 千 → 000
    .replace(/([一二两三四五六七八九十百千]+)万/g, (_, g) => `${cnToNum(g, CN)}0000`)
    .replace(/([一二两三四五六七八九十百]+)千/g, (_, g) => `${cnToNum(g, CN)}000`)
    .replace(/(\d+)万/g, (_, g) => `${g}0000`)
    .replace(/(\d+)千/g, (_, g) => `${g}000`);
}

function cnToNum(s: string, CN: Record<string, number>): number {
  // Handle simple forms: 十=10, 两=2, 一=1, 十五=15, 三=3…
  if (s === "十") return 10;
  if (s.length === 1) return CN[s] ?? 1;
  if (s[0] === "十") return 10 + (CN[s[1]] ?? 0);
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    return (CN[a] ?? 1) * 10 + (b ? CN[b] ?? 0 : 0);
  }
  return CN[s[0]] ?? 1;
}

function normalizeForCompare(text: string): string {
  const { text: dateNorm } = normalizeDatesInText(text);
  let out = normalizeNumbers(dateNorm);
  for (const [re, canon] of SYNONYMS) out = out.replace(re, canon);
  return out
    .replace(/[\s，。、！？；：,.!?;:「」『』"'()（）[\]【】]/g, "")
    .toLowerCase();
}

function tokenize(text: string): string[] {
  const normalized = normalizeForCompare(text);
  // Chinese: split into bigrams + keep latin/number words.
  const tokens: string[] = [];
  const latin = normalized.match(/[a-z0-9]+/g) ?? [];
  tokens.push(...latin);
  const cjk = normalized.replace(/[a-z0-9]+/g, "");
  for (let i = 0; i < cjk.length; i++) {
    const ch = cjk[i];
    if (STOPWORDS.has(ch)) continue;
    tokens.push(ch);
    if (i + 1 < cjk.length) tokens.push(cjk[i] + cjk[i + 1]);
  }
  return tokens;
}

/** Jaccard similarity over token sets. */
export function semanticSimilarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return inter / union;
}

/** Canonical dates present in a line (for domain-aware equivalence). */
function datesIn(text: string): Set<string> {
  const { normalizations } = normalizeDatesInText(text);
  return new Set(normalizations.map((n) => n.normalized));
}

const ACTION_VERBS = ["提交", "上交", "递交", "停止提交", "报名", "注册", "预约", "参加"];

/** Canonical numbers present in a line (after 一万→10000 folding). */
function numbersIn(text: string): Set<string> {
  return new Set((normalizeNumbers(text).match(/\d{2,}/g) ?? []));
}
const REWARD_TOKENS = ["冠军", "亚军", "季军", "奖", "名额", "证书"];
const PLACE_TOKENS = ["会议室", "地点", "线上", "线下", "会场", "楼", "室"];

/**
 * Effective similarity used for dedup: base Jaccard, boosted when two lines
 * share an identical normalized date AND an overlapping action verb (the
 * classic "same deadline, reworded" case). Distinct dates are never boosted.
 * Also boosts when two lines share a canonical number + reward token (10000元
 * 奖金 ≈ 一万元第一名) or the same location, catching non-date paraphrases.
 */
function effectiveSimilarity(a: string, b: string): number {
  let sim = semanticSimilarity(a, b);
  const da = datesIn(a);
  const db = datesIn(b);
  const sharedDate = [...da].some((d) => db.has(d));
  if (sharedDate) {
    const aVerb = ACTION_VERBS.find((v) => a.includes(v));
    const bVerb = ACTION_VERBS.find((v) => b.includes(v));
    if (aVerb && bVerb) sim = Math.max(sim, 0.85);
    else sim += 0.15; // same date, generic phrasing
  }
  // Same canonical number + both about a reward → same reward fact, reworded.
  const na = numbersIn(a);
  const nb = numbersIn(b);
  const sharedNum = [...na].some((n) => nb.has(n));
  const bothReward = REWARD_TOKENS.some((t) => a.includes(t)) && REWARD_TOKENS.some((t) => b.includes(t));
  if (sharedNum && bothReward) sim = Math.max(sim, 0.85);
  // Same location keyword + shared number (room/floor) → same location fact.
  const bothPlace = PLACE_TOKENS.some((t) => a.includes(t)) && PLACE_TOKENS.some((t) => b.includes(t));
  if (bothPlace && sharedNum) sim = Math.max(sim, 0.8);
  return Math.min(1, sim);
}

const SEMANTIC_THRESHOLD = 0.6;

export function dedup(candidates: DedupCandidate[]): DedupResult {
  const kept: DedupCandidate[] = [];
  const removed: DedupResult["removed"] = [];

  // Sort by priority desc so the strongest expression is considered first.
  const ordered = [...candidates].sort((a, b) => b.priority - a.priority);

  for (const cand of ordered) {
    let duplicate: { of: DedupCandidate; reason: string } | null = null;

    for (const k of kept) {
      const exact = normalizeForCompare(cand.text) === normalizeForCompare(k.text);
      const sim = effectiveSimilarity(cand.text, k.text);

      const semanticallyEqual = exact || sim >= SEMANTIC_THRESHOLD;
      const sameRole = cand.role === k.role;

      if (semanticallyEqual && sameRole) {
        duplicate = {
          of: k,
          reason: exact ? "exact/normalized match" : `semantic match (${sim.toFixed(2)})`,
        };
        break;
      }
      // Semantically equal but different functional role => keep both.
    }

    if (duplicate) {
      removed.push({ candidate: cand, duplicateOf: duplicate.of.id, reason: duplicate.reason });
    } else {
      kept.push(cand);
    }
  }

  // Restore original ordering for kept items.
  const orderIndex = new Map(candidates.map((c, i) => [c.id, i]));
  kept.sort((a, b) => (orderIndex.get(a.id)! - orderIndex.get(b.id)!));

  return { kept, removed };
}
