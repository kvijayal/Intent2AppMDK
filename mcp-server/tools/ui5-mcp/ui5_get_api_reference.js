// Replicated from https://github.com/UI5/mcp-server (Apache-2.0)
import path from "node:path";
import { readText, exists } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

const DEFAULT_VERSION = "1.120.0";
const API_BASE = (v) => `https://ui5.sap.com/${v}/docs/api`;

// Simple YAML value extractor — avoids a heavy yaml dep.
function extractYamlValue(yaml, key) {
  const m = new RegExp(`^\\s*${key}:\\s*(.+)`, "m").exec(yaml);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

async function getProjectVersion(projectDir) {
  for (const name of ["ui5-local.yaml", "ui5.yaml"]) {
    const p = path.join(projectDir, name);
    if (await exists(p)) {
      const yaml = await readText(p);
      const ver = extractYamlValue(yaml, "version");
      if (ver) return ver;
    }
  }
  try {
    const pkg = JSON.parse(await readText(path.join(projectDir, "package.json")));
    return pkg?.ui5?.framework?.version || null;
  } catch { return null; }
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Cache the API index in memory (large file — only load once per process).
const _indexCache = new Map();

async function searchIndex(version, query) {
  if (!_indexCache.has(version)) {
    const data = await fetchJson(`${API_BASE(version)}/api-index.json`);
    _indexCache.set(version, data?.symbols || data || []);
  }
  const symbols = _indexCache.get(version);
  const q = query.toLowerCase();
  return symbols
    .filter(s => s.name?.toLowerCase().includes(q) || s.module?.toLowerCase().includes(q))
    .slice(0, 20)
    .map(s => ({ name: s.name, kind: s.kind, lib: s.lib, visibility: s.visibility, deprecated: s.deprecated || false }));
}

export default {
  name: "ui5_get_api_reference",
  description:
    "Search the UI5 API reference for a control, module, or symbol. Provide a module path (e.g. 'sap.m.Button') for full detail, or a keyword for a list of matches. Optionally point to a projectDir so the query uses the project's own UI5 version.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Module path (e.g. 'sap.m.Button', 'sap.fe.templates.ListReport') or keyword (e.g. 'dialog', 'table')"
      },
      projectDir: {
        type: "string",
        description: "Path to the UI5 project — used to detect the UI5 version from ui5.yaml. If omitted, uses the Intent2App default version."
      },
      version: {
        type: "string",
        description: `Explicit UI5 version override (e.g. '1.136.0'). Overrides projectDir detection. Default: ${DEFAULT_VERSION}`
      }
    },
    required: ["query"]
  },
  async handler({ query, projectDir, version } = {}) {
    if (!query) return errText("query is required");

    let v = version;
    if (!v && projectDir) {
      v = await getProjectVersion(projectDir).catch(() => null);
    }
    v = v || DEFAULT_VERSION;

    // Looks like a full module path → fetch the symbol JSON directly.
    const looksLikePath = /^[a-z][a-z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){2,}$/.test(query);

    if (looksLikePath) {
      try {
        const symbolUrl = `${API_BASE(v)}/symbols/${encodeURIComponent(query)}.json`;
        const data = await fetchJson(symbolUrl);
        // Return a focused subset — full JSON can be 1 MB+
        const focused = {
          name:        data.name,
          kind:        data.kind,
          lib:         data.lib,
          visibility:  data.visibility,
          deprecated:  data.deprecated,
          description: (data.description || "").slice(0, 800),
          constructor: data.constructor ? {
            description: (data.constructor.description || "").slice(0, 400),
            parameters:  data.constructor.parameters || []
          } : undefined,
          properties: (data.properties || []).slice(0, 30).map(p => ({
            name: p.name, type: p.type, description: (p.description || "").slice(0, 200), deprecated: p.deprecated
          })),
          events: (data.events || []).slice(0, 20).map(e => ({
            name: e.name, description: (e.description || "").slice(0, 200), deprecated: e.deprecated
          })),
          methods: (data.methods || [])
            .filter(m => m.visibility === "public")
            .slice(0, 20)
            .map(m => ({ name: m.name, description: (m.description || "").slice(0, 200), returnValue: m.returnValue, deprecated: m.deprecated }))
        };
        return okText(JSON.stringify({ version: v, source: symbolUrl, symbol: focused }, null, 2));
      } catch (e) {
        // Fall through to index search if direct lookup fails
        console.error(`[ui5_get_api_reference] direct lookup failed for '${query}' v${v}: ${e.message}`);
      }
    }

    // Keyword search via the API index.
    try {
      const matches = await searchIndex(v, query);
      return okText(JSON.stringify({
        version: v,
        query,
        count: matches.length,
        note: matches.length === 0
          ? "No matches. Try a shorter keyword or a full module path (e.g. 'sap.m.Button')."
          : "Showing top matches. Use the module 'name' as the query for full symbol detail.",
        matches
      }, null, 2));
    } catch (e) {
      return errText(`CDN unreachable (v${v}): ${e.message}. Check network or try a different version.`);
    }
  }
};
