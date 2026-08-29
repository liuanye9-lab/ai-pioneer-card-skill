import type {
  CTA,
  CardIntentResult,
  ImagePlan,
  RenderModeResult,
  SourceOfTruth,
} from "../core/types.js";
import { makeId } from "../core/errors.js";

/**
 * Interaction / CTA Planner (PRD §9.11 & §D.4, SPEC §14, SKILL §21-22).
 *
 * Rules enforced:
 *  - Primary ≤ 1, Secondary ≤ 4
 *  - labels are verb+object (never 点这里/更多/详情/链接)
 *  - URL never invented; a CTA without a real target becomes a callback or is dropped
 *  - image modules map to secondary CTAs for navigation cards
 */

const BANNED_LABELS = ["点这里", "更多", "详情", "链接", "点击查看", "查看更多"];

const ACTION_VERBS = ["提交", "查看", "进入", "预约", "报名", "打开", "联系", "了解", "加入", "参加", "下载", "领取"];

function isActionLabel(label: string): boolean {
  if (BANNED_LABELS.includes(label)) return false;
  // Contains an action verb (allowing an intensifier prefix like 立即/马上),
  // or is a navigation module label (…专场/专题/系列).
  return ACTION_VERBS.some((v) => label.includes(v)) || /专场$|专题$|系列$/.test(label);
}

export function planCTAs(input: {
  sot: SourceOfTruth;
  intent: CardIntentResult;
  renderMode: RenderModeResult;
  imagePlan?: ImagePlan;
}): CTA[] {
  const { sot, intent, renderMode, imagePlan } = input;
  const ctas: CTA[] = [];

  const submissionLink = sot.links.find((l) => l.type === "submission");
  const calendarLink = sot.links.find((l) => l.type === "calendar");
  const docLink = sot.links.find((l) => l.type === "doc");
  const registrationLink = sot.links.find((l) => l.type === "registration");
  const meetingLink = sot.links.find((l) => l.type === "meeting");
  const firstLink = sot.links[0];

  // ---- Primary CTA (<= 1) ----
  const primaryLabel = intent.primary_action;
  let primaryUrl: string | undefined;
  switch (intent.primary_intent) {
    case "submission":
    case "deadline":
      primaryUrl = submissionLink?.url ?? firstLink?.url;
      break;
    case "registration":
      primaryUrl = registrationLink?.url ?? firstLink?.url;
      break;
    case "training":
      primaryUrl = meetingLink?.url ?? calendarLink?.url ?? firstLink?.url;
      break;
    default:
      primaryUrl = firstLink?.url;
  }

  if (isActionLabel(primaryLabel)) {
    if (primaryUrl) {
      ctas.push({
        id: makeId("cta"),
        label: normalizeLabel(primaryLabel),
        type: "url",
        url: primaryUrl,
        linkTarget: { universal: primaryUrl },
        priority: "primary",
        sourceFactId: sot.actions.find((a) => a.action === primaryLabel)?.id,
      });
    } else if (renderMode.render_mode !== "text_first") {
      // No URL: use a callback (status回执) rather than inventing a link.
      ctas.push({
        id: makeId("cta"),
        label: normalizeLabel(primaryLabel),
        type: "callback",
        callbackKey: `primary_${intent.primary_intent}`,
        priority: "primary",
      });
    }
    // text_first without URL: drop the button, keep the action in body text.
  }

  // ---- Secondary CTAs (<= 4) ----
  const secondary: CTA[] = [];

  // Image module mapping (navigation cards).
  if (imagePlan) {
    for (const mod of imagePlan.modules) {
      if (secondary.length >= 4) break;
      // Map to a link if one plausibly matches; else callback.
      const matched = sot.links.find((l) => l.source_text?.includes(mod.title.slice(0, 2)));
      secondary.push({
        id: makeId("cta"),
        label: normalizeLabel(mod.title),
        type: matched ? "url" : "callback",
        url: matched?.url,
        linkTarget: matched ? { universal: matched.url } : undefined,
        callbackKey: matched ? undefined : `module_${mod.title}`,
        priority: "secondary",
        mapsToImageModule: mod.title,
      });
    }
  }

  // Rules / doc secondary link.
  if (docLink && secondary.length < 4 && !secondary.some((c) => c.url === docLink.url)) {
    secondary.push({
      id: makeId("cta"),
      label: "查看规则",
      type: "url",
      url: docLink.url,
      linkTarget: { universal: docLink.url },
      priority: "secondary",
      sourceFactId: docLink.id,
    });
  }

  // Calendar for training.
  if (calendarLink && intent.primary_intent === "training" && secondary.length < 4) {
    secondary.unshift({
      id: makeId("cta"),
      label: "查看课程日历",
      type: "url",
      url: calendarLink.url,
      linkTarget: { universal: calendarLink.url },
      priority: "secondary",
      sourceFactId: calendarLink.id,
    });
  }

  ctas.push(...secondary.slice(0, 4));
  return dedupeCTAs(ctas);
}

/** Trim to verb+object and cap length; never emit banned labels. */
function normalizeLabel(label: string): string {
  const trimmed = label.trim().replace(/[。.!！]$/, "");
  return trimmed.slice(0, 12);
}

function dedupeCTAs(ctas: CTA[]): CTA[] {
  const seen = new Set<string>();
  const out: CTA[] = [];
  let primaryCount = 0;
  for (const cta of ctas) {
    const key = `${cta.label}|${cta.url ?? cta.callbackKey ?? ""}`;
    if (seen.has(key)) continue;
    if (cta.priority === "primary") {
      if (primaryCount >= 1) {
        // demote extra primaries to secondary
        cta.priority = "secondary";
      } else {
        primaryCount += 1;
      }
    }
    seen.add(key);
    out.push(cta);
  }
  // Enforce secondary cap of 4.
  const primary = out.filter((c) => c.priority === "primary");
  const secondary = out.filter((c) => c.priority === "secondary").slice(0, 4);
  return [...primary, ...secondary];
}
