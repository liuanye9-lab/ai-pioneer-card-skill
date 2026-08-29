import type { StyleProfile } from "../core/types.js";
import { DEFAULT_STYLE } from "./default-style.js";
import { loadCachedBrandStyle } from "./style-cache.js";

/**
 * Style Resolver (PRD §9.12-9.13, SPEC §23, SKILL §24).
 *
 * Resolution order:
 *   1. Brand provided + cached style.md exists  -> reuse cached brand style.
 *   2. Brand provided but not cached            -> return default + flag
 *      that research is required (we never guess a brand's palette).
 *   3. No brand                                 -> AI先锋大赛 default style.
 */

export interface StyleResolution {
  style: StyleProfile;
  researchRequired: boolean;
  note: string;
}

export function resolveStyle(opts: {
  brandName?: string;
  brandsDir: string;
}): StyleResolution {
  if (!opts.brandName) {
    return {
      style: DEFAULT_STYLE,
      researchRequired: false,
      note: "无品牌约束，使用 AI先锋大赛默认视觉（Premium AI × Feishu Native × iOS Editorial）。",
    };
  }

  const cached = loadCachedBrandStyle(opts.brandsDir, opts.brandName);
  if (cached) {
    return {
      style: cached,
      researchRequired: false,
      note: `复用已缓存品牌视觉：${cached.brandIdentity}`,
    };
  }

  // Brand given but not cached: do NOT guess. Use default, flag for research.
  return {
    style: {
      ...DEFAULT_STYLE,
      brandIdentity: `${opts.brandName}（未缓存，暂用默认视觉）`,
    },
    researchRequired: true,
    note: `品牌 "${opts.brandName}" 未在 brands/ 缓存，禁止凭名称猜风格；已回退默认视觉，建议先做官方调研并生成 style.md。`,
  };
}
