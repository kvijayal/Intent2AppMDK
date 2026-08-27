#!/usr/bin/env node
// Auto-installing MCP server launcher — Windows compatible.
// Converts absolute paths to file:// URLs for ESM loader on Windows.
import { existsSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.join(__dirname, "node_modules");
const sdkEntry    = path.join(nodeModules, "@modelcontextprotocol", "sdk", "package.json");

// Install dependencies if SDK is missing
if (!existsSync(sdkEntry)) {
  process.stderr.write("[intent2app] Installing MCP server dependencies (first time)...\n");
  try {
    execSync("npm install --prefer-offline --no-audit --no-fund", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000
    });
    process.stderr.write("[intent2app] Dependencies installed.\n");
  } catch (e) {
    process.stderr.write(`[intent2app] npm install failed: ${e.message}\n`);
    process.stderr.write("[intent2app] Run manually: cd mcp-server && npm install\n");
    process.exit(1);
  }
}

// Hand off to the real server — use pathToFileURL for Windows compatibility
const indexPath = path.join(__dirname, "index.js");
const server = spawn(
  process.execPath,
  [indexPath, ...process.argv.slice(2)],
  { cwd: __dirname, stdio: "inherit" }
);

server.on("error", (e) => {
  process.stderr.write(`[intent2app] Server error: ${e.message}\n`);
  process.exit(1);
});

server.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.kill(sig));
}
