import type {
  AttentionPlan,
  CardIntentResult,
  CardStructure,
  ContentBlock,
  HeaderBlock,
  RenderModeResult,
  SourceOfTruth,
  StyleProfile,
} from "../core/types.js";
import { makeId } from "../core/errors.js";
import { EMOJI_ANCHORS } from "../core/constants.js";
import { assembleDedupedBody } from "./body-assembler.js";
import { normalizeDatesInText, stripInlineUrls } from "../normalize/date-normalizer.js";

/**
 * Information Architect (PRD §9.8, DESIGN §18-22, SKILL §16-20).
 *
 * Reorganizes locked facts into an intent-specific information architecture.
 * Density is controlled here: each content block is 1-3 lines; long content
 * is delegated to buttons / progressive disclosure rather than walls of text.
 */

export interface IAInput {
  sot: SourceOfTruth;
  intent: CardIntentResult;
  renderMode: RenderModeResult;
  attention: AttentionPlan;
  style: StyleProfile;
}

function buildHeader(sot: SourceOfTruth, style: StyleProfile): HeaderBlock {
  let badge: string | undefined;
  if (sot.deadlines[0]) {
    badge = `${sot.deadlines[0].date} 截止`;
  } else if (sot.status[0]) {
    // Derive a short state keyword; never slice a raw sentence (would leak
    // un-normalized dates like "8.20 报").
    const stateWord = extractStateWord(sot.status[0].value);
    badge = stateWord;
  }

  return {
    logo: style.isBrandResolved ? style.slug : undefined,
    activityName: sot.activity_name ?? "活动通知",
    badge,
    subtitle: undefined,
  };
}

const STATE_WORDS = ["进行中", "报名中", "已开始", "已结束", "已启动", "已开启", "已就位", "已公布"];

/**
 * Split a reward sentence into distinct meaning-units so a prize and a
 * certificate never share one line (anti wall-of-text). Splits on CJK/ASCII
 * separators but keeps each clause whole.
 */
