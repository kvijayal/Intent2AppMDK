// MDK utility functions — mirrors SAP/mdk-mcp-server src/utils.ts + cf-auth.ts (Apache-2.0)
// Used by all 5 MDK tools (mdk-create, mdk-gen, mdk-manage, mdk-docs, mdk-fetch-mobile-metadata)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// mcp-server root is one level up from lib/
const serverRoot = path.resolve(__dirname, "..");
// Intent2App project root is one level up from mcp-server/
const projectRoot = path.resolve(serverRoot, "..");

// ── MDK tools path resolver (mirrors getModulePath in utils.ts) ───────────────

export async function getMdkToolsPath() {
  // Check local node_modules first
  const candidates = [
    path.join(serverRoot, "node_modules", "@sap", "mdk-tools"),
    path.join(path.dirname(serverRoot), "mdk-tools"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const libPath = path.join(p, "lib");
      const binPath = path.join(p, "bin");
      if (process.platform === "win32") {
        return fs.existsSync(binPath) ? binPath : fs.existsSync(libPath) ? libPath : p;
      } else {
        return fs.existsSync(libPath) ? libPath : fs.existsSync(binPath) ? binPath : p;
      }
    }
  }
  return "";
}

export async function getMdkGeneratorPath() {
  const candidates = [
    path.join(serverRoot, "node_modules", "@sap", "generator-mdk"),
    path.join(path.dirname(serverRoot), "generator-mdk"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "";
}

export function getMdkBinary(mdkToolsPath) {
  if (!mdkToolsPath) return null;
  return path.join(mdkToolsPath, process.platform === "win32" ? "mdkcli.cmd" : "mdkcli.js");
}

// ── Schema version (mirrors getSchemaVersion in utils.ts) ────────────────────

export function getSchemaVersion(folderRootPath) {
  try {
    // First check Application.app in the project itself
    const appFile = path.join(folderRootPath, "Application.app");
    if (fs.existsSync(appFile)) {
      const content = JSON.parse(fs.readFileSync(appFile, "utf-8"));
      if (content._SchemaVersion) return content._SchemaVersion;
    }
    // Check .project.json
    const projectJson = path.join(folderRootPath, ".project.json");
    if (fs.existsSync(projectJson)) {
      const content = JSON.parse(fs.readFileSync(projectJson, "utf-8"));
      if (content.SchemaVersion) return content.SchemaVersion;
    }
  } catch { /**/ }
  return "26.6"; // server default
}

export function getServerSchemaVersion() {
  try {
    const pkgPath = path.join(serverRoot, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.mdkConfig?.schemaVersion || "26.6";
  } catch { return "26.6"; }
}

// ── Service metadata helpers (mirrors getServiceDataWithFallback) ─────────────

export function readServiceMetadata(folderRootPath) {
  const metaPath = path.join(folderRootPath, ".service.metadata");
  if (!fs.existsSync(metaPath)) return null;
  try { return JSON.parse(fs.readFileSync(metaPath, "utf-8")); } catch { return null; }
}

export function getMobileServiceAppName(folderRootPath) {
  const meta = readServiceMetadata(folderRootPath);
  if (meta?.mobile?.app) return meta.mobile.app;
  // Fallback: read MobileService.AppId from .project.json
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(folderRootPath, ".project.json"), "utf-8"));
    if (cfg.MobileService?.AppId) return cfg.MobileService.AppId;
  } catch { /**/ }
  return null;
}

export function getServiceDataWithFallback(folderRootPath, oDataEntitySets) {
  const meta = readServiceMetadata(folderRootPath);
  if (meta?.mobile?.destinations?.[0]) {
    const dest = meta.mobile.destinations[0];
    const servicePath = path.join(folderRootPath, "Services", dest.name + ".service");
    return { serviceData: dest.metadata.odataContent || "", servicePath };
  }
  // Fallback: read Services/*.xml
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(folderRootPath, ".project.json"), "utf-8"));
    const destName = cfg.CF?.Deploy?.Destination?.[0]?.MDK || cfg.CF?.Deploy?.Destination?.MDK;
    if (destName) {
      const xmlPath = path.join(folderRootPath, "Services", `.${destName.replaceAll(".", "_")}.xml`);
      if (fs.existsSync(xmlPath)) {
        return {
          serviceData: fs.readFileSync(xmlPath, "utf-8"),
          servicePath: path.join(folderRootPath, "Services", destName + ".service")
        };
      }
    }
  } catch { /**/ }
  return null;
}

// ── CAP project detection (mirrors cap-utils.ts) ─────────────────────────────

