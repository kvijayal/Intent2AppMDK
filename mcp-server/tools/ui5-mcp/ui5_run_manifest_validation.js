// Replicated from https://github.com/UI5/mcp-server (Apache-2.0)
import path from "node:path";
import { readText, exists } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

const MIN_MANIFEST_VERSION = [1, 48, 1];

function semverGte(ver, min) {
  const parse = (s) => String(s).split(".").map(Number);
  const a = parse(ver), b = min;
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > b[i]) return true;
    if ((a[i] || 0) < b[i]) return false;
  }
  return true;
}

function isSemver(s) {
  return /^\d+\.\d+\.\d+$/.test(String(s));
}

function checkManifest(m, filePath) {
  const errors = [];
  const warnings = [];
  const info = [];

  // ── _version ──────────────────────────────────────────────────────────────
  if (!m._version) {
    errors.push({ rule: "missing_version", message: "Missing '_version' field. Add e.g. \"_version\": \"1.84.0\"" });
  } else if (typeof m._version !== "string" || !isSemver(m._version)) {
    errors.push({ rule: "invalid_version", message: `'_version' must be a semver string (got '${m._version}')` });
  } else if (!semverGte(m._version, MIN_MANIFEST_VERSION)) {
    errors.push({ rule: "version_too_old", message: `Manifest version '${m._version}' is below the minimum supported 1.48.1` });
  } else {
    info.push({ rule: "version_ok", message: `_version '${m._version}' is valid` });
  }

  // ── sap.app ───────────────────────────────────────────────────────────────
  const app = m["sap.app"];
  if (!app) {
    errors.push({ rule: "missing_sap_app", message: "Missing 'sap.app' section" });
  } else {
    if (!app.id)   errors.push({ rule: "missing_id",   message: "sap.app.id is required" });
    else {
      if (!/^[a-z][0-9a-z.]*$/i.test(app.id))
        warnings.push({ rule: "id_case", message: `sap.app.id '${app.id}' should be all lowercase (a-z, 0-9, dot)` });
      else
        info.push({ rule: "id_ok", message: `sap.app.id '${app.id}' looks valid` });
    }
    if (!app.type)  errors.push({ rule: "missing_type", message: "sap.app.type is required (application|library|component|card)" });
    if (!app.applicationVersion?.version)
      errors.push({ rule: "missing_app_version", message: "sap.app.applicationVersion.version is required" });
    if (!app.title && !app.i18n)
      warnings.push({ rule: "no_title", message: "sap.app.title is missing — prefer '{{appTitle}}' bound via i18n" });
  }

  // ── sap.ui ────────────────────────────────────────────────────────────────
  const ui = m["sap.ui"];
  if (!ui) {
    warnings.push({ rule: "missing_sap_ui", message: "Missing 'sap.ui' section" });
  } else if (ui.technology !== "UI5") {
    errors.push({ rule: "wrong_technology", message: `sap.ui.technology must be 'UI5' (got '${ui.technology}')` });
  }

  // ── sap.ui5 ───────────────────────────────────────────────────────────────
  const ui5 = m["sap.ui5"];
  if (!ui5) {
    warnings.push({ rule: "missing_sap_ui5", message: "Missing 'sap.ui5' section" });
  } else {
    if (!ui5.dependencies?.minUI5Version)
      warnings.push({ rule: "missing_min_version", message: "sap.ui5.dependencies.minUI5Version is missing — set to '1.120.0' or higher" });

    // Routing checks
    const targets = ui5.routing?.targets || {};
    for (const [tName, tConf] of Object.entries(targets)) {
      const settings = tConf?.options?.settings || tConf?.settings || {};
      if (settings.entitySet)
        warnings.push({ rule: "deprecated_entitySet", message: `Target '${tName}': 'entitySet' is deprecated — replace with 'contextPath'` });
      if (tConf.type === "Component" && !settings.contextPath && tConf.name?.startsWith("sap.fe."))
        warnings.push({ rule: "missing_contextPath", message: `Target '${tName}': 'contextPath' is required for Fiori Elements targets` });
    }

    // OData model check
    const defaultModel = ui5.models?.[""];
    if (defaultModel) {
      if (defaultModel.settings?.odataVersion && defaultModel.settings.odataVersion !== "4.0")
        errors.push({ rule: "wrong_odata_version", message: `Default model odataVersion is '${defaultModel.settings.odataVersion}' — must be '4.0' (OData V4 only)` });
      if (defaultModel.type === "sap.ui.model.odata.v2.ODataModel")
        errors.push({ rule: "v2_model", message: "OData V2 model detected — use sap.ui.model.odata.v4.ODataModel (HARD CONSTRAINT)" });
    }

    // Namespace consistency: rootView vs sap.app.id
    const rootViewName = ui5.rootView?.viewName || "";
    if (app?.id && rootViewName && !rootViewName.startsWith(app.id))
      warnings.push({ rule: "namespace_mismatch", message: `rootView '${rootViewName}' does not start with sap.app.id '${app.id}' — namespace mismatch` });
  }

  return {
    file:     filePath,
    valid:    errors.length === 0,
    errors,
    warnings,
    info,
    summary:  `${errors.length} error(s), ${warnings.length} warning(s)`
  };
}

export default {
  name: "ui5_run_manifest_validation",
  description:
    "Validate a UI5 manifest.json file — checks _version, sap.app (id, type, applicationVersion), sap.ui (technology), sap.ui5 (minUI5Version, routing contextPath, OData V4 model, namespace consistency). Run after any manifest edit.",
  inputSchema: {
    type: "object",
    properties: {
      manifestPath: {
        type: "string",
        description: "Absolute path to manifest.json, or to the project directory (will append webapp/manifest.json automatically)"
      }
    },
    required: ["manifestPath"]
  },
  async handler({ manifestPath } = {}) {
    if (!manifestPath) return errText("manifestPath is required");

    let resolved = path.resolve(manifestPath);
    // If a directory was passed, try the standard location.
    if (await exists(resolved) && !(await exists(path.join(resolved, "_version")))) {
      for (const sub of ["webapp/manifest.json", "manifest.json"]) {
        const candidate = path.join(resolved, sub);
        if (await exists(candidate)) { resolved = candidate; break; }
      }
    }

    if (!(await exists(resolved))) return errText(`manifest.json not found: ${resolved}`);

    let manifest;
    try {
      manifest = JSON.parse(await readText(resolved));
    } catch (e) {
      return errText(`Invalid JSON in ${resolved}: ${e.message}`);
    }

    const result = checkManifest(manifest, resolved);
    return okText(JSON.stringify(result, null, 2));
  }
};
