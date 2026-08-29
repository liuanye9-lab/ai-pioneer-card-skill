import type {
  SourceOfTruth,
  FactField,
  DeadlineFact,
  ActionFact,
  LinkFact,
  RawInput,
  UncertainFact,
  EditableSection,
} from "../core/types.js";
import { makeId, stableHash } from "../core/errors.js";
import { normalizeDateToken, normalizeDatesInText } from "../normalize/date-normalizer.js";
import { upgradeBracketLabels } from "../normalize/emoji-preserver.js";

/**
 * Fact Parser (PRD §9.1, SPEC §4). Extracts a Source of Truth from raw copy.
 *
 * This is a deterministic, rule-based extractor. It errs on the side of
 * NOT inventing facts: anything it cannot confidently classify is preserved
 * in `uncertain_information` rather than guessed.
 */

// URL: stop at whitespace, CJK, full-width & ASCII punctuation so a URL never
// swallows the Chinese text that follows it (D2 — guards silent broken links).
const URL_REGEX = /https?:\/\/[^\s\u4e00-\u9fa5，。、；：！？（）【】「」""''）)】\]"'<>]+/g;
const TIME_REGEX = /(\d{1,2}[:：]\d{2}(?:\s*[-–—~至到]\s*\d{1,2}[:：]\d{2})?)/g;

// Activity / project name candidates. AI先锋大赛 must be preserved verbatim.
// A bounded latin prefix ([A-Za-z]{0,6}) plus non-greedy CJK means we capture
// "AI先锋大赛" out of "欢迎参加AI先锋大赛" without swallowing leading CJK, and
// without over-eating "…暨颁奖典礼大赛" (D4).
const ACTIVITY_NAME_PATTERNS = [
  /([A-Za-z]{0,6}先锋大赛)/,
  /(AI[\u4e00-\u9fa5A-Za-z0-9]{1,8}?大赛)/,
  /([A-Za-z]{0,6}[\u4e00-\u9fa5]{2,8}?大赛)/,
  /([A-Za-z]{0,6}[\u4e00-\u9fa5]{2,8}?训练营)/,
];

const DEADLINE_HINTS = ["截止", "截止时间", "deadline", "停止提交", "最后", "结束", "前提交", "前完成"];
const SUBMIT_HINTS = ["提交", "上交", "递交", "交作品", "上传"];
const TRAINING_HINTS = ["培训", "课程", "直播", "大班课", "专场", "训练营", "讲", "公开课", "系列课"];
const REWARD_HINTS = ["奖", "冠军", "亚军", "季军", "名额", "证书", "晋级"];
const LOCATION_HINTS = ["地点", "地址", "会议室", "线上", "线下", "飞书会议", "腾讯会议"];
const PEOPLE_HINTS = ["负责人", "老师", "讲师", "导师", "联系人", "同学", "评委"];

/** Fold full-width digits and colon to half-width so 全角日期/时间 normalize (D6). */
function foldFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\uFF1A/g, ":");
}

