import type {
  ImageIntentResult,
  ImagePlan,
  ImageModule,
  RenderModeResult,
  SourceOfTruth,
  StyleProfile,
  CardIntentResult,
  ImageAssetVariant,
} from "../core/types.js";
import { IMAGE_MAX_MODULES, IMAGE_MAX_TEXT_LINES } from "../core/constants.js";

/**
 * Image Planner (PRD v1.1 §D, SPEC §12, DESIGN §5-7).
 *
 * Produces an ImagePlan only when the render mode needs an image. Enforces:
 *  - precise facts / URLs are NOT baked into the image (kept in native text)
 *  - information images prefer taller ratios for mobile readability
 *  - Chinese text is rendered natively when a text-image model is unreliable
 */

export interface ImagePlanInput {
  sot: SourceOfTruth;
  intent: CardIntentResult;
  imageIntent: ImageIntentResult;
  renderMode: RenderModeResult;
  style: StyleProfile;
  /** Raw copy, so module topics come from the sentence a fact lives in. */
  rawCopy: string;
}

/** Split into sentences the same way the fact parser does. */
function splitSentences(copy: string): string[] {
  return copy
    .split(/[\n。！？；;!?]+|，(?=[^\d])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Build modules from the source of truth (series / sessions / scenes). */
function deriveModules(sot: SourceOfTruth, contextSentences: string[]): ImageModule[] {
  const modules: ImageModule[] = [];

  // Training sessions: pair times with the topic words of the sentence the
  // time actually occurs in. A bare time with no topic produces NO module —
  // fabricating a title like "课程" leaks an unrelated CTA onto unrelated cards.
  for (const t of sot.times) {
    const sentence = contextSentences.find((s) => s.includes(t.source_text)) ?? "";
    const topic = sentence.match(/([\u4e00-\u9fa5]{2,8}(?:系列|专场|大班课|专题|课))/)?.[1];
    if (!topic) continue;
    modules.push({ title: topic, key_points: [t.value] });
  }

  // Scene navigation modules.
  const scenes = ["财务", "销售", "客服", "人力", "市场", "运营"];
  for (const scene of scenes) {
    if (contextSentences.some((s) => s.includes(scene))) {
      const existing = modules.find((m) => m.title.includes(scene));
      if (!existing) modules.push({ title: `${scene}专场`, key_points: [] });
    }
  }

  return modules;
}

/** Critical facts that must be repeated as native card text (DESIGN §6). */
function criticalFacts(sot: SourceOfTruth): string[] {
  const facts: string[] = [];
  // Precise, image-unsafe facts only: deadlines, dates, times.
  // (Action verbs become CTAs / the anchor subtitle, handled elsewhere.)
  for (const d of sot.deadlines) facts.push(`${d.date}截止`);
  for (const d of sot.dates.slice(0, 3)) facts.push(d.value);
  for (const t of sot.times.slice(0, 2)) facts.push(t.value);
  return Array.from(new Set(facts));
}

function pickAspectRatio(role: string, moduleCount: number): string {
  if (role === "hero_summary") return "16:9";
  // Information-rich: taller for mobile readability.
  if (moduleCount >= 3) return "3:4";
  return "4:3";
}

export function buildImagePlan(input: ImagePlanInput): ImagePlan | undefined {
  const { sot, intent, imageIntent, renderMode, style } = input;
  if (!renderMode.image_required && imageIntent.image_mode !== "recommended") {
    return undefined;
  }
  if (imageIntent.image_role === "none") return undefined;

  const contextSentences = splitSentences(input.rawCopy);

  const modules = deriveModules(sot, contextSentences).slice(0, IMAGE_MAX_MODULES + 2);
  const heroTitle = deriveHeroTitle(intent, sot);
  const heroSubtitle = deriveHeroSubtitle(intent, sot);

  const aspect = pickAspectRatio(imageIntent.image_role, modules.length);

  // Mobile readability heuristic (SPEC §39). If overloaded, we do NOT keep a
  // dense image — we cap modules and push text to native components.
  const estimatedTextLines =
    modules.reduce((acc, m) => acc + 1 + m.key_points.length, 0) + (heroSubtitle ? 1 : 0);
  const overloaded =
    modules.length > IMAGE_MAX_MODULES || estimatedTextLines > IMAGE_MAX_TEXT_LINES;

  const cappedModules = overloaded ? modules.slice(0, IMAGE_MAX_MODULES) : modules;
  const mobileReadable = !overloaded;

  // Text reliability: default to native-text fallback (safest for Chinese).
  const nativeTextFallback = true;

  const variants: ImageAssetVariant[] = [
    {
      usage: "mobile",
      aspectRatio: imageIntent.image_role === "hero_summary" ? "4:3" : aspect,
      minReadableTextSizePx: 28,
      containsCriticalText: false,
      cropSafe: true,
    },
    {
      usage: "desktop",
      aspectRatio: imageIntent.image_role === "hero_summary" ? "16:9" : "4:3",
      containsCriticalText: false,
      cropSafe: true,
    },
  ];

  const facts = criticalFacts(sot);

  return {
    role: imageIntent.image_role,
    aspect_ratio: aspect,
    safe_text_zones: [{ x: 0.06, y: 0.72, w: 0.88, h: 0.22 }],
    hero_title: heroTitle,
    hero_subtitle: heroSubtitle,
    modules: cappedModules,
    critical_facts_repeated_in_card: facts,
    prompt: buildPrompt(style, intent, imageIntent.image_role, heroTitle, heroSubtitle, cappedModules, aspect, nativeTextFallback),
    negative_prompt:
      "no cyberpunk, no neon, no gaming UI, no cheap tech blue, no excessive glow, no random AI art, no poster wall, no tiny unreadable text, no dense paragraphs",
    variants,
    mobile_readable_without_zoom: mobileReadable,
    native_text_fallback: nativeTextFallback,
  };
}

function deriveHeroTitle(intent: CardIntentResult, sot: SourceOfTruth): string {
  if (intent.primary_intent === "training") return "本周课程已就位";
  if (intent.primary_intent === "case_showcase") return "优秀案例推荐";
  if (intent.primary_intent === "result") return sot.rewards[0]?.value ?? "结果公布";
  if (intent.primary_intent === "award") return "获奖公布";
  return sot.activity_name ?? "活动通知";
}

function deriveHeroSubtitle(intent: CardIntentResult, _sot: SourceOfTruth): string | undefined {
  if (intent.primary_intent === "training") return "从协作提效到 AI 实战";
  return undefined;
}

function buildPrompt(
  style: StyleProfile,
  intent: CardIntentResult,
  imageRole: string,
  heroTitle: string,
  heroSubtitle: string | undefined,
  modules: ImageModule[],
  aspect: string,
  nativeTextFallback: boolean,
): string {
  const palette = `${style.colors.surface} background, ${style.colors.primaryBrand} accents, low saturation`;
  const moduleDesc = modules.map((m) => `- ${m.title}`).join("\\n");
  const composition = visualComposition(intent.primary_intent, imageRole, modules.length);
  const textStrategy = nativeTextFallback
    ? "IMPORTANT: render ONLY abstract visual modules, dividers and iconography; do NOT bake Chinese text into the image. Chinese labels are overlaid by native Feishu card text."
    : "Render clear, large, legible module titles.";

  return [
    `Design an information-bearing card visual (${aspect}) for a Feishu mobile card.`,
    `Style: ${style.visualDirection}. Keywords: ${style.keywords.slice(0, 6).join(", ")}.`,
    `Palette: ${palette}. Generous whitespace, clear modular grouping, soft gradient, refined and product-native.`,
    `Concept: "${heroTitle}"${heroSubtitle ? ` — ${heroSubtitle}` : ""}.`,
    `Composition preset: ${composition}`,
    modules.length ? `Modules to visually separate:\\n${moduleDesc}` : "",
    `Reserve a lower safe zone for native text/CTA overlay.`,
    textStrategy,
    `Mobile-first: readable at phone card width without zoom; no dense paragraphs, no tiny text.`,
  ]
    .filter(Boolean)
    .join("\\n");
}

function visualComposition(intent: CardIntentResult["primary_intent"], role: string, moduleCount: number): string {
  if (role === "schedule_overview") {
    return `editorial schedule overview with ${Math.max(moduleCount, 2)} clearly separated visual lanes, calendar rhythm, restrained pictograms, strong top-to-bottom reading order`;
  }
  if (role === "scene_navigation" || role === "module_summary") {
    return `modular navigation board with ${Math.max(moduleCount, 3)} distinct scene tiles, consistent icon system, clear grouping and generous gutters`;
  }
  if (intent === "result" || intent === "award") {
    return "premium recognition scene with a single sculptural trophy or medal focal point, subtle celebratory paper details, calm editorial lighting";
  }
  if (intent === "training") {
    return "modern learning workspace with a focused screen, notebook and modular lesson objects, clean editorial product photography";
  }
  if (intent === "case_showcase") {
    return "polished product case-study composition showing an abstract workflow from input to outcome, three clear visual stages";
  }
  return "confident launch-key-visual with one central forward-moving form, precise grid, large quiet negative space, premium editorial lighting";
}
