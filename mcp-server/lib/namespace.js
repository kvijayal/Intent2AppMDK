// Namespace consistency — the #1 cause of UI5 "failed to load Component.js".
// The same namespace string must appear in all four places, and ui5.yaml must be lowercase.
import path from "node:path";
import { exists, readText, writeText, walk } from "./fs-utils.js";

// ui5.yaml metadata.name rule: lowercase a-z, 0-9, dash, dot (must start with a letter).
const UI5YAML_NAME_RE = /^[a-z][a-z0-9_.-]*$/;

/** Locate the namespace value declared in each of the four canonical places. */
export async function findNamespaceSources(appDir) {
  const result = {};
  const files = await walk(appDir);

  for (const f of ["ui5.yaml", "ui5-local.yaml", "ui5-mock.yaml"]) {
    const p = path.join(appDir, f);
    if (await exists(p)) {
      const m = (await readText(p)).match(/metadata:\s*[\r\n]+\s*name:\s*["']?([^"'\r\n#]+)/);
      if (m) { result.ui5Yaml = { file: f, value: m[1].trim() }; break; }
    }
  }

  const manifest = files.find((f) => f.endsWith("manifest.json"));
  if (manifest) {
    try {
      const j = JSON.parse(await readText(manifest));
      if (j["sap.app"]?.id) result.manifest = { file: path.relative(appDir, manifest), value: j["sap.app"].id };
    } catch { /* ignore malformed manifest */ }
  }

  const indexHtml = files.find((f) => f.endsWith("index.html"));
  if (indexHtml) {
    const m = (await readText(indexHtml)).match(/data-sap-ui-resource-roots\s*=\s*'(\{[^']+\})'/);
    if (m) {
      try {
        const obj = JSON.parse(m[1]);
        const k = Object.keys(obj)[0];
        if (k) result.indexHtml = { file: path.relative(appDir, indexHtml), value: k };
      } catch { /* ignore */ }
    }
  }

  const comp = files.find((f) => /Component\.(t|j)s$/.test(f));
  if (comp) {
    const txt = await readText(comp);
    const m =
      txt.match(/@namespace\s+([A-Za-z0-9_.]+)/) ||
      txt.match(/extend\(\s*["']([A-Za-z0-9_.]+)\.Component["']/);
    if (m) result.component = { file: path.relative(appDir, comp), value: m[1] };
  }

  return result;
}

/** Cross-check all four places and the lowercase rule. */
export async function validateNamespace(appDir) {
  const src = await findNamespaceSources(appDir);
  const sources = Object.entries(src).map(([where, v]) => ({ where, ...v }));
  const values = [...new Set(sources.map((s) => s.value))];
  const issues = [];

  if (sources.length < 2) {
    issues.push("Could not locate enough namespace sources to cross-check (need at least ui5.yaml + manifest.json).");
  }
  if (values.length > 1) {
    issues.push(`Namespace MISMATCH across files: ${values.map((v) => `"${v}"`).join("  ≠  ")}. Make all four identical.`);
  }
  if (src.ui5Yaml && !UI5YAML_NAME_RE.test(src.ui5Yaml.value)) {
    issues.push(`ui5.yaml metadata.name must be all lowercase (a-z, 0-9, dash, dot): got "${src.ui5Yaml.value}".`);
  }

  return { pass: issues.length === 0, namespace: values[0] || null, sources, issues };
}

/** Rewrite a starter's base namespace to the target across all text files (dotted + slash form). */
export async function rewriteNamespace(appDir, fromNs, toNs) {
  const fromPath = fromNs.replace(/\./g, "/");
  const toPath = toNs.replace(/\./g, "/");
  const files = await walk(appDir);
  const changed = [];
  for (const f of files) {
    if (!/\.(json|js|ts|xml|html|ya?ml|cds|properties|md)$/.test(f)) continue;
    let s = await readText(f);
    if (s.includes(fromNs) || s.includes(fromPath)) {
      s = s.split(fromNs).join(toNs).split(fromPath).join(toPath);
      await writeText(f, s);
      changed.push(path.relative(appDir, f));
    }
  }
  return changed;
}
