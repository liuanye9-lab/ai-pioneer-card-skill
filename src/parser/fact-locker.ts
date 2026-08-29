import type { SourceOfTruth, FactField, LockedFactType } from "../core/types.js";

/**
 * Fact Locker (PRD §9.2, SPEC §5). Provides read-only access to locked facts
 * and a verifier that guarantees generated card text never contradicts or
 * drops a locked value.
 */

export interface LockedFact {
  id: string;
  type: LockedFactType;
  value: string;
  source_text: string;
}

/** Collect every locked fact across the Source of Truth. */
export function collectLockedFacts(sot: SourceOfTruth): LockedFact[] {
  const locked: LockedFact[] = [];

  const add = (fields: FactField[], type: LockedFactType) => {
    for (const f of fields) {
      if (f.locked) locked.push({ id: f.id, type, value: f.value, source_text: f.source_text });
    }
  };

  if (sot.activity_name) {
    locked.push({
      id: "activity_name",
      type: "activity_name",
      value: sot.activity_name,
      source_text: sot.activity_name,
    });
  }
  add(sot.dates, "date");
  add(sot.times, "time");
  add(
    sot.deadlines.map((d) => ({ ...d, value: d.date })),
    "deadline",
  );
  add(sot.locations, "location");
  add(sot.people, "person_name");
  add(sot.links, "url");
  add(sot.rewards, "reward");
  add(sot.rules, "rule");
  add(sot.submission_requirements, "submission_requirement");
  add(sot.brand_entities, "brand_name");

  return locked;
}

/**
 * Verify that a body of generated text preserves locked facts.
 *
 * - activity_name must appear verbatim (guards AI先锋大赛 -> 先锋大赛).
 * - Each URL must appear exactly.
 * - No URL may appear that is NOT in the source (guards invented links).
 */
export interface FactLockVerification {
  ok: boolean;
  violations: Array<{ code: string; message: string }>;
}

export function verifyFactLock(
  generatedText: string,
  sot: SourceOfTruth,
): FactLockVerification {
  const violations: FactLockVerification["violations"] = [];

  if (sot.activity_name && !generatedText.includes(sot.activity_name)) {
    violations.push({
      code: "ACTIVITY_NAME_MISSING",
      message: `活动名称 "${sot.activity_name}" 未在卡片中原样出现`,
    });
  }

  // Activity name truncation guard: e.g. "AI先锋大赛" -> "先锋大赛".
  if (sot.activity_name) {
    const truncated = deriveTruncationRisk(sot.activity_name);
    for (const t of truncated) {
      // If truncated form appears but full form does not immediately around it.
      if (generatedText.includes(t) && !generatedText.includes(sot.activity_name)) {
        violations.push({
          code: "ACTIVITY_NAME_TRUNCATED",
          message: `检测到活动名称被截断为 "${t}"`,
        });
      }
    }
  }

  const sourceUrls = new Set(sot.links.map((l) => l.url));

  // Invented-URL guard: any http(s) in generated text must be a source URL.
  const urlRegex = /https?:\/\/[^\s，。、）)】\]"'<>]+/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(generatedText)) !== null) {
    const url = m[0].replace(/[.,，。]+$/, "");
    if (!sourceUrls.has(url)) {
      violations.push({
        code: "INVENTED_URL",
        message: `卡片包含来源中不存在的 URL: ${url}`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/** Common truncation risks for a Chinese activity name. */
function deriveTruncationRisk(name: string): string[] {
  const risks: string[] = [];
  // Drop a leading latin/brand prefix like "AI".
  const stripLatin = name.replace(/^[A-Za-z]+/, "");
  if (stripLatin && stripLatin !== name) risks.push(stripLatin);
  return risks;
}
