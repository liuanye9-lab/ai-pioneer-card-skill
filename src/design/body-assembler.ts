import type { AttentionPlan, ContentBlock, SourceOfTruth } from "../core/types.js";
import { makeId } from "../core/errors.js";
import { dedup, type DedupCandidate } from "../dedup/semantic-deduper.js";
import { EMOJI_ANCHORS } from "../core/constants.js";
import { normalizeDatesInText, stripInlineUrls } from "../normalize/date-normalizer.js";
import { containsEmoji } from "../normalize/emoji-preserver.js";

/**
 * Assemble supporting body copy with semantic dedup applied against the
 * primary anchor so we never repeat the deadline / task the header already
 * carries (PRD §9.5 / §9.9 density control).
 */
export function assembleDedupedBody(
  sot: SourceOfTruth,
  attention: AttentionPlan,
  primaryAnchor: ContentBlock,
): ContentBlock[] {
  const anchorText = [
    primaryAnchor.content?.title,
    primaryAnchor.content?.subtitle,
    attention.primary_anchor,
    ...attention.secondary_anchors,
  ]
    .filter(Boolean)
    .join(" ");

  const candidates: DedupCandidate[] = [];
  // The anchor is a fixed high-priority reference the body must not duplicate.
  candidates.push({ id: "anchor", text: anchorText, role: "header", priority: 100 });

  for (const edit of sot.ai_editable_sections) {
    candidates.push({
      id: edit.id,
      text: edit.text,
      role: "body",
      priority: 20,
    });
  }

  const { kept } = dedup(candidates);

  const blocks: ContentBlock[] = [];
  for (const k of kept) {
    if (k.id === "anchor") continue;
    // Normalize dates AND strip any inline URL (links live on buttons, never in
    // body text) so an editable sentence like "记得提交 https://…" doesn't leak.
    const text = stripInlineUrls(normalizeDatesInText(k.text).text);
    if (!text) continue; // sentence was only a URL → nothing left to show
    // Only add a scanning-anchor emoji when the line has none of its own,
    // so we never double up (e.g. "📣 📣 ...").
    const emoji = containsEmoji(text) ? undefined : EMOJI_ANCHORS.announcement;
    blocks.push({
      id: makeId("block"),
      type: "note",
      priority: 3,
      content: { emoji, text },
      sourceFactIds: [k.id],
    });
  }
  // Density cap: at most 2 supporting notes on the card body.
  return blocks.slice(0, 2);
}
