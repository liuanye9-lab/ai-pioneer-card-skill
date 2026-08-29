#!/usr/bin/env node
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CardAgentRuntime } from "../src/agent/agent-runtime.js";

/**
 * Interactive「飞书活动卡片助手」豆包工作伙伴 — 真实可对话的 Agent。
 *
 * 从 agent.manifest.json 读取身份/开场白/预设问题，启动 CardAgentRuntime，
 * 在终端里和它多轮对话。输入文案→出卡；说“发到群里”→确认后发送（无凭证则
 * 停在 Generated）；越界会转其他 Skill。
 *
 * Run: npm run agent:chat
 * Exit: 输入 exit / quit / 退出 或 Ctrl-C
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = resolve(__dirname, "..", "agent");

function loadManifest(): any {
  try {
    return JSON.parse(readFileSync(join(AGENT_DIR, "agent.manifest.json"), "utf8"));
  } catch {
    return {};
  }
}

const manifest = loadManifest();
const agentName = manifest?.agent?.name ?? "飞书活动卡片助手";
const opening = manifest?.agent?.opening_remark as string | undefined;
const presets = (manifest?.agent?.preset_questions as string[] | undefined) ?? [];
const brand = manifest?.persona?.brand;

const runtime = new CardAgentRuntime({
  chatName: "AI先锋大赛运营群",
  chatId: process.env.FEISHU_DEFAULT_CHAT_ID ?? "",
  brand,
});

const rl = createInterface({ input: process.stdin, output: process.stdout });

function botSay(text: string): void {
  const prefixed = text
    .split("\n")
    .map((l, i) => (i === 0 ? `🤖 ${agentName}：${l}` : `           ${l}`))
    .join("\n");
  console.log(prefixed);
}

function banner(): void {
  console.log("═".repeat(66));
  console.log(`  豆包工作伙伴 · ${agentName}`);
  console.log(`  内嵌 Skill：AI先锋大赛智能飞书卡片 (v1.2.0)`);
  console.log(`  发送状态：${process.env.FEISHU_APP_ID ? "凭证已配置" : "未配置凭证（发送将停在 Generated）"}`);
  console.log("═".repeat(66));
  botSay(opening ?? runtime.greeting());
  if (presets.length) {
    console.log("\n  预设示例（直接复制其一发我）：");
    presets.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  }
  console.log(`\n  (输入 exit 退出)`);
}

async function loop(): Promise<void> {
  banner();

  // Use a sequential line queue so it works for BOTH interactive typing and
  // piped/redirected input (avoids the readline "lost line during await" race).
  const pending: string[] = [];
  let resolveNext: ((line: string | null) => void) | null = null;
  let closed = false;

  rl.on("line", (line) => {
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(line);
    } else {
      pending.push(line);
    }
  });
  rl.on("close", () => {
    closed = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(null);
    }
  });

  const nextLine = (): Promise<string | null> => {
    if (pending.length) return Promise.resolve(pending.shift()!);
    if (closed) return Promise.resolve(null);
    return new Promise((res) => {
      resolveNext = res;
    });
  };

  for (;;) {
    process.stdout.write("\n👤 你：");
    const input = await nextLine();
    if (input === null) break;
    const msg = input.trim();
    if (!msg) continue;
    if (/^(exit|quit|退出|q)$/i.test(msg)) {
      console.log("再见 👋");
      break;
    }
    // Preset shortcut: a bare number picks a preset question.
    const pickedPreset = /^\d+$/.test(msg) ? presets[Number(msg) - 1] : undefined;
    const userMessage = pickedPreset ?? msg;
    if (pickedPreset) console.log(`   (选择预设 ${msg}) ${pickedPreset}`);

    try {
      const reply = await runtime.handle(userMessage);
      for (const tc of reply.toolCalls) {
        const s = JSON.stringify(tc.args);
        console.log(`   ⚙️  ${tc.name}(${s.length > 68 ? s.slice(0, 68) + "…" : s})`);
      }
      botSay(reply.text);
    } catch (e) {
      botSay(`出错了：${(e as Error).message}`);
    }
  }
  rl.close();
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
