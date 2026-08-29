import type {
  RawInput,
  CompileResult,
  PublishStatus,
  SourceOfTruth,
  CardIntentResult,
  RenderModeResult,
  ImageIntentResult,
  PreflightResult,
} from "./types.js";
import { DEFAULT_DEVICE_PROFILE, MAX_AUTO_REWRITES } from "./constants.js";
import { resetIdCounter } from "./errors.js";
import { runPreflight } from "./preflight.js";

import { parseSourceOfTruth } from "../parser/fact-parser.js";
import { routeCardIntent } from "../intent/card-intent-router.js";
import { routeImageIntent } from "../intent/image-intent-router.js";
import { routeRenderMode } from "../intent/render-mode-router.js";
import { buildAttentionPlan } from "../design/attention-engine.js";
import { resolveStyle } from "../brand/style-resolver.js";
import { DEFAULT_STYLE } from "../brand/default-style.js";
import { buildInformationArchitecture } from "../design/information-architect.js";
import { buildImagePlan } from "../design/image-planner.js";
import { planCTAs } from "../design/interaction-planner.js";
import { runMobileLayoutPass } from "../mobile/mobile-layout-pass.js";
import { chooseTemplate } from "../renderer/template-registry.js";
import { renderCardJson } from "../renderer/card-json-renderer.js";
import { renderPreview } from "../renderer/preview-renderer.js";
import { renderCardContentMarkdown } from "../renderer/card-content-markdown.js";
import { generateOperationCopy } from "../operation/operation-copy-generator.js";
import { resolveScopes } from "../feishu/scope-resolver.js";
import { resolveDeepLink } from "../feishu/deep-link-resolver.js";
import { loadCredentials } from "../feishu/auth.js";
import { runQA } from "../qa/index.js";

/**
 * Central compile pipeline (SKILL §39 mandatory workflow).
 *
 * Parse → SoT → Lock → Normalize → Dedup → Intent → Render Mode → Image Intent
 * → Attention → IA → Brand/Style → Image Plan → CTA → MOBILE LAYOUT PASS →
 * MOBILE IMAGE READABILITY → MOBILE CTA → Desktop Enhancement → Card JSON →
 * Operation Copy → Cross-device QA → Rewrite if needed → Output.
 */

export interface PipelineOptions {
  brandsDir: string;
  env?: NodeJS.ProcessEnv;
}

/** Extract all human-visible text from the card for QA. */
function collectCardText(cardJson: any): string {
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.content === "string") parts.push(node.content);
    if (node.text && typeof node.text.content === "string") parts.push(node.text.content);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object") walk(v as any);
    }
  };
  walk(cardJson);
  return parts.join("\n");
}

