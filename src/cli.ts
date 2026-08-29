#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { compile } from "./core/pipeline.js";
import { writeBundle } from "./output/bundle-writer.js";
import { FeishuCardAdapter } from "./feishu/cardkit-client.js";
import type { RawInput } from "./core/types.js";

/**
 * CLI entry point.
 *
 * Usage:
 *   ai-pioneer-card --copy "..."            generate from inline copy
 *   ai-pioneer-card --file path.txt         generate from a copy file
 *   ai-pioneer-card --copy "..." --brand 象上汇 --slug my-card
 *   ai-pioneer-card --copy "..." --send --chat oc_xxx   (needs credentials)
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
  confirm?: boolean;
  chat?: string;
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
      case "--confirm": args.confirm = true; break;
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
  ai-pioneer-card --copy "..." --send --chat <chat_id>   # 需要真实凭证

Options:
  --copy      直接传入原始文案
  --file      从文件读取原始文案
  --brand     指定品牌（会尝试复用 brands/<slug>/style.md）
  --slug      指定输出目录名
  --outputs   自定义输出根目录（默认 ./outputs）
  --send      真实发送到飞书（需配置 FEISHU_APP_ID / FEISHU_APP_SECRET）
  --chat      发送目标 chat_id
  --json      仅打印 JSON 摘要
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

  const input: RawInput = {
    copy,
    brandName: args.brand,
    slug: args.slug,
    wantSend: args.send,
    confirmSend: args.confirm,
  };
  const outputsDir = args.outputs ? resolve(args.outputs) : OUTPUTS_DIR;

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

  // Optional real send.
  if (args.send) {
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
    const adapter = new FeishuCardAdapter();
    if (!adapter.configured) {
      console.log(`\n⚠️  未配置飞书凭证，跳过发送（状态保持 Generated）。${adapter.statusReason ?? ""}`);
      return;
    }
    const chat = args.chat ?? process.env.FEISHU_DEFAULT_CHAT_ID;
    if (!chat) {
      console.log("\n⚠️  --send 需要 --chat <chat_id> 或 FEISHU_DEFAULT_CHAT_ID。");
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
