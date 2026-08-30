#!/usr/bin/env node
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { compile } from "./core/pipeline.js";
import { writeBundle } from "./output/bundle-writer.js";
import { FeishuCardAdapter } from "./feishu/cardkit-client.js";
import { createCardkitDraft, type CardKitTransport } from "./agent/tool-adapter.js";
import type { RawInput } from "./core/types.js";

/**
 * CLI entry point.
 *
 * Usage:
 *   ai-pioneer-card --copy "..."            generate from inline copy
 *   ai-pioneer-card --file path.txt         generate from a copy file
 *   ai-pioneer-card --copy "..." --brand 象上汇 --slug my-card
 *   ai-pioneer-card --copy "..." --hero-image hero.png  upload & render a real img
 *   ai-pioneer-card --copy "..." --send --chat oc_xxx   (needs credentials)
 *   ai-pioneer-card --copy "..." --send-cli --chat oc_xxx  (needs lark-cli login)
 *
 * Without credentials, everything runs offline and emits status "Generated".
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Walk up from a start dir to the nearest folder containing package.json. */
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

interface Args {
  copy?: string;
  file?: string;
  brand?: string;
  slug?: string;
  outputs?: string;
  send?: boolean;
  sendCli?: boolean;
  confirm?: boolean;
  chat?: string;
  heroImage?: string;
  imageUrl?: string;
  cardkitDraft?: boolean;
  transport?: CardKitTransport;
  json?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--copy": args.copy = argv[++i]; break;
      case "--file": args.file = argv[++i]; break;
      case "--brand": args.brand = argv[++i]; break;
      case "--slug": args.slug = argv[++i]; break;
      case "--outputs": args.outputs = argv[++i]; break;
      case "--chat": args.chat = argv[++i]; break;
      case "--send": args.send = true; break;
      case "--send-cli": args.sendCli = true; break;
      case "--confirm": args.confirm = true; break;
      case "--hero-image": args.heroImage = argv[++i]; break;
      case "--image-url": args.imageUrl = argv[++i]; break;
      case "--transport": args.transport = argv[++i] as CardKitTransport; break;
      case "--cardkit-draft": args.cardkitDraft = true; break;
      case "--json": args.json = true; break;
      case "-h":
      case "--help": printHelp(); process.exit(0);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`AI先锋大赛智能飞书卡片 Skill

Usage:
  ai-pioneer-card --copy "<原始活动文案>" [--brand <品牌名>] [--slug <名称>]
  ai-pioneer-card --file <文案文件路径> [--brand <品牌名>]
  ai-pioneer-card --copy "..." --hero-image <图片路径>   # 上传并渲染真实图片（需凭证）
  ai-pioneer-card --copy "..." --send --chat <chat_id>   # 需要真实凭证
  ai-pioneer-card --copy "..." --send-cli --chat <chat_id>  # 走本机 lark-cli 发送
  ai-pioneer-card --copy "..." --cardkit-draft              # 生图并创建 CardKit 草稿

Options:
  --copy        直接传入原始文案
  --file        从文件读取原始文案
  --brand       指定品牌（会尝试复用 brands/<slug>/style.md）
  --slug        指定输出目录名
  --outputs     自定义输出根目录（默认 ./outputs）
  --hero-image  本地图片路径：配置凭证时上传换取 img_key 并渲染进卡片
  --image-url   宿主生图模型返回的 HTTPS 图片地址
  --cardkit-draft  一键生图、上传并创建 CardKit 实体（不发群）
  --transport   auto | open_api | lark_cli（CardKit 草稿传输）
  --send        真实发送到飞书（需配置 FEISHU_APP_ID / FEISHU_APP_SECRET）
  --send-cli    通过本机 lark-cli 发送（需已 lark-cli auth login）
  --chat        发送目标 chat_id
  --confirm     对外发送的显式授权
  --json        仅打印 JSON 摘要
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let copy = args.copy;
  if (!copy && args.file) {
    const p = resolve(args.file);
    if (!existsSync(p)) {
      console.error(`file not found: ${p}`);
      process.exit(1);
    }
    copy = readFileSync(p, "utf8");
  }
  if (!copy) {
    console.error("缺少输入：请使用 --copy 或 --file 提供原始文案。\n");
    printHelp();
    process.exit(1);
  }

  if (args.cardkitDraft) {
    const draft = await createCardkitDraft({
      copy,
      brand: args.brand,
      slug: args.slug,
      generated_image_url: args.imageUrl,
      with_image: true,
      require_planned_image: true,
      transport: args.transport ?? "lark_cli",
      write_bundle: true,
    });
    console.log(JSON.stringify(draft, null, 2));
    process.exit(draft.status === "created" ? 0 : draft.status === "needs_image" ? 2 : 1);
  }

  const input: RawInput = {
    copy,
    brandName: args.brand,
    slug: args.slug,
    wantSend: args.send || args.sendCli,
    confirmSend: args.confirm,
  };
  const outputsDir = args.outputs ? resolve(args.outputs) : OUTPUTS_DIR;

  // Image landing path: upload BEFORE compile so the real img_key flows into
  // the rendered card. Without credentials this degrades to native text.
  if (args.heroImage) {
    const imgPath = resolve(args.heroImage);
    if (!existsSync(imgPath) || !statSync(imgPath).isFile()) {
      console.error(`image not found: ${imgPath}`);
      process.exit(1);
    }
    const adapter = new FeishuCardAdapter();
    const up = await adapter.uploadImage(imgPath);
    if (up.ok && up.imageKey) {
      input.heroImageKey = up.imageKey;
      console.log(`🖼️  图片已上传 → img_key: ${up.imageKey}`);
    } else {
      console.log(`⚠️  图片未上传（${up.message}），卡片保持原生文字承载。`);
    }
  }

  const result = compile(input, { brandsDir: BRANDS_DIR });

  // 兜底层: blocked runs (out-of-scope / blocking clarification) — do not
  // write a bad card; report why and how to proceed.
  if (!result.preflight.proceed) {
    if (result.preflight.status === "out_of_scope") {
      console.log(`\n⛔ 越界拒绝：${result.preflight.boundary.reason}`);
      if (result.preflight.boundary.suggestedSkill) {
        console.log(`   建议改用：${result.preflight.boundary.suggestedSkill}`);
      }
    } else {
      console.log(`\n❓ 需要先补充信息：`);
      for (const c of result.preflight.clarifications.filter((x) => x.blocking)) {
        console.log(`   - ${c.question}`);
      }
    }
    process.exit(2);
  }

  const dir = writeBundle(outputsDir, result);

  if (args.json) {
    console.log(JSON.stringify({
      slug: result.slug,
      intent: result.intent.primary_intent,
      renderMode: result.renderMode.render_mode,
      score: result.qa.score.total,
      pass: result.qa.pass,
      hardFail: result.qa.hardFail,
      publishStatus: result.publishStatus,
      outputDir: dir,
    }, null, 2));
  } else {
    console.log(`\n✅ 生成完成 → ${dir}`);
    console.log(`   Intent        : ${result.intent.primary_intent} (conf ${result.intent.confidence})`);
    console.log(`   Render Mode   : ${result.renderMode.render_mode}`);
    console.log(`   Image         : ${result.imagePlan ? result.imagePlan.role : "none"}`);
    console.log(`   Primary Anchor: ${result.attention.primary_anchor}`);
    console.log(`   CTAs          : ${result.ctas.map((c) => `${c.priority === "primary" ? "★" : "·"}${c.label}`).join(", ") || "(none)"}`);
    console.log(`   QA Score      : ${result.qa.score.total}/100  pass=${result.qa.pass}  hardFail=${result.qa.hardFail}  rewrites=${result.qa.rewrites}`);
    console.log(`   Mobile        : cols=${result.mobileLayout.columnStrategy} secondary=${result.mobileLayout.secondaryCTAStyle}`);
    console.log(`   Publish       : ${result.publishStatus}`);
    if (result.preflight.clarifications.length) {
      console.log(`   追问(非阻断)  :`);
      for (const c of result.preflight.clarifications) console.log(`     - ${c.question}`);
    }
    if (result.preflight.lowConfidence.length) {
      console.log(`   低置信标注    :`);
      for (const f of result.preflight.lowConfidence) console.log(`     - ${f.note}`);
    }
    if (result.qa.issues.length) {
      console.log(`   Issues        :`);
      for (const i of result.qa.issues) console.log(`     - [${i.severity}] ${i.code}: ${i.message}`);
    }
  }

  // Optional real send — two transports: direct API (--send) or local
  // lark-cli (--send-cli). Both are outward actions behind the same gates:
  // hard-failed cards NEVER leave the machine, and a human must --confirm.
  if (args.send || args.sendCli) {
    // Fact-safety gate (D7): a hard-failed card must NEVER be sent.
    if (result.qa.hardFail) {
      console.log(`\n⛔ 卡片存在事实/合规硬错误（hardFail），已禁止发送：`);
      for (const i of result.qa.issues.filter((x) => x.severity === "hard_fail")) {
        console.log(`   - ${i.code}: ${i.message}`);
      }
      return;
    }
    // 风险确认 (兜底层): sending is an outward action — require --confirm.
    const risk = result.preflight.risks.find((r) => r.action === "send_card");
    if (risk?.requiresConfirmation) {
      console.log(`\n⚠️  ${risk.message}`);
      console.log("   这是对外发送动作，请加 --confirm 明确授权后再发送。已跳过发送。");
      return;
    }
    const chat = args.chat ?? process.env.FEISHU_DEFAULT_CHAT_ID;
    if (!chat) {
      console.log("\n⚠️  发送需要 --chat <chat_id> 或 FEISHU_DEFAULT_CHAT_ID。");
      return;
    }

    if (args.sendCli) {
      // lark-cli transport: uses the locally logged-in identity; no app
      // credentials needed in this process. Card JSON is passed verbatim.
      const cardJsonStr = JSON.stringify(result.cardJson);
      try {
        const out = execFileSync(
          "lark-cli",
          ["im", "+messages-send", "--chat-id", chat, "--msg-type", "interactive", "--content", cardJsonStr],
          { encoding: "utf8", timeout: 30_000 },
        );
        console.log(`\n发送结果（lark-cli）：✅\n${out.trim().split("\n").slice(-5).join("\n")}`);
      } catch (e) {
        const err = e as { status?: number; stderr?: string; message?: string };
        console.log(`\n发送结果（lark-cli）：❌ ${err.stderr?.trim() ?? err.message}`);
      }
      return;
    }

    const adapter = new FeishuCardAdapter();
    if (!adapter.configured) {
      console.log(`\n⚠️  未配置飞书凭证，跳过发送（状态保持 Generated）。${adapter.statusReason ?? ""}`);
      console.log("   或改用 --send-cli 走本机 lark-cli 发送。");
      return;
    }
    const send = await adapter.sendCard({ receiveIdType: "chat_id", receiveId: chat }, result.cardJson);
    console.log(`\n发送结果：${send.ok ? "✅" : "❌"} [${send.status}] ${send.message}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
