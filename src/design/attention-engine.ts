import type { AttentionPlan, CardIntentResult, SourceOfTruth } from "../core/types.js";

/**
 * Attention Engine (PRD §9.7, DESIGN §3, SKILL §15).
 *
 * Exactly one Primary Anchor, at most three Secondary Anchors, everything
 * else is Supporting. This is what makes the "first glance" deterministic.
 */

export function buildAttentionPlan(intent: CardIntentResult, sot: SourceOfTruth): AttentionPlan {
  const primary = intent.primary_attention_anchor;
  const secondary = [...intent.secondary_attention_anchor];

  const supporting: string[] = [];

  // Everything factual that is not already an anchor becomes supporting.
  const anchorSet = new Set([primary, ...secondary]);

  for (const req of sot.submission_requirements) {
    if (!anchorSet.has(req.value)) supporting.push(req.value);
  }
  for (const rule of sot.rules) {
    if (!anchorSet.has(rule.value)) supporting.push(rule.value);
  }
  for (const edit of sot.ai_editable_sections) {
    supporting.push(edit.text);
  }

  return {
    primary_anchor: primary,
    secondary_anchors: secondary.slice(0, 3),
    supporting,
  };
}
