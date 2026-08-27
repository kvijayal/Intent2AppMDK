// Checks MDK VS Code extension settings in .vscode/settings.json.
// Key check: mdk.bundlerExternals — must include all NativeScript packages
// used by the app or deploy will fail / app will crash on device.
// The real SAP mdk-mcp-server (Apache-2.0) reads this automatically during deploy:
//   settings["mdk.bundlerExternals"] → passed as --externals to mdkcli deploy
// Source: SAP/mdk-mcp-server src/index.ts (Apache-2.0)
import path from "node:path";
import { promises as fs } from "node:fs";
import { exists, readText, writeText } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";

// Full known MDK extension packages that need to be in bundlerExternals
// when the app uses those capabilities.
const KNOWN_MDK_EXTERNALS = [
  "nativescript-speech-recognition",
  "@nativescript/geolocation",
  "extension-LocationService",
  "extension-GenericWebView",
  "extension-SAMFoundation",
  "extension-MapAuthenticator",
  "extension-SAPScannerFramework",
  "uuid",
  "@nstudio/nativescript-dynatrace",
  "@nativescript/core/accessibility",
  "xml-js",
  "stream",
  "buffer",
  "emitter",
  "nativescript-qr-generator",
  "@nativescript/core/timer"
];

// Minimal recommended set for any MDK app
const RECOMMENDED_EXTERNALS = [
  "@nativescript/geolocation",
  "extension-LocationService",
  "extension-GenericWebView",
  "uuid",
  "stream",
  "buffer"
];

async function readVSCodeSettings(projectDir) {
  const settingsPath = path.join(projectDir, ".vscode", "settings.json");
  if (!(await exists(settingsPath))) return null;
  try {
    // Strip JSONC comments before parsing
    let raw = await readText(settingsPath);
    raw = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(raw);
  } catch { return null; }
}

async function writeVSCodeSettings(projectDir, settings) {
  const vscodePath = path.join(projectDir, ".vscode");
  await fs.mkdir(vscodePath, { recursive: true });
  await writeText(path.join(vscodePath, "settings.json"), JSON.stringify(settings, null, 2));
}

export default {
  name: "mdk_check_settings",
  description:
    "Checks the mdk.bundlerExternals setting in .vscode/settings.json. " +
    "This setting lists NativeScript packages that must be excluded from the MDK bundle " +
    "and loaded at runtime — missing entries cause deploy failures or device crashes. " +
    "The real SAP mdk-mcp-server reads this file automatically during deploy. " +
    "Operations: check (validate current settings), update (write recommended list), " +
    "add-externals (append specific packages to existing list).",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: {
        type: "string",
        description: "Absolute path to the MDK project root."
      },
      operation: {
        type: "string",
        enum: ["check", "update", "add-externals"],
        default: "check",
        description: "check: read and validate. update: write recommended externals. add-externals: append specific packages."
      },
      externalsToAdd: {
        type: "array",
        items: { type: "string" },
        description: "For 'add-externals': packages to add (e.g. ['@nativescript/geolocation', 'uuid'])."
      },
      useFullList: {
        type: "boolean",
        default: false,
        description: "For 'update': use full known list (16 packages) instead of minimal recommended set (6 packages)."
      }
    },
    required: ["projectDir"]
  },

  async handler({ projectDir, operation = "check", externalsToAdd = [], useFullList = false } = {}) {
    if (!projectDir) return errText("projectDir is required.");
    if (!(await exists(projectDir))) return errText(`Project directory not found: ${projectDir}`);

    const settingsPath = path.join(projectDir, ".vscode", "settings.json");
    const settings = await readVSCodeSettings(projectDir);
    const currentExternals = settings?.["mdk.bundlerExternals"] || [];

    if (operation === "check") {
      const missing = RECOMMENDED_EXTERNALS.filter(e => !currentExternals.includes(e));
      const status = !settings ? "missing"
        : !currentExternals.length ? "empty"
        : missing.length > 0 ? "incomplete"
        : "ok";

      return jsonText({
        settingsPath,
        status,
        currentExternals,
        missingRecommended: missing,
        knownExternals: KNOWN_MDK_EXTERNALS,
        allOtherSettings: settings
          ? Object.fromEntries(Object.entries(settings).filter(([k]) => k !== "mdk.bundlerExternals"))
          : null,
        summary:
          status === "ok"
            ? `✅ mdk.bundlerExternals configured — ${currentExternals.length} packages.`
            : status === "missing"
            ? `❌ .vscode/settings.json not found.\n   Run with operation: "update" to create it with recommended externals.`
            : status === "empty"
            ? `❌ mdk.bundlerExternals is empty.\n   Run with operation: "update" to set recommended packages.`
            : `⚠️ mdk.bundlerExternals missing ${missing.length} recommended packages: ${missing.join(", ")}\n   Run with operation: "add-externals", externalsToAdd: ${JSON.stringify(missing)}`,
        why: `During deploy, mdk-mcp-server reads mdk.bundlerExternals from ${settingsPath} ` +
             `and passes them as --externals to mdkcli deploy. ` +
             `Missing entries cause bundle errors or runtime crashes on device.`
      });
    }

    if (operation === "update") {
      const toWrite = useFullList ? KNOWN_MDK_EXTERNALS : RECOMMENDED_EXTERNALS;
      const updated = { ...(settings || {}), "mdk.bundlerExternals": toWrite };
      await writeVSCodeSettings(projectDir, updated);
      return jsonText({
        settingsPath,
        written: true,
        externals: toWrite,
        summary: `✅ .vscode/settings.json updated — ${toWrite.length} bundler externals written.`,
        nextStep: `Run mdk_check_settings { operation: "check" } to verify, then deploy.`
      });
    }

    if (operation === "add-externals") {
      if (!externalsToAdd.length)
        return errText("externalsToAdd must be a non-empty array for operation 'add-externals'.");
      const existing = new Set(currentExternals);
      const added = [];
      for (const pkg of externalsToAdd) {
        if (!existing.has(pkg)) { existing.add(pkg); added.push(pkg); }
      }
      const updated = { ...(settings || {}), "mdk.bundlerExternals": [...existing] };
      await writeVSCodeSettings(projectDir, updated);
      return jsonText({
        settingsPath,
        written: true,
        added,
        alreadyPresent: externalsToAdd.filter(e => !added.includes(e)),
        fullList: [...existing],
        summary: added.length > 0
          ? `✅ Added ${added.length} packages: ${added.join(", ")}`
          : `ℹ️ All packages already present — nothing changed.`
      });
    }

    return errText(`Unknown operation: ${operation}. Valid: check, update, add-externals.`);
  }
};
