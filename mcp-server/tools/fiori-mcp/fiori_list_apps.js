// Replicated from SAP/open-ux-tools — fiori-mcp-server (Apache-2.0)
// Upstream tool: "list_fiori_apps" — identify Fiori apps that can be modified.
// Self-contained: scans for manifest.json (no external MCP dependency).
import path from "node:path";
import { walk, readText } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

export default {
  name: "fiori_list_apps",
  description:
    "List SAP Fiori applications under a directory. Scans for manifest.json files and reports each app's id, type, min UI5 version, main service, and floorplan target component(s). Use to discover apps in a workspace before modifying one. (Replicates the Fiori MCP server's list_fiori_apps — no external MCP dependency.)",
  inputSchema: {
    type: "object",
    properties: {
      rootDir: { type: "string", description: "Absolute path to scan for Fiori apps." }
    },
    required: ["rootDir"]
  },
  async handler({ rootDir } = {}) {
    if (!rootDir) return errText("rootDir is required");
    const dir = path.resolve(rootDir);
    const files = await walk(dir);
    const manifests = files.filter((f) => path.basename(f) === "manifest.json");

    const apps = [];
    for (const m of manifests) {
      let json;
      try { json = JSON.parse(await readText(m)); } catch { continue; }
      const app = json["sap.app"];
      if (!app?.id) continue;
      const ui5 = json["sap.ui5"] || {};
      const targets = ui5.routing?.targets || {};
      const floorplans = [...new Set(Object.values(targets).map((t) => t && t.name).filter(Boolean))];
      apps.push({
        id: app.id,
        type: app.type || "application",
        title: app.title,
        manifest: path.relative(dir, m),
        minUI5Version: ui5.dependencies?.minUI5Version,
        mainService: app.dataSources ? Object.keys(app.dataSources)[0] : undefined,
        floorplans
      });
    }

    return okText(JSON.stringify({ rootDir: dir, count: apps.length, apps }, null, 2));
  }
};
