// MDK deploy tool — checks CF login, reads Mobile Services app + destination from
// .service.metadata automatically, validates, then deploys via mdkcli.
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import { exists, readText } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";

const exec = promisify(execCb);

async function isCFLoggedIn() {
  try {
    const { stdout } = await exec("cf target", { timeout: 10000 });
    return stdout.includes("org:");
  } catch { return false; }
}

async function getMdkBinary() {
  try { await exec("mdkcli --version", { timeout: 5000 }); return "mdkcli"; } catch { /**/ }
  try { await exec("npx @sap/mdk-tools --version", { timeout: 10000 }); return "npx @sap/mdk-tools"; } catch { /**/ }
  return null;
}

// Read appId and destination from .service.metadata
async function readServiceMetadata(projectDir) {
  const metaPath = path.join(projectDir, ".service.metadata");
  if (!(await exists(metaPath))) return null;
  try {
    const meta = JSON.parse(await readText(metaPath));
    const destinations = meta?.mobile?.destinations || [];
    return {
      appId: meta?.mobile?.app || null,
      destination: destinations[0]?.name || destinations[0]?.endPointName || null,
      allDestinations: destinations.map(d => d.name || d.endPointName).filter(Boolean)
    };
  } catch { return null; }
}

export default {
  name: "mdk_deploy_project",
  description:
    "Deploy an MDK project to SAP Mobile Services. " +
    "Automatically: 1) checks CF login, 2) reads Mobile Services app ID and destination from .service.metadata, " +
    "3) validates the project schema, 4) deploys and generates onboarding QR code at .build/qrcode.png. " +
    "CF login must be done in a terminal first (cf login --sso) — cannot be done inside Claude Code chat. " +
    ".service.metadata must exist (created via VS Code MDK extension or mdk_fetch_mobile_metadata tool).",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: {
        type: "string",
        description: "Absolute path to the MDK project root (folder containing .project.json)."
      },
      externals: {
        type: "string",
        description: "Optional comma-separated npm packages to bundle externally (e.g. '@nativescript/geolocation')."
      }
    },
    required: ["projectDir"]
  },

  async handler({ projectDir, externals } = {}) {
    if (!projectDir) return errText("projectDir is required.");
    if (!(await exists(projectDir))) return errText(`Project directory not found: ${projectDir}`);

    // ── Step 1: CF login check ───────────────────────────────────────────────
    const loggedIn = await isCFLoggedIn();
    if (!loggedIn) {
      return errText(
        `CF not logged in.\n\n` +
        `CF login requires a terminal — it cannot be done inside Claude Code chat.\n` +
        `Open a terminal and run:\n\n` +
        `  cf login -a https://api.cf.<region>.hana.ondemand.com --sso\n\n` +
        `Common regions:\n` +
        `  EU Frankfurt:  api.cf.eu10.hana.ondemand.com\n` +
        `  US East:       api.cf.us10.hana.ondemand.com\n` +
        `  AP Tokyo:      api.cf.jp10.hana.ondemand.com\n` +
        `  AP Singapore:  api.cf.ap10.hana.ondemand.com\n\n` +
        `Or: VS Code → Cmd+Shift+P → "CF: Login to Cloud Foundry"\n\n` +
        `Then retry.`
      );
    }

    // ── Step 2: Read .service.metadata — auto-discover app + destination ────
    const meta = await readServiceMetadata(projectDir);
    if (!meta) {
      return errText(
        `.service.metadata not found in ${projectDir}\n\n` +
        `This file links the MDK project to your Mobile Services app and is required for deploy.\n\n` +
        `Create it via either:\n` +
        `  1. VS Code → Cmd+Shift+P → "MDK: Open Mobile App Editor"\n` +
        `     → select or create your Mobile Services app → "Add App to Project"\n` +
        `  2. mdk_fetch_mobile_metadata tool:\n` +
        `     First run mdk_list_mobile_apps to see available apps,\n` +
        `     then mdk_fetch_mobile_metadata { appId, destination, folderRootPath }`
      );
    }

    const { appId, destination, allDestinations } = meta;

    // ── Step 3: Check MDK CLI ────────────────────────────────────────────────
    const bin = await getMdkBinary();
    if (!bin) {
      return errText(
        `MDK CLI not found.\n\nInstall with:\n  npm install -g @sap/mdk-tools\n\nThen retry.`
      );
    }

    // ── Step 4: Validate before deploy ──────────────────────────────────────
    try {
      const { stdout: vOut, stderr: vErr } = await exec(
        `${bin} validate --project "${projectDir}"`,
        { cwd: projectDir, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
      );
      const vResult = (vOut + vErr).trim();
      const hasErrors = /error/i.test(vResult) && !/0 errors/i.test(vResult);
      if (hasErrors) {
        return jsonText({
          pass: false,
          step: "validate",
          output: vResult,
          hint: "Fix all validation errors before deploying. Run mdk_validate_project for details."
        });
      }
    } catch (ve) {
      return errText(`Validation step failed: ${ve.message}\n\nFix validation errors first.`);
    }

    // ── Step 5: Deploy ───────────────────────────────────────────────────────
    // Auto-read mdk.bundlerExternals from .vscode/settings.json if externals not passed
    // (same as real SAP mdk-mcp-server behaviour)
    let resolvedExternals = externals ? externals.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (!resolvedExternals.length) {
      try {
        const settingsFile = path.join(projectDir, ".vscode", "settings.json");
        let raw = await readText(settingsFile);
        raw = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
        const vsSettings = JSON.parse(raw);
        if (Array.isArray(vsSettings["mdk.bundlerExternals"])) {
          resolvedExternals = vsSettings["mdk.bundlerExternals"];
          process.stderr.write(
            `[mdk_deploy] Using ${resolvedExternals.length} externals from .vscode/settings.json\n`
          );
        }
      } catch { /* no settings file — proceed without externals */ }
    }
    const extStr = resolvedExternals.length ? `--externals "${resolvedExternals.join(",")}"` : "";
    try {
      const { stdout, stderr } = await exec(
        `${bin} deploy --target mobile --showqr --project "${projectDir}" ${extStr}`.trim(),
        { cwd: projectDir, timeout: 300000, maxBuffer: 8 * 1024 * 1024 }
      );
      const output = (stdout + stderr).trim();

      return jsonText({
        pass: true,
        projectDir,
        appId,
        destination,
        allDestinations,
        qrCode: `${projectDir}/.build/qrcode.png`,
        output,
        summary: [
          `✓ Validated and deployed to SAP Mobile Services`,
          appId      ? `  App ID:      ${appId}` : null,
          destination ? `  Destination: ${destination}` : null,
          `  QR code:     ${projectDir}/.build/qrcode.png`,
          ``,
          `Next steps:`,
          `  1. Open .build/qrcode.png in VS Code Explorer`,
          `  2. Scan with SAP Mobile Services Client on iOS or Android to onboard`
        ].filter(l => l !== null).join("\n")
      });

    } catch (e) {
      const output = ((e.stdout || "") + (e.stderr || "") + e.message).trim();
      const expired  = /not logged in|cf login|unauthorized/i.test(output);
      const notFound = /not found|404/i.test(output);

      return jsonText({
        pass: false,
        step: "deploy",
        projectDir,
        appId,
        destination,
        output,
        hint: expired
          ? "CF session expired. Open a terminal: cf login -a https://api.cf.<region>.hana.ondemand.com --sso"
          : notFound
          ? `Mobile Services app "${appId}" not found. Run mdk_list_mobile_apps to verify available apps in your org/space.`
          : "Deploy failed — see output above for details."
      });
    }
  }
};
