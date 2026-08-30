import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { compile } from "../core/pipeline.js";
import { writeBundle } from "../output/bundle-writer.js";
import { FeishuCardAdapter } from "../feishu/cardkit-client.js";
import { generateImage } from "../design/image-generator.js";
import type { RawInput, CompileResult } from "../core/types.js";

/**
 * Doubao Agent ↔ Skill adapter.
 *
 * Bridges the豆包工作伙伴 agent's tool/function calls to the card-generation
 * pipeline. Each exported function maps 1:1 to a tool declared in
 * agent/tools.schema.json. Return shapes are agent-friendly (compact, with
 * clarifications/risks surfaced) rather than the full CompileResult.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function findProjectRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start, "..");
}

const PROJECT_ROOT = findProjectRoot(__dirname);
const BRANDS_DIR = join(PROJECT_ROOT, "brands");
const OUTPUTS_DIR = join(PROJECT_ROOT, "outputs");

// ---------------------------------------------------------------------------
// Tool: generate_feishu_card
// ---------------------------------------------------------------------------

export interface GenerateArgs {
  copy: string;
  brand?: string;
  slug?: string;
  want_send?: boolean;
  confirm_send?: boolean;
  write_bundle?: boolean;
  /** Try to produce a REAL image (generate → upload → img_key) before render. */
  with_image?: boolean;
}

export interface AgentGenerateResult {
  status: "generated" | "needs_clarification" | "out_of_scope";
  message: string;
  /** Present only when a card was produced. */
  card_json?: any;
  summary?: {
    intent: string;
    render_mode: string;
    image_role: string;
    primary_anchor: string;
    ctas: Array<{ label: string; priority: string; target?: string }>;
    qa_score: number;
    qa_pass: boolean;
    hard_fail: boolean;
    mobile_columns: string;
    publish_status: string;
  };
  /** 兜底层 signals for the agent to relay to the user. */
  clarifications?: Array<{ field: string; question: string; blocking: boolean }>;
  low_confidence?: Array<{ field: string; note: string }>;
  risks?: Array<{ action: string; message: string; requires_confirmation: boolean }>;
  suggested_skill?: string;
  output_dir?: string;
  /** Ready-to-send group operation copy (发卡前/时/后 + 截止提醒). */
  operation_copy?: {
    before_send: string;
    before_send_lively?: string;
    on_send: string;
    after_send: string;
    deadline_reminder: string;
  };
  /** Human-readable mobile reading-order preview lines. */
  preview?: string[];
  /** Outcome of real image generation (when with_image was requested). */
  image_status?: {
    attempted: boolean;
    mode: string;
    produced: boolean;
    /** When mode==="delegate": the finished spec for the host to render. */
    delegate_prompt?: string;
    delegate_size?: string;
    message: string;
  };
}

function toSummary(result: CompileResult) {
  return {
    intent: result.intent.primary_intent,
    render_mode: result.renderMode.render_mode,
    image_role: result.imagePlan?.role ?? "none",
    primary_anchor: result.attention.primary_anchor,
    ctas: result.ctas.map((c) => ({ label: c.label, priority: c.priority, target: c.url ?? c.callbackKey })),
    qa_score: result.qa.score.total,
    qa_pass: result.qa.pass,
    hard_fail: result.qa.hardFail,
    mobile_columns: result.mobileLayout.columnStrategy,
    publish_status: result.publishStatus,
  };
}

export function generateFeishuCard(args: GenerateArgs, extra?: { heroImageKey?: string; imageStatus?: AgentGenerateResult["image_status"] }): AgentGenerateResult {
  const input: RawInput = {
    copy: args.copy,
    brandName: args.brand,
    slug: args.slug,
    wantSend: args.want_send,
    confirmSend: args.confirm_send,
    heroImageKey: extra?.heroImageKey,
  };

  const result = compile(input, { brandsDir: BRANDS_DIR });
  const pf = result.preflight;

  // 越界拒绝 / 转其他 Skill
  if (pf.status === "out_of_scope") {
    return {
      status: "out_of_scope",
      message: `这不属于飞书卡片场景：${pf.boundary.reason}`,
      suggested_skill: pf.boundary.suggestedSkill,
    };
  }

  // 阻断式追问
  if (!pf.proceed) {
    return {
      status: "needs_clarification",
      message: "需要先补充关键信息才能生成卡片。",
      clarifications: pf.clarifications.map((c) => ({ field: c.field, question: c.question, blocking: c.blocking })),
    };
  }

  let outputDir: string | undefined;
  if (args.write_bundle) {
    outputDir = writeBundle(OUTPUTS_DIR, result);
  }

  return {
    status: "generated",
    message: "卡片已生成。",
    card_json: result.cardJson,
    summary: toSummary(result),
    clarifications: pf.clarifications.length
      ? pf.clarifications.map((c) => ({ field: c.field, question: c.question, blocking: c.blocking }))
      : undefined,
    low_confidence: pf.lowConfidence.length ? pf.lowConfidence.map((f) => ({ field: f.field, note: f.note })) : undefined,
    risks: pf.risks.length
      ? pf.risks.map((r) => ({ action: r.action, message: r.message, requires_confirmation: r.requiresConfirmation }))
      : undefined,
    operation_copy: {
      before_send: result.operationCopy.beforeSend,
      before_send_lively: result.operationCopy.beforeSendLively,
      on_send: result.operationCopy.onSend,
      after_send: result.operationCopy.afterSend,
      deadline_reminder: result.operationCopy.deadlineReminder,
    },
    preview: Array.isArray(result.cardPreview?.preview_lines) ? result.cardPreview.preview_lines : undefined,
    output_dir: outputDir,
    image_status: extra?.imageStatus,
  };
}