function slugFromInput(input: RawInput): string {
  if (input.slug) return input.slug;
  const base = (input.brandName ?? input.copy).slice(0, 12).replace(/[^\w\u4e00-\u9fa5]+/g, "-");
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${base}-${stamp}`.replace(/^-+/, "");
}

export function compile(input: RawInput, options: PipelineOptions): CompileResult {
  resetIdCounter();
  const env = options.env ?? process.env;

  // 1-6: Parse → SoT → Lock → Normalize → Dedup (parser+normalizer inside).
  const sot = parseSourceOfTruth(input);

  // 7-9: Intent → Render Mode → Image Intent.
  const intent = routeCardIntent(sot, input.copy);
  const imageIntent = routeImageIntent(sot, intent, input.copy);
  const renderMode = routeRenderMode(sot, intent, imageIntent);

  // 兜底层 (Fallback Layer) — preflight守门: 越界拒绝 / 缺参追问 / 低置信 / 风险确认.
  const degradations: string[] = [];
  if (renderMode.render_mode !== "image_led_navigation" && imageIntent.image_mode === "required") {
    degradations.push("图片必需但非导航角色，降级为 image_assisted / 文字承载。");
  }
  const preflight = runPreflight({ raw: input, sot, intent, imageIntent, degradations });

  // Out-of-scope or blocking clarification: return early without a card so the
  // caller can 拒绝/转其他 Skill 或 追问, instead of forcing a bad card.
  if (!preflight.proceed) {
    return buildBlockedResult(input, sot, intent, renderMode, imageIntent, preflight, env);
  }

  // 10: Attention.
  const attention = buildAttentionPlan(intent, sot);

  // 11: Brand / Style.
  const styleResolution = resolveStyle({ brandName: input.brandName, brandsDir: options.brandsDir });
  const style = styleResolution.style;

  // 12: Information Architecture.
  const structure = buildInformationArchitecture({ sot, intent, renderMode, attention, style });

  // 13: Image Plan.
  const imagePlan = buildImagePlan({ sot, intent, imageIntent, renderMode, style, rawCopy: input.copy });
  if (imagePlan) structure.image = imagePlan;

  // 14: CTA Plan.
  const ctas = planCTAs({ sot, intent, renderMode, imagePlan });
  structure.ctas = ctas;

  // 15-16: MOBILE LAYOUT + IMAGE READABILITY + CTA passes.
  const mobileLayout = runMobileLayoutPass({ structure, renderMode, imagePlan, sot, ctas });

  // Deep link mobile-usability for the primary CTA.
  const primaryCta = ctas.find((c) => c.priority === "primary");
  let primaryCtaMobileUsable = true;
  if (primaryCta?.type === "url" && primaryCta.url) {
    const resolved = resolveDeepLink({ universal: primaryCta.url });
    primaryCtaMobileUsable = resolved.mobileUsable;
    primaryCta.linkTarget = resolved.target;
  }

  // 17: Desktop Enhancement (never alters mobile reading order — recorded only).
  const template = chooseTemplate(intent.primary_intent, renderMode.render_mode);

  // 18: Card JSON. A caller-provided heroImageKey (real upload) turns the
  // planned image into a native img element; otherwise native-text fallback.
  let workStructure = structure;
  let workCtas = ctas;
  let workImagePlan = imagePlan;
  let workMobileLayout = mobileLayout;
  let cardJson = renderCardJson({ structure: workStructure, ctas: workCtas, style, renderMode, mobileLayout: workMobileLayout, imagePlan: workImagePlan, imgKey: input.heroImageKey });
  let cardPreview = renderPreview({ structure: workStructure, ctas: workCtas, mobileLayout: workMobileLayout, imagePlan: workImagePlan });
  let cardContentMarkdown = renderCardContentMarkdown({ structure: workStructure, ctas: workCtas, imagePlan: workImagePlan });

  // 19: Operation Copy.
  const operationCopy = generateOperationCopy(sot, intent);

  // 20: QA + Cross-device.
  let { report, crossDevice } = runQA({
    sot,
    rawCopy: input.copy,
    cardText: collectCardText(cardJson),
    structure: workStructure,
    intent,
    ctas: workCtas,
    imagePlan: workImagePlan,
    style,
    cardJson,
    mobileLayout: workMobileLayout,
    primaryCtaMobileUsable,
  });

  // 21: Rewrite loop (score < 85 OR hard fail) up to MAX_AUTO_REWRITES.
  // Each pass applies remediation AND re-renders the card so QA re-checks the
  // ACTUAL output (D#8), and the emitted bundle reflects the fixes.
  let rewrites = 0;
  while ((!report.pass || report.hardFail) && rewrites < MAX_AUTO_REWRITES) {
    rewrites += 1;
    const remediated = remediate({ structure: workStructure, ctas: workCtas, imagePlan: workImagePlan, mobileLayout: workMobileLayout, report });
    workStructure = remediated.structure;
    workCtas = remediated.ctas;
    workImagePlan = remediated.imagePlan;
    workMobileLayout = remediated.mobileLayout;
    cardJson = renderCardJson({ structure: workStructure, ctas: workCtas, style, renderMode, mobileLayout: workMobileLayout, imagePlan: workImagePlan, imgKey: input.heroImageKey });
    cardPreview = renderPreview({ structure: workStructure, ctas: workCtas, mobileLayout: workMobileLayout, imagePlan: workImagePlan });
    cardContentMarkdown = renderCardContentMarkdown({ structure: workStructure, ctas: workCtas, imagePlan: workImagePlan });
    const rerun = runQA({
      sot,
      rawCopy: input.copy,
      cardText: collectCardText(cardJson),
      structure: workStructure,
      intent,
      ctas: workCtas,
      imagePlan: workImagePlan,
      style,
      cardJson,
      mobileLayout: workMobileLayout,
      primaryCtaMobileUsable,
    });
    report = rerun.report;
    crossDevice = rerun.crossDevice;
    report.rewrites = rewrites;
    if (report.pass && !report.hardFail) break;
  }
  report.rewrites = rewrites;

  // Feishu publish status.
  const auth = loadCredentials(env);
  const publishStatus: PublishStatus = auth.configured ? "Configured" : "Generated";
  const scopeChecklist = resolveScopes({
    ctas: workCtas,
    sot,
    willSend: false,
    hasCallback: workCtas.some((c) => c.type === "callback"),
  });

  const renderPlan = {
    template,
    render_mode: renderMode,
    device_profile: DEFAULT_DEVICE_PROFILE,
    style_resolution: { note: styleResolution.note, researchRequired: styleResolution.researchRequired },
    reading_order: workMobileLayout.readingOrder,
    cta_summary: workCtas.map((c) => ({ label: c.label, priority: c.priority, type: c.type, target: c.url ?? c.callbackKey })),
  };

  return {
    slug: slugFromInput(input),
    sourceOfTruth: sot,
    intent,
    renderMode,
    imageIntent,
    attention,
    style,
    imagePlan: workImagePlan,
    ctas: workCtas,
    structure: workStructure,
    mobileLayout: workMobileLayout,
    deviceProfile: DEFAULT_DEVICE_PROFILE,
    cardJson,
    cardPreview,
    cardContentMarkdown,
    renderPlan,
    operationCopy,
    qa: report,
    crossDeviceQA: crossDevice,
    preflight,
    publishStatus,
    scopeChecklist,
  };
}

/**
 * Remediation applied between rewrite attempts. Conservative, deterministic
 * fixes that address the most common QA failures without inventing facts.
 */
function remediate(input: {
  structure: CompileResult["structure"];
  ctas: CompileResult["ctas"];
  imagePlan?: CompileResult["imagePlan"];
  mobileLayout: CompileResult["mobileLayout"];
  report: CompileResult["qa"];
}) {
  const { report } = input;
  const { structure } = input;
  let { ctas, imagePlan, mobileLayout } = input;

  const has = (code: string) => report.issues.some((i) => i.code === code);

  // Image not mobile-readable / critical fact only in image => drop to native.
  if (has("IMAGE_NOT_MOBILE_READABLE") || has("IMAGE_ZOOM_REQUIRED") || has("CRITICAL_FACT_ONLY_IN_IMAGE")) {
    if (imagePlan) {
      imagePlan = { ...imagePlan, modules: imagePlan.modules.slice(0, 4), mobile_readable_without_zoom: true, native_text_fallback: true };
    }
    mobileLayout = { ...mobileLayout, imageReadableWithoutZoom: true };
  }

  // Too many secondary CTAs => cap at 4.
  if (has("TOO_MANY_SECONDARY")) {
    const primary = ctas.filter((c) => c.priority === "primary");
    const secondary = ctas.filter((c) => c.priority === "secondary").slice(0, 4);
    ctas = [...primary, ...secondary];
  }

  // Crowded button row => force stacked.
  if (has("CROWDED_BUTTON_ROW")) {
    mobileLayout = { ...mobileLayout, secondaryCTAStyle: "stacked", maxSecondaryCTAPerRow: 1 };
  }

  return { structure, ctas, imagePlan, mobileLayout };
}

/**
 * Build a result for a blocked run (out-of-scope OR blocking clarification).
 * No card is produced; the caller reads `preflight` to 拒绝/转 Skill/追问.
 * This keeps the exception path controllable and never emits a bad card.
 */
function buildBlockedResult(
  input: RawInput,
  sot: SourceOfTruth,
  intent: CardIntentResult,
  renderMode: RenderModeResult,
  imageIntent: ImageIntentResult,
  preflight: PreflightResult,
  env: NodeJS.ProcessEnv,
): CompileResult {
  const auth = loadCredentials(env);
  const publishStatus: PublishStatus = auth.configured ? "Configured" : "Generated";

  const emptyStructure = {
    header: { activityName: sot.activity_name ?? "（待明确）" },
    primaryAnchor: { id: "blocked", type: "text" as const, priority: 1 as const, content: {} },
    body: [],
    ctas: [],
    footer: [],
  };

  const reason =
    preflight.status === "out_of_scope"
      ? `越界拒绝：${preflight.boundary.reason}${preflight.boundary.suggestedSkill ? ` 建议转「${preflight.boundary.suggestedSkill}」。` : ""}`
      : `需要补充信息后才能生成：${preflight.clarifications.filter((c) => c.blocking).map((c) => c.question).join(" / ")}`;

  return {
    slug: slugFromInput(input),
    sourceOfTruth: sot,
    intent,
    renderMode,
    imageIntent,
    attention: { primary_anchor: "", secondary_anchors: [], supporting: [] },
    style: DEFAULT_STYLE,
    imagePlan: undefined,
    ctas: [],
    structure: emptyStructure,
    mobileLayout: {
      mobile_first: true,
      readingOrder: [],
      columnStrategy: "single",
      primaryAnchorPosition: "top",
      primaryCTAPlacement: "after_primary_content",
      secondaryCTAStyle: "stacked",
      maxSecondaryCTAPerRow: 1,
      imageMode: "none",
      imageReadableWithoutZoom: true,
      criticalFactsAboveFold: [],
      warnings: [],
    },
    deviceProfile: DEFAULT_DEVICE_PROFILE,
    cardJson: null,
    cardPreview: { blocked: true, reason },
    cardContentMarkdown: `# 未生成卡片\n\n${reason}\n`,
    renderPlan: { blocked: true, preflight_status: preflight.status },
    operationCopy: { beforeSend: "", onSend: "", afterSend: "", deadlineReminder: "" },
    qa: {
      checks: [],
      score: {
        informationClarity: 0,
        attentionHierarchy: 0,
        actionClarity: 0,
        brandConsistency: 0,
        visualQuality: 0,
        feishuNativeExperience: 0,
        total: 0,
      },
      pass: false,
      hardFail: false,
      issues: [],
      rewrites: 0,
    },
    crossDeviceQA: {
      mobile: { pass: false, issues: [reason] },
      ios: { pass: false, issues: [] },
      android: { pass: false, issues: [] },
      desktop: { pass: false, issues: [] },
      overallPass: false,
    },
    preflight,
    publishStatus,
    scopeChecklist: [],
  };
}