function splitSentences(copy: string): string[] {
  return copy
    .split(/[\n。！？；;!?]+|，(?=[^\d])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function detectActivityName(copy: string, brandName?: string): string | undefined {
  for (const pattern of ACTIVITY_NAME_PATTERNS) {
    const m = pattern.exec(copy);
    if (m && m[1]) {
      let name = m[1];
      // A brand name immediately preceding the match is part of the official
      // activity name: 象上汇先锋大赛 ≠ 先锋大赛. Never truncate the prefix.
      if (brandName && m.index >= brandName.length && !name.includes(brandName)) {
        const prefixStart = m.index - brandName.length;
        if (copy.slice(prefixStart, m.index) === brandName) {
          name = brandName + name;
        }
      }
      return name;
    }
  }
  return undefined;
}

/** Extract every date token with its raw span for traceability. */
function extractDates(copy: string): FactField[] {
  const fields: FactField[] = [];
  const seen = new Set<string>();

  // Numeric + CJK + ranges. Reuse the text normalizer to find tokens.
  const patterns: RegExp[] = [
    /(\d{1,2}[./-]\d{1,2}\s*[—\-~～至到]\s*\d{1,2}[./-]\d{1,2})/g,
    /(\d{1,2}月\d{1,2}[日号]?\s*[—\-~～至到]\s*\d{1,2}月\d{1,2}[日号]?)/g,
    /(\d{1,2}月\d{1,2}[日号]?)/g,
    /(?<![\d.])(\d{1,2}[./-]\d{1,2})(?![\d.])/g,
  ];

  // Compact 4-digit MMDD (0809) is only treated as a date when a date context
  // word is nearby — otherwise 会议室0301 / 分机1231 would be faked as dates (D5).
  const DATE_CONTEXT = /(日期|截止|开营|开赛|开始|开课|报名|提交|活动|大赛|deadline|截至|结束|举办|上线|发布)/;
  const compact = /(?<!\d)(\d{4})(?!\d)/g;
  let cm: RegExpExecArray | null;
  while ((cm = compact.exec(copy)) !== null) {
    const idx = cm.index;
    const around = copy.slice(Math.max(0, idx - 8), Math.min(copy.length, idx + cm[1].length + 8));
    if (DATE_CONTEXT.test(around)) {
      const norm = normalizeDateToken(cm[1]);
      if (norm && !seen.has(norm.normalized)) {
        seen.add(norm.normalized);
        const field: FactField = {
          id: makeId("date"),
          value: norm.normalized,
          source_text: cm[1],
          start: idx,
          end: idx + cm[1].length,
          locked: true,
        };
        if (norm.normalized !== cm[1]) field.normalization = norm;
        fields.push(field);
      }
    }
  }

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(copy)) !== null) {
      const raw = match[1];
      const norm = normalizeDateToken(raw);
      if (!norm) continue;
      if (seen.has(norm.normalized)) continue;
      seen.add(norm.normalized);
      const field: FactField = {
        id: makeId("date"),
        value: norm.normalized,
        source_text: raw,
        start: match.index,
        end: match.index + raw.length,
        locked: true,
      };
      if (norm.normalized !== raw) {
        field.normalization = norm;
      }
      fields.push(field);
    }
  }
  return fields;
}

function extractTimes(copy: string): FactField[] {
  const fields: FactField[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  TIME_REGEX.lastIndex = 0;
  while ((match = TIME_REGEX.exec(copy)) !== null) {
    const raw = match[1];
    const value = raw.replace(/：/g, ":");
    if (seen.has(value)) continue;
    seen.add(value);
    fields.push({
      id: makeId("time"),
      value,
      source_text: raw,
      start: match.index,
      end: match.index + raw.length,
      locked: true,
    });
  }
  return fields;
}

function extractLinks(copy: string, known: RawInput["knownLinks"]): LinkFact[] {
  const links: LinkFact[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(copy)) !== null) {
    const url = match[0].replace(/[.,，。]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      id: makeId("link"),
      value: url,
      url,
      source_text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      locked: true,
      type: inferLinkType(copy, url),
    });
  }

  for (const k of known ?? []) {
    if (seen.has(k.url)) continue;
    seen.add(k.url);
    links.push({
      id: makeId("link"),
      value: k.url,
      url: k.url,
      source_text: k.label ?? k.url,
      locked: true,
      type: k.type ?? "external",
    });
  }
  return links;
}

function inferLinkType(copy: string, url: string): string {
  const idx = copy.indexOf(url);
  const around = copy.slice(Math.max(0, idx - 12), idx);
  if (/提交|作品|上传/.test(around)) return "submission";
  if (/报名|注册/.test(around)) return "registration";
  if (/规则|说明|文档/.test(around)) return "doc";
  if (/日历|课程表|排期/.test(around)) return "calendar";
  if (/会议|直播/.test(around)) return "meeting";
  return "external";
}

