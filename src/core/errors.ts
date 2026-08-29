/**
 * Unified error taxonomy (SPEC §25) plus small helpers.
 */

export type SkillErrorCode =
  | "FACT_CONFLICT"
  | "MISSING_REQUIRED_FACT"
  | "INVALID_URL"
  | "INVALID_CARD_SCHEMA"
  | "FEISHU_AUTH_ERROR"
  | "FEISHU_PERMISSION_ERROR"
  | "IMAGE_GENERATION_ERROR"
  | "CALLBACK_ERROR"
  | "BRAND_RESEARCH_ERROR";

export class SkillError extends Error {
  code: SkillErrorCode;
  details?: unknown;

  constructor(code: SkillErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "SkillError";
    this.code = code;
    this.details = details;
  }
}

/** Stable short hash (djb2) — no crypto dependency, used for raw_copy_hash. */
export function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 to get unsigned, then hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

let idCounter = 0;
/** Deterministic-ish id generator scoped per prefix. */
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}
