// Exact replica of SAP/mdk-mcp-server "mdk-create" tool (Apache-2.0)
// Uses @sap/generator-mdk via Yeoman — same as the real server.
import path from "node:path";
import fs from "node:fs";
import {
  getMdkToolsPath, getMdkGeneratorPath, getMdkBinary,
  getServiceDataWithFallback, getMobileServiceAppName,
  resolveMdkProjectPath, isCapProject, runCommand,
  readServiceMetadata
} from "../../lib/mdk-utils.js";
import { okText, errText } from "../_util.js";

async function generateTemplateBasedMetadata(
  oDataEntitySetsString, templateType, projectPath, offline, isEntity, cfOrg, cfSpace
) {
  const meta = readServiceMetadata(projectPath);
  let appId = "", destinations = [];

  if (meta?.mobile) {
    appId = meta.mobile.app || "";
    destinations = meta.mobile.destinations || [];
  } else if (isEntity) {
    // Fallback for entity scope: read from .project.json
    const appName = getMobileServiceAppName(projectPath);
    if (appName) appId = appName;
    const svcData = getServiceDataWithFallback(projectPath, oDataEntitySetsString);
    if (svcData && appId) {
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(projectPath, ".project.json"), "utf-8"));
        const destName = cfg.CF?.Deploy?.Destination?.[0]?.MDK || cfg.CF?.Deploy?.Destination?.MDK;
        if (destName) {
          destinations = [{ name: destName, relativeUrl: "", metadata: { odataContent: svcData.serviceData }, type: "Mobile" }];
        }
      } catch { /**/ }
    }
    if (!appId || destinations.length === 0) return "";
  }

  const entitySets = oDataEntitySetsString.split(",").map(s => s.trim()).filter(Boolean);
  const services = [];

  for (const dest of destinations) {
    const entitySetsForService = entitySets.filter(e =>
      dest.metadata?.odataContent?.includes(`EntitySet Name="${e}"`)
    );
    services.push({
      name: dest.name.replaceAll(".", "_"),
      path: "/",
      destination: dest.name,
      edmxPath: dest.metadata?.odataContent || "",
      entitySets: entitySetsForService.length ? entitySetsForService : entitySets,
      offline: isEntity ? false : offline
    });
  }

  const paths = projectPath.split(path.sep);
  const projectName = paths.pop();
  const target = paths.join(path.sep);

  const oConfig = {
    projectName, target, type: "headless",
    newEntity: isEntity,
    appId,
    template: (destinations.length === 0 && !isEntity) ? "empty" : templateType,
    services
  };

  const configPath = path.join(projectPath, "headless.json");
  fs.writeFileSync(configPath, JSON.stringify(oConfig, null, 2));
  console.error(`[MDK MCP Server] Written headless.json: ${configPath}`);

  const mdkToolsPath = await getMdkToolsPath();
  const mdkGeneratorPath = await getMdkGeneratorPath();
  const mdkBinary = getMdkBinary(mdkToolsPath);

  // Resolve yo executable
  const isBun = process.versions?.bun !== undefined || process.execPath?.includes("bun");
  let yoCommand;
  if (isBun) {
    yoCommand = "bunx yo";
  } else {
    const yoLocal = path.join(
      path.resolve(path.dirname(path.dirname(configPath)), ".."),
      "node_modules", ".bin", process.platform === "win32" ? "yo.cmd" : "yo"
    );
    const yoServerLocal = path.join(
      path.resolve(path.dirname(configPath), ".."),
      "mcp-server", "node_modules", ".bin", process.platform === "win32" ? "yo.cmd" : "yo"
    );
    if (fs.existsSync(yoServerLocal)) yoCommand = yoServerLocal;
    else if (fs.existsSync(yoLocal)) yoCommand = yoLocal;
    else yoCommand = "yo"; // system PATH fallback
  }

  let script = `${yoCommand} ${mdkGeneratorPath}/generators/app/index.js --dataFile ${configPath} --force`;
  if (mdkBinary) script += ` --tool ${mdkBinary}`;
  return script;
}

export default {
  name: "mdk-create",
  description:
    "Creates MDK projects or entity metadata using templates (CRUD, List Detail, Base). " +
    "Use this for initializing new projects or adding entity metadata to existing projects. " +
    "Supports CAP projects - automatically creates MDK apps in the app/ folder with proper naming and configuration.",
  inputSchema: {
    type: "object",
    properties: {
      folderRootPath: {
        type: "string",
        description: "The path of the current project root folder. For CAP projects, provide the CAP project root - the MDK app will be created in app/<projectname>_mdk/."
      },
      scope: {
        type: "string", enum: ["project", "entity"],
        description: "The scope of creation: project = Initialize a new MDK project, entity = Add entity metadata to existing project."
      },
      templateType: {
        type: "string", enum: ["crud", "list detail", "base"],
        description: "The type of template. Note: 'base' is only valid for project scope."
      },
      oDataEntitySets: { type: "string", description: "OData entity sets, separated by commas." },
      offline: { type: "boolean", default: false, description: "Offline mode (project scope only)." },
      cfOrg:  { type: "string", description: "Optional Cloud Foundry organization name." },
      cfSpace: { type: "string", description: "Optional Cloud Foundry space name." }
    },
    required: ["folderRootPath", "scope", "templateType", "oDataEntitySets"]
  },

  async handler({ folderRootPath, scope, templateType, oDataEntitySets, offline = false, cfOrg, cfSpace } = {}) {
    try {
      if (templateType === "base" && scope === "entity") {
        return { content: [{ type: "text", text: "Error: 'base' template is only valid for project scope, not entity scope." }] };
      }

      const isEntity = scope === "entity";
      let projectPath = folderRootPath;

      // CAP project handling
      if (scope === "project") {
        const { isCap } = isCapProject(projectPath);
        if (isCap) projectPath = resolveMdkProjectPath(projectPath);
      } else if (isEntity) {
        projectPath = resolveMdkProjectPath(projectPath);
      }

      const useOffline = scope === "project" ? offline : false;
      const script = await generateTemplateBasedMetadata(
        oDataEntitySets, templateType, projectPath, useOffline, isEntity, cfOrg, cfSpace
      );

      if (!script) {
        const errorMsg = isEntity
          ? `Error: Unable to read service metadata. Please make sure either .service.metadata file exists in project root ${projectPath}, or .project.json file exists and corresponding .XML file in Services folder.`
          : `Error: Unable to read service metadata from .service.metadata file in project root ${projectPath}. Please make sure the file exists and is a valid JSON file.`;
        return { content: [{ type: "text", text: errorMsg }] };
      }

      const resultText = runCommand(script);
      const headlessPath = path.join(projectPath, "headless.json");
      if (fs.existsSync(headlessPath)) fs.unlinkSync(headlessPath);

      return { content: [{ type: "text", text: resultText }] };
    } catch (error) {
      console.error("MDK create operation failed:", error);
      return { content: [{ type: "text", text: error instanceof Error ? error.toString() : String(error) }] };
    }
  }
};
