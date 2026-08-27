// MDK project context reader — reads .project.json and .service.metadata to extract
// app name, schema version, entity sets, and existing pages/actions structure.
import path from "node:path";
import { promises as fs } from "node:fs";
import { exists, readText } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";

async function countFiles(dir, ext) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries.filter(e => e.isFile() && e.name.endsWith(ext)).length;
  } catch { return 0; }
}

async function listEntities(serviceMetaPath) {
  try {
    const raw = await readText(serviceMetaPath);
    const data = JSON.parse(raw);
    return (data.entitySets || data.EntitySets || []).map(e => e.name || e.Name || e).filter(Boolean);
  } catch { return []; }
}

export default {
  name: "mdk_read_project_context",
  description:
    "Read an MDK project's configuration context — app name, schema version, OData service name, entity sets, and counts of existing pages/actions/rules/i18n keys. Call this before generating any MDK metadata to verify entity names and understand the current project state.",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: { type: "string", description: "Absolute path to the MDK project root." }
    },
    required: ["projectDir"]
  },
  async handler({ projectDir } = {}) {
    if (!projectDir) return errText("projectDir is required");
    if (!(await exists(projectDir))) return errText(`Project directory not found: ${projectDir}`);

    const projectJsonPath = path.join(projectDir, ".project.json");
    if (!(await exists(projectJsonPath)))
      return errText(`.project.json not found in ${projectDir}. Is this an MDK project root?`);

    let projectJson = {};
    try { projectJson = JSON.parse(await readText(projectJsonPath)); } catch {}

    const serviceMetaPath = path.join(projectDir, ".service.metadata");
    const hasServiceMeta = await exists(serviceMetaPath);
    const entitySets = hasServiceMeta ? await listEntities(serviceMetaPath) : [];

    const servicesDir = path.join(projectDir, "Services");
    let serviceFile = null;
    try {
      const files = await fs.readdir(servicesDir);
      serviceFile = files.find(f => f.endsWith(".service")) || null;
    } catch {}

    const pagesCount   = await countFiles(path.join(projectDir, "Pages"),   ".page");
    const actionsCount = await countFiles(path.join(projectDir, "Actions"),  ".action");
    const rulesCount   = await countFiles(path.join(projectDir, "Rules"),    ".js");

    let i18nKeyCount = 0;
    const i18nPath = path.join(projectDir, "i18n", "i18n.properties");
    if (await exists(i18nPath)) {
      const content = await readText(i18nPath);
      i18nKeyCount = content.split("\n").filter(l => l.includes("=") && !l.startsWith("#")).length;
    }

    return jsonText({
      projectDir,
      appName:       projectJson.ApplicationName || path.basename(projectDir),
      schemaVersion: projectJson.SchemaVersion   || "unknown",
      offline:       projectJson.Offline         || false,
      serviceFile:   serviceFile ? `/AppName/Services/${serviceFile}` : null,
      hasServiceMetadata: hasServiceMeta,
      entitySets,
      counts: { pages: pagesCount, actions: actionsCount, rules: rulesCount, i18nKeys: i18nKeyCount },
      warnings: [
        ...(!hasServiceMeta ? [".service.metadata missing — create via VS Code MDK extension 'MDK: Open Mobile App Editor'"] : []),
        ...(!serviceFile ? ["No .service file found in Services/ — OData service not configured"] : [])
      ]
    });
  }
};