function extractDeadlines(
  sentences: string[],
): { deadlines: DeadlineFact[]; uncertain: string[] } {
  const deadlines: DeadlineFact[] = [];
  const uncertain: string[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (!DEADLINE_HINTS.some((h) => sentence.includes(h))) continue;
    const { normalizations } = normalizeDatesInText(sentence);
    // Only use a date parsed from THIS sentence — never borrow a global date,
    // otherwise an unrelated 开营日 gets faked as the deadline (D3).
    const date = normalizations[0]?.normalized;
    if (!date) {
      uncertain.push(`存在截止类表述但该句未给出明确日期：「${sentence}」，未推断截止日。`);
      continue;
    }
    const action = SUBMIT_HINTS.some((h) => sentence.includes(h)) ? "作品提交" : undefined;
    const key = `${date}|${action ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deadlines.push({
      id: makeId("deadline"),
      value: `${date}截止`,
      date,
      action,
      source_text: sentence,
      locked: true,
    });
  }
  return { deadlines, uncertain };
}

function extractActions(sentences: string[], links: LinkFact[]): ActionFact[] {
  const actions: ActionFact[] = [];
  const seen = new Set<string>();

  const submissionLink = links.find((l) => l.type === "submission");

  for (const sentence of sentences) {
    let action: string | undefined;
    if (SUBMIT_HINTS.some((h) => sentence.includes(h))) action = "提交作品";
    else if (/报名|注册/.test(sentence)) action = "立即报名";
    else if (/预约|参加|加入/.test(sentence) && TRAINING_HINTS.some((h) => sentence.includes(h)))
      action = "预约直播";
    else if (/查看|了解/.test(sentence) && /规则/.test(sentence)) action = "查看规则";
    else if (/查看|了解/.test(sentence) && /案例/.test(sentence)) action = "查看案例";

    if (!action || seen.has(action)) continue;
    seen.add(action);
    actions.push({
      id: makeId("action"),
      value: action,
      action,
      source_text: sentence,
      locked: false,
      target_url: action === "提交作品" ? submissionLink?.url : undefined,
    });
  }
  return actions;
}

function extractByHints(sentences: string[], hints: string[], locked: boolean): FactField[] {
  const fields: FactField[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    if (!hints.some((h) => sentence.includes(h))) continue;
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    fields.push({ id: makeId("fact"), value: sentence, source_text: sentence, locked });
  }
  return fields;
}

export function parseSourceOfTruth(input: RawInput): SourceOfTruth {
  // Fold full-width digits/colon up front so 全角日期(８月９日)/时间(１５：００)
  // are extracted & normalized like their half-width forms (D6). Bracketed
  // emoji labels ([喇叭]/【喇叭】) upgrade to real emoji at the source so every
  // downstream fact (incl. locked rewards) carries 📣, never "[喇叭]".
  const copy = upgradeBracketLabels(foldFullWidth(input.copy));
  const sentences = splitSentences(copy);

  const activity_name = detectActivityName(copy, input.brandName);
  const dates = extractDates(copy);
  const times = extractTimes(copy);
  const links = extractLinks(copy, input.knownLinks);
  const { deadlines, uncertain: deadlineUncertain } = extractDeadlines(sentences);
  const actions = extractActions(sentences, links);

  const submission_requirements = extractByHints(sentences, ["要求", "格式", "字数", "不少于", "包含"], true).filter(
    (f) => /提交|作品|格式|要求/.test(f.value),
  );
  const rules = extractByHints(sentences, ["规则", "规定", "评审", "评分", "标准"], true);
  const rewards = extractByHints(sentences, REWARD_HINTS, true);
  const locations = extractByHints(sentences, LOCATION_HINTS, true);
  const people = extractByHints(sentences, PEOPLE_HINTS, true);
  const status = extractByHints(sentences, ["进行中", "已开始", "已结束", "报名中", "开启", "启动"], false);

  const brand_entities: FactField[] = [];
  if (input.brandName) {
    brand_entities.push({
      id: makeId("brand"),
      value: input.brandName,
      source_text: input.brandName,
      locked: true,
    });
  }

  // AI-editable sections: sentences that are pure encouragement / filler.
  const ai_editable_sections: EditableSection[] = [];
  for (const sentence of sentences) {
    if (/记得|不要错过|尽快|加油|欢迎|快来|一起/.test(sentence)) {
      ai_editable_sections.push({ id: makeId("edit"), text: sentence, role: "supporting" });
    }
  }

  // Uncertain: sentences mentioning a year (we must not add/modify) or vague times.
  const uncertain_information: UncertainFact[] = [];
  for (const note of deadlineUncertain) {
    uncertain_information.push({ id: makeId("uncertain"), note });
  }
  if (/\d{4}\s*年/.test(copy) === false && /今年|明年|下周|下个月/.test(copy)) {
    uncertain_information.push({
      id: makeId("uncertain"),
      note: "文案包含相对时间（如“下周/下个月”），未提供可信当前日期，不做推断。",
    });
  }

  return {
    project_name: activity_name,
    activity_name,
    card_purpose: input.userInstruction,
    dates,
    times,
    deadlines,
    locations,
    people,
    actions,
    links,
    submission_requirements,
    rules,
    rewards,
    status,
    brand_entities,
    ai_editable_sections,
    uncertain_information,
    raw_copy_hash: stableHash(copy),
  };
}