function splitRewardClauses(text: string): string[] {
  return text
    .split(/[，,；;、]|\s+且\s+|\s+和\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function extractStateWord(text: string): string | undefined {
  for (const w of STATE_WORDS) if (text.includes(w)) return w;
  if (/开启|启动/.test(text)) return "已开启";
  if (/公布/.test(text)) return "已公布";
  return undefined;
}

/**
 * Build vertical timeline nodes so the card answers 什么时候该干什么/开始/截止:
 *  - task: matched to each date by source-text proximity (not blind index), so
 *    later nodes don't degrade to a generic placeholder.
 *  - status: computed against today (done/current/upcoming), so "现在该干什么"
 *    is correct instead of always highlighting the first node.
 *  - deadline node: labeled 截止 so the renderer can emphasize it (bold + color).
 */
function buildTimelineNodes(sot: SourceOfTruth): Array<{ date: string; task: string; status: string }> {
  const now = new Date();
  const y = now.getFullYear();
  const toDate = (v: string): Date | null => {
    const m = v.match(/(\d{1,2})月(\d{1,2})日/);
    return m ? new Date(y, Number(m[1]) - 1, Number(m[2])) : null;
  };
  // Match an action to a date when they came from the same sentence/nearby span.
  const actionFor = (dateField: (typeof sot.dates)[number]): string | undefined => {
    const byProximity = sot.actions
      .map((a) => ({ a, dist: Math.abs((a.start ?? -999) - (dateField.start ?? 999)) }))
      .filter((x) => x.dist < 40)
      .sort((p, q) => p.dist - q.dist)[0];
    if (byProximity) return byProximity.a.action;
    return sot.deadlines.find((dl) => dl.date === dateField.value)?.action;
  };

  const dated = sot.dates.map((d) => ({ field: d, when: toDate(d.value) }));
  // Determine the current node = earliest date that is today or future.
  const futureIdx = dated.findIndex((x) => x.when && x.when.getTime() >= new Date(y, now.getMonth(), now.getDate()).getTime());

  return dated.map((x, i) => {
    const isDeadline = sot.deadlines.some((dl) => dl.date === x.field.value);
    const task = isDeadline ? "截止" : actionFor(x.field) ?? (i === 0 ? "开始" : "赛程节点");
    let status: string;
    if (x.when) {
      status = i === futureIdx ? "current" : x.when.getTime() < new Date(y, now.getMonth(), now.getDate()).getTime() ? "done" : "upcoming";
    } else {
      status = i === 0 ? "current" : "upcoming";
    }
    return { date: x.field.value, task, status };
  });
}

function block(
  type: ContentBlock["type"],
  priority: ContentBlock["priority"],
  content: any,
  sourceFactIds?: string[],
): ContentBlock {
  return { id: makeId("block"), type, priority, content, sourceFactIds };
}

export function buildInformationArchitecture(input: IAInput): CardStructure {
  const { sot, intent, attention, style } = input;
  const header = buildHeader(sot, style);

  let primaryAnchor: ContentBlock;
  const body: ContentBlock[] = [];
  const footer: ContentBlock[] = [];

  switch (intent.primary_intent) {
    case "deadline":
    case "submission": {
      const deadline = sot.deadlines[0];
      const dateText = deadline?.date ?? sot.dates[0]?.value ?? "";
      primaryAnchor = block(
        "text",
        1,
        {
          role: "primary_anchor",
          emoji: EMOJI_ANCHORS.deadline,
          title: dateText ? `${dateText} 截止` : attention.primary_anchor,
          subtitle: deadline?.action ?? sot.actions[0]?.action ?? "作品提交",
        },
        deadline ? [deadline.id] : [],
      );
      // Submission subject
      if (sot.actions[0]) {
        body.push(
          block("text", 2, {
            emoji: EMOJI_ANCHORS.submission,
            text: `${sot.actions[0].action}`,
          }, [sot.actions[0].id]),
        );
      }
      // Requirements (kept short)
      for (const req of sot.submission_requirements.slice(0, 2)) {
        body.push(block("note", 3, { emoji: EMOJI_ANCHORS.tip, text: req.value }, [req.id]));
      }
      break;
    }

    case "timeline": {
      primaryAnchor = block("text", 1, {
        role: "primary_anchor",
        emoji: EMOJI_ANCHORS.date,
        title: attention.primary_anchor,
        subtitle: intent.primary_action,
      });
      const nodes = buildTimelineNodes(sot);
      body.push(block("timeline", 2, { nodes }, sot.dates.map((d) => d.id)));
      break;
    }

    case "training": {
      primaryAnchor = block("text", 1, {
        role: "primary_anchor",
        emoji: EMOJI_ANCHORS.training,
        title: attention.primary_anchor,
        subtitle: intent.primary_action,
      });
      // Sessions as columns/notes
      for (const t of sot.times.slice(0, 3)) {
        body.push(block("text", 2, { emoji: EMOJI_ANCHORS.date, text: t.value }, [t.id]));
      }
      break;
    }

    case "case_showcase": {
      primaryAnchor = block("text", 1, {
        role: "primary_anchor",
        emoji: EMOJI_ANCHORS.tip,
        title: attention.primary_anchor,
        subtitle: "值得参考的实战拆解",
      });
      break;
    }

    case "result":
    case "award": {
      primaryAnchor = block("text", 1, {
        role: "primary_anchor",
        emoji: EMOJI_ANCHORS.reward,
        title: attention.primary_anchor,
        subtitle: intent.primary_question,
      });
      for (const r of sot.rewards.slice(0, 3)) {
        body.push(block("text", 2, { emoji: EMOJI_ANCHORS.reward, text: r.value }, [r.id]));
      }
      break;
    }

    default: {
      primaryAnchor = block("text", 1, {
        role: "primary_anchor",
        emoji: EMOJI_ANCHORS.announcement,
        title: attention.primary_anchor,
        subtitle: intent.primary_question,
      });
    }
  }

  // Deduped supporting copy (from AI-editable sections) — density-capped.
  const supportingBlocks = assembleDedupedBody(sot, attention, primaryAnchor);
  body.push(...supportingBlocks);

  // Guarantee critical dates/times are natively present (never image-only).
  // Collect text already represented in the anchor + body.
  const represented = [
    primaryAnchor.content?.title,
    primaryAnchor.content?.subtitle,
    ...body.map((b) => b.content?.text ?? ""),
    ...body.flatMap((b) => (b.content?.nodes ?? []).map((n: any) => `${n.date} ${n.task}`)),
  ]
    .filter(Boolean)
    .join(" ");

  const missingDates = sot.dates
    .map((d) => d.value)
    .filter((v) => !represented.includes(v));
  const missingTimes = sot.times.map((t) => t.value).filter((v) => !represented.includes(v));

  if (missingDates.length || missingTimes.length) {
    const parts: string[] = [];
    if (missingDates.length) parts.push(missingDates.join("、"));
    if (missingTimes.length) parts.push(missingTimes.join("、"));
    body.push(
      block(
        "text",
        2,
        { emoji: EMOJI_ANCHORS.date, text: parts.join(" · ") },
        [...sot.dates.map((d) => d.id), ...sot.times.map((t) => t.id)],
      ),
    );
  }

  // Guarantee rewards survive natively (D1): an intent branch that does not
  // render rewards (e.g. submission) must still carry them — QA hard-fails
  // otherwise, so emit them here rather than failing the card. Each reward is
  // its OWN emoji-prefixed line (never join multiple facts into a wall), and any
  // inline URL is stripped (it lives on a button, not jammed into body text).
  const rewardTexts = sot.rewards
    .flatMap((r) => splitRewardClauses(stripInlineUrls(normalizeDatesInText(r.value).text)))
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && !represented.includes(v));
  // Dedup identical clauses while preserving order.
  const seenReward = new Set<string>();
  const uniqueRewards = rewardTexts.filter((v) => (seenReward.has(v) ? false : seenReward.add(v)));
  const unrewarded = uniqueRewards.filter(
    (v) => !body.some((b) => (b.content?.text ?? "").includes(v)),
  );
  // Reward vs certificate/participation are distinct meanings → separate lines.
  unrewarded.slice(0, 3).forEach((text, i) => {
    const emoji = /证书|证明|结业|凭证/.test(text)
      ? "🎖️"
      : i === 0
        ? EMOJI_ANCHORS.reward
        : "✅";
    body.push(block("note", 2, { emoji, text }, sot.rewards.map((r) => r.id)));
  });

  // Footer: uncertain info as a soft note (never as fact).
  if (sot.uncertain_information.length > 0) {
    footer.push(
      block("note", 3, {
        text: sot.uncertain_information.map((u) => u.note).join(" / "),
        muted: true,
      }),
    );
  }

  return {
    header,
    primaryAnchor,
    body,
    ctas: [],
    footer,
  };
}
