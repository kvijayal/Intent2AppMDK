// Shared Mobile Services API client — uses Node.js built-in fetch (Node >= 22).
// No curl, no subprocess, no bash commands visible to the user.
// Mirrors the patterns from SAP/mdk-mcp-server src/mobile-services-client.ts (Apache-2.0)
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";

const exec = promisify(execCb);

// ── CF config ─────────────────────────────────────────────────────────────────

export async function getCFConfig() {
  try {
    const raw = await fs.readFile(
      path.join(os.homedir(), ".cf", "config.json"), "utf-8"
    );
    const c = JSON.parse(raw);
    if (!c.AccessToken || !c.Target ||
        !c.OrganizationFields?.GUID || !c.SpaceFields?.GUID) return null;
    return c;
  } catch { return null; }
}

export async function refreshCFToken() {
  try { await exec("cf oauth-token", { timeout: 15000 }); return true; }
  catch { return false; }
}

export function getMobileServicesAdminAPI(config, landscapeType = "Standard") {
  let host = config.Target.replace(/^https?:\/\//, "");
  if (host.startsWith("api.cf.")) host = host.substring(7);
  host = host.split(":")[0].replace(/\/$/, "");
  const sub = landscapeType === "Preview"
    ? "mobile-service-cockpit-api-preview"
    : "mobile-service-cockpit-api";
  const org   = encodeURIComponent(config.OrganizationFields.GUID);
  const space = encodeURIComponent(config.SpaceFields.GUID);
  return `https://${sub}.cfapps.${host}/cockpit/v1/org/${org}/space/${space}`;
}

export function getCFAuthErrorMessage() {
  return [
    `# Cloud Foundry Authentication Required`,
    ``,
    `Option 1 — VS Code Command Palette:`,
    `  Cmd+Shift+P → "CF: Login to Cloud Foundry"`,
    ``,
    `Option 2 — Terminal:`,
    `  cf login -a https://api.cf.<region>.hana.ondemand.com --sso`,
    `  Regions: eu10 · us10 · jp10 · ap10`,
  ].join("\n");
}

// ── HTTP helpers using Node built-in fetch ────────────────────────────────────

function baseHeaders(cfToken) {
  return {
    "Authorization": cfToken,
    "X-Requested-With": "application/json",
    "Accept": "application/json"
  };
}

export async function apiGet(adminAPI, cfToken, urlPath) {
  const res = await fetch(`${adminAPI}${urlPath}`, {
    method: "GET",
    headers: baseHeaders(cfToken)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), {
      status: res.status, body
    });
  }
  return res.json();
}

export async function apiPost(adminAPI, cfToken, urlPath, body) {
  const res = await fetch(`${adminAPI}${urlPath}`, {
    method: "POST",
    headers: { ...baseHeaders(cfToken), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`), {
      status: res.status, body: text
    });
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ── Conduit pattern for metadata fetch ───────────────────────────────────────
// Mirrors mobile-services-client.ts fetchMetadata() conduit pattern

export async function fetchMetadataViaConduit(adminAPI, cfToken, appId, endpointAddress, pathSuffix = "") {
  const metadataUrl = endpointAddress + pathSuffix + "/$metadata";
  const conduit = { appId, encapsulateResponse: true, method: "GET", url: metadataUrl };
  const conduitBody = Buffer.from(JSON.stringify(conduit)).toString("base64");

  const res = await fetch(
    `${adminAPI}/app/${appId}/service/proxy/Admin/proxy/v1/conduitWithHeaderContent`,
    {
      method: "GET",
      headers: {
        "Authorization": cfToken,
        "X-SMP-CONDUIT-REQ-BODY": conduitBody,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/xml"
      }
    }
  );

  if (!res.ok) throw new Error(`Conduit HTTP ${res.status}`);
  const response = await res.json();
  if (response.status?.code === 200 && response.bodyBase64) {
    return Buffer.from(response.bodyBase64, "base64").toString("utf-8");
  }
  throw new Error(`Conduit response status: ${response.status?.code} — ${JSON.stringify(response.status)}`);
}

// ── Common Mobile Services operations ────────────────────────────────────────

export async function listApplications(adminAPI, cfToken) {
  const apps = await apiGet(adminAPI, cfToken, "/apps");
  const list = Array.isArray(apps) ? apps : (apps.apps || []);
  return list.filter(app =>
    Array.isArray(app.services) && app.services.some(s => s.name === "proxy")
  );
}

export async function getDestinations(adminAPI, cfToken, appId) {
  const app = await apiGet(adminAPI, cfToken, `/app/${appId}`);
  const proxy = app.services?.find(s => s.name === "proxy");
  return proxy?.parameters?.endpointConfigurations || [];
}

// ── Auth helper: get config + refresh token in one call ──────────────────────

export async function getAuthContext(landscapeType = "Standard") {
  let config = await getCFConfig();
  if (!config) return { error: getCFAuthErrorMessage() };
  await refreshCFToken();
  config = await getCFConfig(); // re-read after refresh
  return {
    config,
    cfToken: config.AccessToken,
    adminAPI: getMobileServicesAdminAPI(config, landscapeType)
  };
}