/**
 * Async variant that attempts REAL image generation before rendering.
 *
 * Flow: compile once (offline) to get the style + image plan → generate an
 * image (runtime endpoint or delegate) → upload to Feishu for an img_key →
 * recompile with `heroImageKey` so the card renders a real image. On any
 * failure it falls back to the text-only card (never blocks), and always
 * reports what happened via `image_status`.
 */
export async function generateFeishuCardWithImage(args: GenerateArgs): Promise<AgentGenerateResult> {
  // First pass (offline) to get the plan + style; also handles preflight/blocked.
  const first = compile(
    { copy: args.copy, brandName: args.brand, slug: args.slug, wantSend: args.want_send, confirmSend: args.confirm_send },
    { brandsDir: BRANDS_DIR },
  );
  if (!first.preflight.proceed || !first.imagePlan) {
    // Blocked, or no image role → plain path (also covers out_of_scope/clarify).
    return generateFeishuCard(args);
  }

  const gen = await generateImage(first.imagePlan, first.style, { env: process.env });
  const imageStatus: AgentGenerateResult["image_status"] = {
    attempted: true,
    mode: gen.mode,
    produced: false,
    message: gen.message,
  };

  if (!gen.ok) {
    // Delegate mode surfaces the spec so the host can render it; still text card.
    if (gen.mode === "delegate") {
      imageStatus.delegate_prompt = gen.prompt;
      imageStatus.delegate_size = gen.size;
    }
    return generateFeishuCard(args, { imageStatus });
  }

  // Upload the produced image → img_key (needs Feishu credentials).
  const adapter = new FeishuCardAdapter();
  const up = gen.url
    ? await adapter.uploadImageFromUrl(gen.url)
    : await adapter.uploadImageBytes(gen.bytes ?? new Uint8Array(), "hero.png");
  if (!up.ok || !up.imageKey) {
    imageStatus.message = `图片已生成，但上传飞书失败（${up.message}），已回退为文字卡。`;
    return generateFeishuCard(args, { imageStatus });
  }

  imageStatus.produced = true;
  imageStatus.message = "已生成并嵌入真实图片。";
  return generateFeishuCard(args, { heroImageKey: up.imageKey, imageStatus });
}

// ---------------------------------------------------------------------------
// Tool: validate_feishu_card
// ---------------------------------------------------------------------------

export async function validateFeishuCard(args: { card_json: any }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const adapter = new FeishuCardAdapter();
  const r = await adapter.validateCard(args.card_json);
  return r;
}

// ---------------------------------------------------------------------------
// Tool: send_feishu_card
// ---------------------------------------------------------------------------

export interface SendArgs {
  card_json: any;
  chat_id: string;
  confirm: boolean;
}

export async function sendFeishuCard(args: SendArgs): Promise<{ ok: boolean; status: string; message: string }> {
  // 风险确认 (兜底层): outward send requires explicit confirmation.
  if (!args.confirm) {
    return {
      ok: false,
      status: "Configured",
      message: "发送是对外动作，需要 confirm=true 明确授权后才会执行。",
    };
  }
  const adapter = new FeishuCardAdapter();
  if (!adapter.configured) {
    return { ok: false, status: "Generated", message: adapter.statusReason ?? "未配置飞书凭证，无法发送。" };
  }
  const res = await adapter.sendCard({ receiveIdType: "chat_id", receiveId: args.chat_id }, args.card_json);
  return { ok: res.ok, status: res.status, message: res.message };
}

// ---------------------------------------------------------------------------
// Generic dispatcher (for a tool-call loop)
// ---------------------------------------------------------------------------

export async function dispatchTool(name: string, args: any): Promise<any> {
  switch (name) {
    case "generate_feishu_card":
      return args?.with_image ? generateFeishuCardWithImage(args) : generateFeishuCard(args);
    case "validate_feishu_card":
      return validateFeishuCard(args);
    case "send_feishu_card":
      return sendFeishuCard(args);
    default:
      return { error: `unknown tool: ${name}` };
  }
}
