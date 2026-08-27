// Exact replica of SAP/mdk-mcp-server "mdk-docs" tool (Apache-2.0)
// Searches MDK schemas — simplified (keyword-based) since vector embeddings
// require @huggingface/transformers pre-built .bin files from the SAP package.
import path from "node:path";
import fs from "node:fs";
import { getSchemasPath, getSchemaVersion, getServerSchemaVersion } from "../../lib/mdk-utils.js";

function loadSchemaFiles(schemaVersion) {
  const schemasPath = getSchemasPath();
  const versionPath = path.join(schemasPath, schemaVersion);
  const filenameList = [], contentList = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith(".json") || entry.name.endsWith(".schema") || entry.name.endsWith(".example.md")) {
        filenameList.push(fullPath);
        contentList.push(fs.readFileSync(fullPath, "utf-8"));
      }
    }
  }

  walk(versionPath);
  return { filenameList, contentList };
}

export default {
  name: "mdk-docs",
  description:
    "Unified tool for accessing MDK documentation including search, component schemas, property details, and examples.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string", enum: ["search","component","property","example","search-samples"],
        description: "search: Search documentation. component: Get component schema. property: Get property docs. example: Get component example. search-samples: Search MDK tutorial samples."
      },
      folderRootPath: { type: "string", description: "The path of the current project root folder. Used to determine schema version." },
      query: { type: "string", description: "Search query (required for 'search' and 'search-samples')." },
      component_name: { type: "string", description: "Component name (required for 'component', 'property', 'example')." },
      property_name: { type: "string", description: "Property name (required for 'property')." },
      N: { type: "number", default: 5, description: "Number of results to return for search." }
    },
    required: ["operation", "folderRootPath"]
  },

  async handler({ operation, folderRootPath, query, component_name, property_name, N = 5 } = {}) {
    try {
      if (!fs.existsSync(folderRootPath)) {
        return { content: [{ type: "text", text: `Error: The specified project path does not exist: ${folderRootPath}` }] };
      }
      if (!fs.lstatSync(folderRootPath).isDirectory()) {
        return { content: [{ type: "text", text: `Error: The specified path is not a directory: ${folderRootPath}` }] };
      }

      const projectSchemaVersion = getSchemaVersion(folderRootPath);
      const serverSchemaVersion  = getServerSchemaVersion();

      if (projectSchemaVersion !== serverSchemaVersion) {
        return {
          content: [{
            type: "text",
            text: `Schema version mismatch: Project schema version (${projectSchemaVersion}) does not match server schema version (${serverSchemaVersion}). Please ensure version compatibility.`
          }]
        };
      }

      const { filenameList, contentList } = loadSchemaFiles(serverSchemaVersion);

      switch (operation) {
        case "search": {
          if (!query) return { content: [{ type: "text", text: "Error: query is required for search operation." }] };
          const q = query.toLowerCase();
          const results = filenameList
            .map((f, i) => ({ file: path.basename(f), content: contentList[i], score: q.split(" ").reduce((s, w) => s + (contentList[i].toLowerCase().includes(w) ? 1 : 0), 0) }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, N);

          if (!results.length) return { content: [{ type: "text", text: `No results found for: "${query}"` }] };
          let text = `# MDK Documentation Search Results\n\n**Query:** "${query}"\n**Found:** ${results.length} result(s)\n\n`;
          results.forEach((r, i) => { text += `## Result ${i + 1} — ${r.file}\n\n\`\`\`\n${r.content.substring(0, 500)}...\n\`\`\`\n\n---\n\n`; });
          return { content: [{ type: "text", text }] };
        }

        case "component": {
          if (!component_name) return { content: [{ type: "text", text: "Error: component_name is required." }] };
          const cn = component_name.toLowerCase();
          const idx = filenameList.findIndex(f =>
            path.basename(f).toLowerCase().includes(cn) && (f.endsWith(".json") || f.endsWith(".schema"))
          );
          if (idx >= 0) return { content: [{ type: "text", text: contentList[idx] }] };
          return { content: [{ type: "text", text: `Component ${component_name} not found.` }] };
        }

        case "property": {
          if (!component_name) return { content: [{ type: "text", text: "Error: component_name is required." }] };
          if (!property_name) return { content: [{ type: "text", text: "Error: property_name is required." }] };
          const cn = component_name.toLowerCase();
          const idx = filenameList.findIndex(f =>
            path.basename(f).toLowerCase().includes(cn) && (f.endsWith(".json") || f.endsWith(".schema"))
          );
          if (idx >= 0) {
            try {
              const parsed = JSON.parse(contentList[idx]);
              if (parsed.properties?.[property_name]) {
                return { content: [{ type: "text", text: JSON.stringify(parsed.properties[property_name], null, 2) }] };
              }
            } catch { /**/ }
          }
          return { content: [{ type: "text", text: `No property called ${property_name} found in ${component_name}.` }] };
        }

        case "example": {
          if (!component_name) return { content: [{ type: "text", text: "Error: component_name is required." }] };
          const cn = component_name.toLowerCase();
          const idx = filenameList.findIndex(f =>
            path.basename(f).toLowerCase().includes(cn) && f.endsWith(".example.md")
          );
          if (idx >= 0) return { content: [{ type: "text", text: contentList[idx] }] };
          return { content: [{ type: "text", text: "No examples found for this component." }] };
        }

        case "search-samples": {
          if (!query) return { content: [{ type: "text", text: "Error: query is required for search-samples." }] };
          return {
            content: [{
              type: "text",
              text: `Knowledge base not found. The search-samples operation requires the GitHub knowledge base.\nRun 'npm run ingest' in @sap/mdk-mcp-server to populate it, or refer to:\nhttps://github.com/SAP-samples/cloud-mdk-tutorial-samples`
            }]
          };
        }

        default:
          return { content: [{ type: "text", text: `Unknown documentation operation: ${operation}` }] };
      }
    } catch (error) {
      console.error("MDK documentation operation failed:", error);
      return { content: [{ type: "text", text: error instanceof Error ? error.toString() : String(error) }] };
    }
  }
};
