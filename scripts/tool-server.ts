#!/usr/bin/env node
import { createServer } from "node:http";
import { dispatchTool } from "../src/agent/tool-adapter.js";

/**
 * Minimal HTTP tool server for embedding the card Skill into a Doubao work
 * companion via the "plugin / custom API (function calling)" path.
 *
 *   POST /tool   { "name": "generate_feishu_card", "args": { "copy": "..." } }
 *
 * Run: npx tsx scripts/tool-server.ts   (PORT env, default 3100)
 * The豆包 platform forwards each function call here; we return the JSON result.
 */

const port = Number(process.env.TOOL_PORT ?? 3100);
const toolToken = process.env.TOOL_SERVER_TOKEN?.trim();
const maxBodyBytes = Number(process.env.TOOL_MAX_BODY_BYTES ?? 1_000_000);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      tools: [
        "generate_feishu_card",
        "create_cardkit_draft",
        "update_cardkit_card",
        "validate_feishu_card",
        "send_feishu_card",
      ],
    }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/tool") {
    res.writeHead(404).end("not found");
    return;
  }
  if (toolToken && req.headers.authorization !== `Bearer ${toolToken}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  req.on("data", (c: Buffer) => {
    size += c.length;
    if (size > maxBodyBytes) tooLarge = true;
    else if (!tooLarge) chunks.push(c);
  });
  req.on("end", async () => {
    if (tooLarge) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "request body too large" }));
      return;
    }
    try {
      const { name, args } = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (typeof name !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing tool name" }));
        return;
      }
      const result = await dispatchTool(name, args ?? {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
});

server.listen(port, () => {
  console.log(`Card-skill tool server on http://localhost:${port}/tool`);
  console.log(`  health: GET  /health`);
  console.log(`  call  : POST /tool  { "name": "generate_feishu_card", "args": { "copy": "..." } }`);
});
