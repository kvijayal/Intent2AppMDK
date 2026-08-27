#!/usr/bin/env node
// Intent2App custom MCP server.
// Default: stdio (JSON-RPC on stdin/stdout).
// HTTP mode: node index.js --http [--port=3999]  →  POST http://localhost:<port>/mcp
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { allTools } from "./tools/index.js";
import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";

function buildMcpServer() {
  const srv = new Server(
    { name: "intent2app", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  const byName = new Map(allTools.map((t) => [t.name, t]));
  srv.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
  }));
  srv.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }], isError: true };
    try {
      return await tool.handler(req.params.arguments || {});
    } catch (e) {
      return { content: [{ type: "text", text: `Tool ${tool.name} failed: ${e?.stack || e}` }], isError: true };
    }
  });
  return srv;
}

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const portFlag = args.find(a => a.startsWith("--port="));
const portIdx  = args.indexOf("--port");
const port = portFlag              ? parseInt(portFlag.split("=")[1], 10)
           : portIdx !== -1        ? parseInt(args[portIdx + 1], 10)
           : 3999;
const isHttp = args.includes("--http") || !!portFlag || portIdx !== -1;

// ── HTTP / Streamable-HTTP mode ──────────────────────────────────────────────
if (isHttp) {
  const sessions = new Map(); // sessionId → StreamableHTTPServerTransport

  const httpServer = createHttpServer(async (req, res) => {
    const pathname = new URL(req.url || "/", `http://localhost:${port}`).pathname;

    // Health / root
    if (pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`intent2app MCP — ${allTools.length} tools — POST to /mcp`);
      return;
    }

    if (pathname !== "/mcp") {
      res.writeHead(404); res.end("Not found"); return;
    }

    // CORS (localhost only)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // Read body for POST
    let body;
    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      try { if (raw) body = JSON.parse(raw); } catch {}
    }

    const sessionId = req.headers["mcp-session-id"];

    if (req.method === "POST" && !sessionId) {
      // New session — must be initialize
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });
      const srv = buildMcpServer();
      await srv.connect(transport);
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
        srv.close();
      };
      await transport.handleRequest(req, res, body);
      if (transport.sessionId) sessions.set(transport.sessionId, transport);

    } else if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) { res.writeHead(404); res.end("Session not found"); return; }
      await transport.handleRequest(req, res, body);
      if (req.method === "DELETE") sessions.delete(sessionId);

    } else if (req.method === "GET") {
      // Standalone SSE stream (no session) — client probing for server-push capability.
      // This server has no server-initiated notifications; hold the connection open with
      // a keepalive ping so the client doesn't treat it as an error.
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });
      res.write(":ok\n\n");
      const ping = setInterval(() => { if (!res.writableEnded) res.write(":ping\n\n"); }, 25000);
      req.on("close", () => { clearInterval(ping); if (!res.writableEnded) res.end(); });

    } else {
      res.writeHead(400); res.end("Bad request");
    }
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[intent2app] Port ${port} already in use — server is already running.`);
      process.exit(0); // clean exit; existing instance is serving
    } else {
      console.error(`[intent2app] HTTP server error:`, err);
      process.exit(1);
    }
  });

  httpServer.listen(port, "127.0.0.1", () => {
    console.error(`[intent2app] HTTP MCP server ready — http://localhost:${port}/mcp — ${allTools.length} tools`);
  });

// ── stdio mode (default) ────────────────────────────────────────────────────
} else {
  const srv = buildMcpServer();
  const transport = new StdioServerTransport();
  await srv.connect(transport);
  // stdout is reserved for JSON-RPC; log to stderr only.
  console.error(`[intent2app] MCP server ready — ${allTools.length} tools: ${allTools.map((t) => t.name).join(", ")}`);
}
