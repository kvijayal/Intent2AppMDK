// Replicated from https://github.com/UI5/mcp-server (Apache-2.0)
import path from "node:path";
import { readText, exists } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

function extractYamlValue(yaml, key) {
  const m = new RegExp(`^\\s*${key}:\\s*(.+)`, "m").exec(yaml);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

function extractYamlList(yaml, section) {
  // Grabs simple "- name: X" list items under a section heading.
  const secIdx = yaml.indexOf(`${section}:`);
  if (secIdx === -1) return [];
  const block = yaml.slice(secIdx);
  const libs = [];
  for (const match of block.matchAll(/^\s+-\s+name:\s+(.+)/gm)) {
    libs.push(match[1].trim().replace(/^['"]|['"]$/g, ""));
    if (libs.length >= 30) break;
  }
  return libs;
}

async function parseUi5Yaml(dir) {
  for (const name of ["ui5-local.yaml", "ui5.yaml"]) {
    const p = path.join(dir, name);
    if (!(await exists(p))) continue;
    const yaml = await readText(p);
    return {
      file:         name,
      specVersion:  extractYamlValue(yaml, "specVersion"),
      name:         extractYamlValue(yaml, "name"),
      type:         extractYamlValue(yaml, "type"),
      frameworkName: extractYamlValue(yaml, "name") && yaml.includes("framework:") ? extractYamlValue(yaml.slice(yaml.indexOf("framework:")), "name") : null,
      frameworkVersion: yaml.includes("framework:") ? extractYamlValue(yaml.slice(yaml.indexOf("framework:")), "version") : null,
      libraries:    extractYamlList(yaml, "libraries")
    };
  }
  return null;
}

async function parsePkg(dir) {
  const p = path.join(dir, "package.json");
  if (!(await exists(p))) return null;
  try {
    const pkg = JSON.parse(await readText(p));
    return {
      name:         pkg.name,
      version:      pkg.version,
      sapuxLayer:   pkg.sapuxLayer,
      ui5Framework: pkg.ui5?.framework?.name,
      ui5Version:   pkg.ui5?.framework?.version,
      scripts:      Object.keys(pkg.scripts || {}),
      hasCap:       !!(pkg.dependencies?.["@sap/cds"] || pkg.devDependencies?.["@sap/cds"]),
      hasUi5Cli:    !!(pkg.devDependencies?.["@ui5/cli"] || pkg.dependencies?.["@ui5/cli"]),
      hasCdsPluginUi5: !!(pkg.devDependencies?.["cds-plugin-ui5"] || pkg.dependencies?.["cds-plugin-ui5"])
    };
  } catch { return null; }
}

async function detectWebappDir(dir) {
  for (const candidate of ["webapp", "src/main/webapp", "WebContent", "src"]) {
    if (await exists(path.join(dir, candidate))) return candidate;
  }
  return null;
}

export default {
  name: "ui5_get_project_info",
  description:
    "Get metadata about a local UI5 project: framework name/version, libraries, project type, key scripts, and whether it is inside a CAP project. Reads ui5.yaml (or ui5-local.yaml) and package.json.",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: {
        type: "string",
        description: "Absolute path to the UI5 project directory (where ui5.yaml lives)"
      }
    },
    required: ["projectDir"]
  },
  async handler({ projectDir } = {}) {
    if (!projectDir) return errText("projectDir is required");
    const dir = path.resolve(projectDir);
    if (!(await exists(dir))) return errText(`Directory not found: ${dir}`);

    const [yaml, pkg, webappDir] = await Promise.all([
      parseUi5Yaml(dir),
      parsePkg(dir),
      detectWebappDir(dir)
    ]);

    const info = {
      projectDir: dir,
      webappDir,
      ui5Yaml:    yaml,
      package:    pkg,
      summary: {
        name:            yaml?.name || pkg?.name || path.basename(dir),
        type:            yaml?.type || "unknown",
        frameworkName:   yaml?.frameworkName || pkg?.ui5Framework || "SAPUI5",
        frameworkVersion: yaml?.frameworkVersion || pkg?.ui5Version || "(from ui5.yaml/package.json — not found)",
        libraries:       yaml?.libraries || [],
        isCapApp:        pkg?.hasCap || (await exists(path.join(dir, "..", "..", "srv"))) || (await exists(path.join(dir, "..", "srv"))),
        hasCdsPluginUi5: pkg?.hasCdsPluginUi5 || false,
        scripts:         pkg?.scripts || []
      }
    };

    return okText(JSON.stringify(info, null, 2));
  }
};
