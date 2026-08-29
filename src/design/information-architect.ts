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
import { normalizeDatesInText } from "../normalize/date-normalizer.js";

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

function extractStateWord(text: string): string | undefined {
  for (const w of STATE_WORDS) if (text.includes(w)) return w;
  if (/开启|启动/.test(text)) return "已开启";
  if (/公布/.test(text)) return "已公布";
  return undefined;
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
      // Build vertical timeline nodes from dates + actions.
      const nodes = sot.dates.map((d, i) => ({
        date: d.value,
        task: sot.actions[i]?.action ?? sot.deadlines.find((dl) => dl.date === d.value)?.action ?? "赛程节点",
        status: i === 0 ? "current" : "upcoming",
      }));
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
  // otherwise, so emit them here rather than failing the card.
  const rewardTexts = sot.rewards
    .map((r) => normalizeDatesInText(r.value).text)
    .filter((v) => !represented.includes(v));
  const unrewarded = rewardTexts.filter(
    (v) => !body.some((b) => (b.content?.text ?? "").includes(v)),
  );
  if (unrewarded.length) {
    body.push(
      block(
        "note",
        2,
        { emoji: EMOJI_ANCHORS.reward, text: unrewarded.slice(0, 2).join(" / ") },
        sot.rewards.map((r) => r.id),
      ),
    );
  }

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
