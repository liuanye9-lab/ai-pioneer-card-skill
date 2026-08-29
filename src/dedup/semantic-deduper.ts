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

function normalizeForCompare(text: string): string {
  const { text: dateNorm } = normalizeDatesInText(text);
  return dateNorm
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

/**
 * Effective similarity used for dedup: base Jaccard, boosted when two lines
 * share an identical normalized date AND an overlapping action verb (the
 * classic "same deadline, reworded" case). Distinct dates are never boosted.
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