export function isCapProject(projectPath) {
  const pathParts = projectPath.split(path.sep);
  const appIdx = pathParts.lastIndexOf("app");
  const checkPath = appIdx > 0 ? pathParts.slice(0, appIdx).join(path.sep) : projectPath;
  if (fs.existsSync(path.join(checkPath, ".cdsrc.json"))) return { isCap: true, capRoot: checkPath };
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(checkPath, "package.json"), "utf-8"));
    if (pkg.dependencies?.["@sap/cds"] || pkg.devDependencies?.["@sap/cds"]) {
      return { isCap: true, capRoot: checkPath };
    }
  } catch { /**/ }
  return { isCap: false, capRoot: null };
}

export function resolveMdkProjectPath(folderRootPath) {
  const { isCap, capRoot } = isCapProject(folderRootPath);
  if (isCap && capRoot) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(capRoot, "package.json"), "utf-8"));
      const name = (pkg.name || path.basename(capRoot)).replace(/-/g, "_");
      const mdkPath = path.join(capRoot, "app", `${name}_mdk`);
      fs.mkdirSync(mdkPath, { recursive: true });
      return mdkPath;
    } catch { /**/ }
  }
  return folderRootPath;
}

// ── CF auth (mirrors cf-auth.ts) ──────────────────────────────────────────────

export function getCFConfig() {
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), ".cf", "config.json"), "utf-8");
    const c = JSON.parse(raw);
    if (!c.AccessToken || !c.Target || !c.OrganizationFields?.GUID || !c.SpaceFields?.GUID) return null;
    return c;
  } catch { return null; }
}

export function isCFLoggedIn() {
  try { execSync("cf target", { stdio: "pipe", encoding: "utf-8" }); return true; } catch { return false; }
}

export function refreshCFToken() {
  try { execSync("cf oauth-token", { stdio: "pipe", encoding: "utf-8" }); return true; } catch { return false; }
}

export function getMobileServicesAdminAPI(landscapeType = "Standard") {
  const c = getCFConfig();
  if (!c) return null;
  let host = c.Target.replace(/^https?:\/\//, "");
  if (host.startsWith("api.cf.")) host = host.substring(7);
  host = host.split(":")[0].replace(/\/$/, "");
  const sub = landscapeType === "Preview" ? "mobile-service-cockpit-api-preview" : "mobile-service-cockpit-api";
  return `https://${sub}.cfapps.${host}/cockpit/v1/org/${encodeURIComponent(c.OrganizationFields.GUID)}/space/${encodeURIComponent(c.SpaceFields.GUID)}`;
}

export function getCFToken() {
  return getCFConfig()?.AccessToken || null;
}

export function getCFAuthErrorMessage() {
  return `# Cloud Foundry Authentication Required

You have **two options** to authenticate:

## Option 1: Use VS Code Command Palette (Recommended)
1. Press **\`Cmd+Shift+P\`** (Mac) or **\`Ctrl+Shift+P\`** (Windows/Linux)
2. Type: **\`CF: Login to Cloud Foundry\`**
3. Press **Enter**
4. Follow the prompts in the Cloud Foundry Tools extension

## Option 2: Use Terminal
\`\`\`bash
cf login --sso
\`\`\`

After completing authentication with either option, retry the deployment.`;
}

// ── Command runner (mirrors runCommand in utils.ts) ───────────────────────────

export function runCommand(command, options = {}) {
  console.error(`[MDK MCP Server] Executing: ${command}`);
  try {
    let timeout = options.timeout || 60000;
    if (command.includes("deploy") || command.includes("build")) timeout = 300000;
    if (command.includes("validate")) timeout = 900000;
    if (command.includes("yo ") || command.includes("bunx yo")) timeout = 300000;

    const output = execSync(command, {
      cwd: options.cwd,
      env: process.env,
      stdio: "pipe",
      encoding: "utf-8",
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      ...(process.platform === "win32" ? { shell: true } : {})
    });
    console.error(`[MDK MCP Server] Command completed`);
    return output.toString();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MDK MCP Server] Command failed: ${msg}`);
    throw new Error(`Command failed: ${command}\n${msg}`);
  }
}

// ── Paths for res/ folder (schemas and templates) ────────────────────────────

export function getResPath() {
  // Try local mcp-server/res first, then @sap/mdk-mcp-server package res/
  const localRes = path.join(serverRoot, "res");
  if (fs.existsSync(localRes)) return localRes;
  // Try finding installed @sap/mdk-mcp-server
  const pkgRes = path.join(serverRoot, "node_modules", "@sap", "mdk-mcp-server", "res");
  if (fs.existsSync(pkgRes)) return pkgRes;
  return localRes; // return expected path even if missing
}

export function getTemplatesPath() { return path.join(getResPath(), "templates"); }
export function getSchemasPath()   { return path.join(getResPath(), "schemas"); }
