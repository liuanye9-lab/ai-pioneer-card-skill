#!/usr/bin/env node
import { createServer } from "node:http";
import { CardCallbackHandler } from "../src/feishu/callback-handler.js";
import { loadCredentials } from "../src/feishu/auth.js";

/**
 * Minimal HTTP binding for the card callback handler.
 * Route: POST /api/feishu/card/callback   (SPEC §18)
 *
 * Run: npx tsx scripts/callback-server.ts
 * Requires FEISHU_VERIFICATION_TOKEN / FEISHU_ENCRYPT_KEY for verification.
 */

const auth = loadCredentials();
const handler = new CardCallbackHandler({
  verificationToken: auth.credentials?.verificationToken,
  encryptKey: auth.credentials?.encryptKey,
  dispatch: async (payload) => {
    // Business dispatch stub. Map action.value.key to a real handler here.
    const key = payload.action?.value?.key ?? "unknown";
    switch (key) {
      case "primary_submission":
        return { toast: { type: "success", content: "已记录你的提交意向" } };
      default:
        return { toast: { type: "info", content: "已收到" } };
    }
  },
});

const port = Number(process.env.CALLBACK_PORT ?? 3000);

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/api/feishu/card/callback") {
    res.writeHead(404).end("not found");
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v[0] : v;

    const result = await handler.handle({ headers, rawBody });
    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.response ?? { code: result.code, msg: result.message }));
  });
});

server.listen(port, () => {
  console.log(`Feishu card callback server on http://localhost:${port}/api/feishu/card/callback`);
  if (!auth.credentials?.encryptKey) {
    console.log("⚠️  未配置 FEISHU_ENCRYPT_KEY，签名校验已跳过（仅用于本地联调）。");
  }
});
