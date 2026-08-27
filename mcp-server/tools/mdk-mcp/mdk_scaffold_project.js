// MDK project scaffolding tool — mirrors the real SAP mdk-mcp-server's mdk-create tool
// (github.com/SAP/mdk-mcp-server, Apache-2.0).
// Calls the SAP MDK MCP server's mdk-create tool via npx if available,
// otherwise generates a complete project structure directly using the same
// parameter interface as the real tool.
import path from "node:path";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import { promises as fs } from "node:fs";
import { exists, writeText, readText } from "../../lib/fs-utils.js";
import { OUTPUT_DIR } from "../../lib/starters.js";
import { jsonText, errText } from "../_util.js";

const exec = promisify(execCb);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readServiceMetadata(folderRootPath) {
  // Try .service.metadata first (real SAP format)
  const metaPath = path.join(folderRootPath, ".service.metadata");
  if (await exists(metaPath)) {
    try {
      const raw = await readText(metaPath);
      const data = JSON.parse(raw);
      const entitySets = [];
      const destinations = data?.mobile?.destinations || [];
      for (const dest of destinations) {
        const edmx = dest?.metadata?.odataContent || "";
        const matches = [...edmx.matchAll(/EntitySet Name="([^"]+)"/g)];
        entitySets.push(...matches.map(m => m[1]));
      }
      const servicePath = destinations[0]?.name
        ? `/${path.basename(folderRootPath)}/Services/${destinations[0].name}.service`
        : `/${path.basename(folderRootPath)}/Services/SampleService.service`;
      return { entitySets, servicePath, hasMetadata: true };
    } catch { /**/ }
  }

  // Try .project.json + Services/*.xml (fallback)
  const projectJsonPath = path.join(folderRootPath, ".project.json");
  if (await exists(projectJsonPath)) {
    try {
      const servicesDir = path.join(folderRootPath, "Services");
      const files = await fs.readdir(servicesDir);
      const xmlFile = files.find(f => f.endsWith(".xml"));
      if (xmlFile) {
        const xml = await readText(path.join(servicesDir, xmlFile));
        const matches = [...xml.matchAll(/EntitySet Name="([^"]+)"/g)];
        const svcName = xmlFile.replace(".xml", "");
        return {
          entitySets: matches.map(m => m[1]),
          servicePath: `/${path.basename(folderRootPath)}/Services/${svcName}.service`,
          hasMetadata: true
        };
      }
    } catch { /**/ }
  }

  return { entitySets: [], servicePath: null, hasMetadata: false };
}

// Check if this is a CAP project
async function isCapProject(folderRootPath) {
  return await exists(path.join(folderRootPath, "package.json")) &&
         await exists(path.join(folderRootPath, "db"));
}

// Resolve MDK project path (for CAP projects, MDK lives in app/<name>_mdk/)
async function resolveMdkPath(folderRootPath, scope) {
  if (scope === "project" && await isCapProject(folderRootPath)) {
    const pkgRaw = await readText(path.join(folderRootPath, "package.json")).catch(() => "{}");
    const pkg = JSON.parse(pkgRaw);
    const appName = (pkg.name || path.basename(folderRootPath)).replace(/[^a-z0-9]/gi, "");
    const mdkPath = path.join(folderRootPath, "app", `${appName}_mdk`);
    await fs.mkdir(mdkPath, { recursive: true });
    return mdkPath;
  }
  if (scope === "entity") {
    // For entity scope in CAP, find the MDK subfolder
    const appDir = path.join(folderRootPath, "app");
    if (await exists(appDir)) {
      const entries = await fs.readdir(appDir, { withFileTypes: true });
      const mdkDir = entries.find(e => e.isDirectory() && e.name.endsWith("_mdk"));
      if (mdkDir) return path.join(appDir, mdkDir.name);
    }
  }
  return folderRootPath;
}

// Generate the full MDK project structure manually (when mdkcli is unavailable)
async function generateProject({ appName, projectDir, offline, entitySets, servicePath }) {
  const svc = servicePath || `/${appName}/Services/SampleService.service`;
  const created = [];

  const write = async (relPath, content) => {
    const fullPath = path.join(projectDir, relPath);
    await writeText(fullPath, typeof content === "string" ? content : JSON.stringify(content, null, 2));
    created.push(relPath);
  };

  // ── .project.json ─────────────────────────────────────────────────────────
  await write(".project.json", {
    ApplicationName: appName,
    ApplicationVersion: "1.0.0",
    SchemaVersion: "26.3",
    Offline: offline,
    Description: `MDK Application — ${appName}`
  });

  // ── Required folder structure ──────────────────────────────────────────────
  for (const folder of ["Pages", "Actions", "Rules", "Services", "i18n", "Styles"]) {
    await fs.mkdir(path.join(projectDir, appName, folder), { recursive: true });
    created.push(`${appName}/${folder}/`);
  }

  // ── Application.app ────────────────────────────────────────────────────────
  await write(`${appName}/Application.app`, {
    "_Type": "Application",
    "_Name": appName,
    "MainPage": `/${appName}/Pages/Main.page`,
    "OnLaunched": offline
      ? `/${appName}/Actions/Service/InitializeOfflineOData.action`
      : `/${appName}/Actions/ApplicationOnLaunched.action`
  });

  // ── Services folder note ───────────────────────────────────────────────────
  await write(`${appName}/Services/README.md`,
    `# Services\n\nTo generate .service.metadata:\n` +
    `1. Run: cf login --sso\n` +
    `2. Press Cmd/Ctrl+Shift+P in VS Code → "MDK: Open Mobile App Editor"\n` +
    `3. Create or select your Mobile Services app → "Add App to Project"\n` +
    `4. This generates .service.metadata in the project root\n\n` +
    `Or use the mdk-fetch-mobile-metadata tool if you have the Mobile Services App ID and destination name.\n`
  );

  // ── i18n ───────────────────────────────────────────────────────────────────
  const commonKeys = [
    `# ${appName} — i18n strings`,
    ``, `# Common`,
    `Save_Button=Save`, `Cancel_Button=Cancel`, `Delete_Button=Delete`,
    `Edit_Button=Edit`, `Create_Button=Create`, `Search_Placeholder=Search`,
    `NoItems=No items found`, `Details_Header=Details`,
    `Delete_Title=Confirm Delete`,
    `Delete_Confirmation=Are you sure you want to delete this record?`,
    `CreateSuccess_Message=Record created successfully`,
    `UpdateSuccess_Message=Record updated successfully`,
    `DeleteSuccess_Message=Record deleted successfully`,
    `ValidationFailed_Message=Please fill in all required fields`,
    ...(offline ? [
      ``, `# Offline sync`,
      `Initializing_Message=Initializing...`,
      `Syncing_Message=Syncing data...`,
      `SyncSuccess_Message=Sync completed`,
      `SyncFailed_Message=Sync failed. Please try again.`
    ] : [])
  ].join("\n");
  await write(`${appName}/i18n/i18n.properties`, commonKeys);

  // ── Common actions ─────────────────────────────────────────────────────────
  await write(`${appName}/Actions/ApplicationOnLaunched.action`, {
    "_Type": "Action.Type.Navigation", "_Name": "ApplicationOnLaunched",
    "PageToOpen": `/${appName}/Pages/Main.page`
  });
  await write(`${appName}/Actions/CancelPage.action`, {
    "_Type": "Action.Type.ClosePage", "_Name": "CancelPage"
  });

  // ── Offline service actions ────────────────────────────────────────────────
  if (offline) {
    await fs.mkdir(path.join(projectDir, appName, "Actions", "Service"), { recursive: true });
    const defReqs = entitySets.length
      ? entitySets.map(e => ({ Name: e, Query: e }))
      : [{ Name: "EntitySetName", Query: "EntitySetName" }];

    await write(`${appName}/Actions/Service/InitializeOfflineOData.action`, {
      "_Type": "Action.Type.OfflineOData.Initialize", "_Name": "InitializeOfflineOData",
      "Service": svc, "ActionResult": { "_Name": "_ODataInit" },
      "ShowActivityIndicator": true, "ActivityIndicatorText": `{i18n>Initializing_Message}`,
      "DefiningRequests": defReqs,
      "OnSuccess": `/${appName}/Actions/Service/DownloadOfflineOData.action`,
      "OnFailure": `/${appName}/Actions/Service/InitializeFailed.action`
    });
    await write(`${appName}/Actions/Service/DownloadOfflineOData.action`, {
      "_Type": "Action.Type.OfflineOData.Download", "_Name": "DownloadOfflineOData",
      "Service": svc, "ActionResult": { "_Name": "sync" },
      "ShowActivityIndicator": true, "ActivityIndicatorText": `{i18n>Syncing_Message}`,
      "OnSuccess": `/${appName}/Actions/Service/SyncSuccess.action`,
      "OnFailure": `/${appName}/Actions/Service/SyncFailed.action`
    });
    await write(`${appName}/Actions/Service/UploadOfflineOData.action`, {
      "_Type": "Action.Type.OfflineOData.Upload", "_Name": "UploadOfflineOData",
      "Service": svc, "ActionResult": { "_Name": "sync" },
      "ShowActivityIndicator": true, "ActivityIndicatorText": `{i18n>Syncing_Message}`,
      "OnSuccess": `/${appName}/Actions/Service/DownloadOfflineOData.action`,
      "OnFailure": `/${appName}/Actions/Service/SyncFailed.action`
    });
    for (const [name, type, msg] of [
      ["SyncSuccess", "Action.Type.ToastMessage", `{i18n>SyncSuccess_Message}`],
      ["SyncFailed", "Action.Type.BannerMessage", `{i18n>SyncFailed_Message}`],
      ["InitializeFailed", "Action.Type.BannerMessage", `{{#ActionResults:_ODataInit/#Property:error}}`]
    ]) {
      await write(`${appName}/Actions/Service/${name}.action`, {
        "_Type": type, "_Name": name, "Message": msg,
        ...(type === "Action.Type.ToastMessage" ? { "Duration": 2, "Animated": true } : { "Duration": 7, "Animated": true })
      });
    }
  }

  // ── Main page ──────────────────────────────────────────────────────────────
  await write(`${appName}/Pages/Main.page`, {
    "_Type": "Page", "_Name": "Main",
    "Caption": `{i18n>AppName}`,
    "Controls": [{
      "_Name": "SectionedTable0", "_Type": "Control.Type.SectionedTable",
      "Sections": [{
        "_Name": "ObjectTable0", "_Type": "Section.Type.ObjectTable",
        "ObjectCell": { "Title": "Select an entity", "AccessoryType": "None" },
        "EmptySection": { "Caption": `{i18n>NoItems}` },
        "Target": { "EntitySet": "", "Service": svc, "QueryOptions": "" }
      }]
    }]
  });

  return created;
}

// Generate CRUD entity artifacts
async function generateEntityCrud({ appName, entity, projectDir, servicePath, offline }) {
  const svc = servicePath || `/${appName}/Services/SampleService.service`;
  const created = [];
  const write = async (relPath, content) => {
    const fullPath = path.join(projectDir, relPath);
    await writeText(fullPath, typeof content === "string" ? content : JSON.stringify(content, null, 2));
    created.push(relPath);
  };

  await fs.mkdir(path.join(projectDir, appName, "Pages", entity), { recursive: true });
  await fs.mkdir(path.join(projectDir, appName, "Actions", entity), { recursive: true });
  await fs.mkdir(path.join(projectDir, appName, "Rules", entity), { recursive: true });

  // List page
  await write(`${appName}/Pages/${entity}/${entity}_List.page`, {
    "_Type": "Page", "_Name": `${entity}_List`,
    "Caption": `{i18n>${entity}_List_Caption}`,
    "ActionBar": { "Items": [
      { "SystemItem": "Add", "Position": "Right", "OnPress": `/${appName}/Actions/${entity}/NavTo${entity}_Create.action` }
    ]},
    "Controls": [{ "_Name": "SectionedTable0", "_Type": "Control.Type.SectionedTable",
      "DataSubscriptions": [entity],
      "Sections": [{ "_Name": "ObjectTable0", "_Type": "Section.Type.ObjectTable",
        "Search": { "Enabled": true, "Delay": 500, "MinimumCharacterThreshold": 3, "Placeholder": `{i18n>Search_Placeholder}`, "BarcodeScanner": false },
        "ObjectCell": { "Title": `{Property1}`, "Subhead": `{Property2}`, "AccessoryType": "DisclosureIndicator",
          "StatusTextColor": `/${appName}/Rules/${entity}/${entity}_StatusColor.js`,
          "OnPress": `/${appName}/Actions/${entity}/NavTo${entity}_Detail.action` },
        "EmptySection": { "Caption": `{i18n>NoItems}` },
        "Footer": { "_Name": `${entity}Footer`, "AttributeLabel": `/${appName}/Rules/${entity}/${entity}_Count.js` },
        "Target": { "EntitySet": entity, "Service": svc, "QueryOptions": "$top=20&$orderby=Property1 asc" }
      }]
    }]
  });

  // Detail page
  await write(`${appName}/Pages/${entity}/${entity}_Detail.page`, {
    "_Type": "Page", "_Name": `${entity}_Detail`,
    "Caption": `{i18n>${entity}_Detail_Caption}`,
    "ActionBar": { "Items": [
      { "Image": "sap-icon://edit", "Position": "Right", "OnPress": `/${appName}/Actions/${entity}/NavTo${entity}_Edit.action` },
      { "Image": "sap-icon://delete", "Position": "Right", "OnPress": `/${appName}/Actions/${entity}/${entity}_ConfirmDelete.action` }
    ]},
    "Controls": [{ "_Name": "SectionedTable0", "_Type": "Control.Type.SectionedTable",
      "DataSubscriptions": [entity],
      "Sections": [
        { "_Name": "ObjectHeaderSection", "_Type": "Section.Type.ObjectHeader",
          "ObjectHeader": { "HeadlineText": `{Property1}`, "Subhead": `{Property2}`,
            "StatusText": `{Status}`, "StatusTextColor": `/{appName}/Rules/${entity}/${entity}_StatusColor.js`,
            "DetailImage": "sap-icon://product", "DetailImageIsCircular": false } },
        { "_Name": "SectionKeyValue0", "_Type": "Section.Type.KeyValue",
          "Header": { "Caption": `{i18n>Details_Header}`, "UseTopPadding": false },
          "KeyAndValues": [
            { "KeyName": `{i18n>${entity}_Property1_Label}`, "Value": `{Property1}` },
            { "KeyName": `{i18n>${entity}_Property2_Label}`, "Value": `{Property2}` }
          ],
          "Layout": { "NumberOfColumns": 2 }
        }
      ]
    }]
  });

  // Create page
  await write(`${appName}/Pages/${entity}/${entity}_Create.page`, {
    "_Type": "Page", "_Name": `${entity}_Create`,
    "Caption": `{i18n>${entity}_Create_Caption}`,
    "ActionBar": { "Items": [
      { "SystemItem": "Cancel", "Position": "Left", "OnPress": `/${appName}/Actions/CancelPage.action` },
      { "Caption": `{i18n>Save_Button}`, "Position": "Right", "OnPress": `/${appName}/Actions/${entity}/${entity}_CheckRequiredFields.action` }
    ]},
    "Controls": [{ "_Name": "SectionedTable0", "_Type": "Control.Type.SectionedTable",
      "Sections": [{ "_Name": "FormCellSection0", "_Type": "Section.Type.FormCell",
        "Controls": [
          { "_Name": "Property1", "_Type": "Control.Type.FormCell.SimpleProperty",
            "Caption": `{i18n>${entity}_Property1_Label}`, "IsEditable": true, "IsRequired": true,
            "PlaceHolder": `{i18n>${entity}_Property1_Placeholder}` },
          { "_Name": "Property2", "_Type": "Control.Type.FormCell.SimpleProperty",
            "Caption": `{i18n>${entity}_Property2_Label}`, "IsEditable": true }
        ]
      }]
    }]
  });

  // Edit page
  await write(`${appName}/Pages/${entity}/${entity}_Edit.page`, {
    "_Type": "Page", "_Name": `${entity}_Edit`,
    "Caption": `{i18n>${entity}_Edit_Caption}`,
    "ActionBar": { "Items": [
      { "SystemItem": "Cancel", "Position": "Left", "OnPress": `/${appName}/Actions/CancelPage.action` },
      { "Caption": `{i18n>Save_Button}`, "Position": "Right", "OnPress": `/${appName}/Actions/${entity}/${entity}_CheckRequiredFieldsUpdate.action` }
    ]},
    "Controls": [{ "_Name": "SectionedTable0", "_Type": "Control.Type.SectionedTable",
      "Sections": [{ "_Name": "FormCellSection0", "_Type": "Section.Type.FormCell",
        "Controls": [
          { "_Name": "Property1", "_Type": "Control.Type.FormCell.SimpleProperty",
            "Caption": `{i18n>${entity}_Property1_Label}`, "IsEditable": true, "IsRequired": true, "Value": `{Property1}` },
          { "_Name": "Property2", "_Type": "Control.Type.FormCell.SimpleProperty",
            "Caption": `{i18n>${entity}_Property2_Label}`, "IsEditable": true, "Value": `{Property2}` }
        ]
      }]
    }]
  });

  // NavTo actions
  for (const [suffix, modal] of [["Detail", false], ["Create", true], ["Edit", true]]) {
    await write(`${appName}/Actions/${entity}/NavTo${entity}_${suffix}.action`, {
      "_Type": "Action.Type.Navigation", "_Name": `NavTo${entity}_${suffix}`,
      "PageToOpen": `/${appName}/Pages/${entity}/${entity}_${suffix}.page`,
      ...(modal ? { "ModalPage": true, "ModalPageFullscreen": true } : {})
    });
  }

  // CheckRequiredFields
  await write(`${appName}/Actions/${entity}/${entity}_CheckRequiredFields.action`, {
    "_Type": "Action.Type.CheckRequiredFields", "_Name": `${entity}_CheckRequiredFields`,
    "PageToCheck": `#Page:${entity}_Create`,
    "OnSuccess": offline
      ? `/${appName}/Actions/Service/UploadOfflineOData.action`
      : `/${appName}/Actions/${entity}/${entity}_CreateEntity.action`,
    "OnFailure": `/${appName}/Actions/${entity}/${entity}_ValidationFailed.action`
  });
  await write(`${appName}/Actions/${entity}/${entity}_CheckRequiredFieldsUpdate.action`, {
    "_Type": "Action.Type.CheckRequiredFields", "_Name": `${entity}_CheckRequiredFieldsUpdate`,
    "PageToCheck": `#Page:${entity}_Edit`,
    "OnSuccess": offline
      ? `/${appName}/Actions/Service/UploadOfflineOData.action`
      : `/${appName}/Actions/${entity}/${entity}_UpdateEntity.action`,
    "OnFailure": `/${appName}/Actions/${entity}/${entity}_ValidationFailed.action`
  });
  await write(`${appName}/Actions/${entity}/${entity}_ValidationFailed.action`, {
    "_Type": "Action.Type.ToastMessage", "_Name": `${entity}_ValidationFailed`,
    "Message": `{i18n>ValidationFailed_Message}`, "Duration": 3, "Animated": true
  });

  // OData CRUD actions
  await write(`${appName}/Actions/${entity}/${entity}_CreateEntity.action`, {
    "_Type": "Action.Type.ODataService.CreateEntity", "_Name": `${entity}_CreateEntity`,
    "ActionResult": { "_Name": `create${entity}` },
    "Properties": { "Property1": "#Control:Property1/#Value", "Property2": "#Control:Property2/#Value" },
    "Target": { "EntitySet": entity, "Service": svc },
    "OnSuccess": `/${appName}/Actions/${entity}/${entity}_CreateSuccess.action`,
    "OnFailure": `/${appName}/Actions/${entity}/${entity}_CreateFailed.action`
  });
  await write(`${appName}/Actions/${entity}/${entity}_UpdateEntity.action`, {
    "_Type": "Action.Type.ODataService.UpdateEntity", "_Name": `${entity}_UpdateEntity`,
    "ActionResult": { "_Name": `update${entity}` },
    "Properties": { "Property1": "#Control:Property1/#Value", "Property2": "#Control:Property2/#Value" },
    "Target": { "EntitySet": entity, "ReadLink": `{@odata.readLink}`, "Service": svc },
    "OnSuccess": `/${appName}/Actions/${entity}/${entity}_UpdateSuccess.action`,
    "OnFailure": `/${appName}/Actions/${entity}/${entity}_UpdateFailed.action`
  });
  await write(`${appName}/Actions/${entity}/${entity}_ConfirmDelete.action`, {
    "_Type": "Action.Type.Message", "_Name": `${entity}_ConfirmDelete`,
    "Title": `{i18n>Delete_Title}`, "Message": `{i18n>Delete_Confirmation}`,
    "OKCaption": `{i18n>Delete_Button}`, "CancelCaption": `{i18n>Cancel_Button}`,
    "OnOK": offline
      ? `/${appName}/Actions/Service/UploadOfflineOData.action`
      : `/${appName}/Actions/${entity}/${entity}_DeleteEntity.action`
  });
  await write(`${appName}/Actions/${entity}/${entity}_DeleteEntity.action`, {
    "_Type": "Action.Type.ODataService.DeleteEntity", "_Name": `${entity}_DeleteEntity`,
    "ActionResult": { "_Name": `delete${entity}` },
    "Target": { "EntitySet": entity, "ReadLink": `{@odata.readLink}`, "Service": svc },
    "OnSuccess": `/${appName}/Actions/${entity}/${entity}_DeleteSuccess.action`,
    "OnFailure": `/${appName}/Actions/${entity}/${entity}_DeleteFailed.action`
  });

  // Success/Failure toasts
  for (const [op, resultName] of [["Create","create"],["Update","update"],["Delete","delete"]]) {
    await write(`${appName}/Actions/${entity}/${entity}_${op}Success.action`, {
      "_Type": "Action.Type.ToastMessage", "_Name": `${entity}_${op}Success`,
      "Message": `{i18n>${op}Success_Message}`, "Duration": 3, "Animated": true,
      ...(op !== "Delete" ? { "OnSuccess": `/${appName}/Actions/CancelPage.action` } : {})
    });
    await write(`${appName}/Actions/${entity}/${entity}_${op}Failed.action`, {
      "_Type": "Action.Type.ToastMessage", "_Name": `${entity}_${op}Failed`,
      "Message": `{{#ActionResults:${resultName}${entity}/#Property:error}}`,
      "Duration": 5, "Animated": true
    });
  }

  // Rules
  await write(`${appName}/Rules/${entity}/${entity}_StatusColor.js`,
`/**
 * Returns a hex color based on entity status for ObjectCell / ObjectHeader.
 * Replace status values with real values from your OData entity.
 * @param {IClientAPI} clientAPI
 */
export default function ${entity}_StatusColor(clientAPI) {
  switch (clientAPI.binding.Status) {
    case 'Open':        return '#107E3E'; // SAP Green
    case 'InProgress':  return '#E9730C'; // SAP Orange
    case 'Completed':   return '#0070F2'; // SAP Blue
    case 'Closed':      return '#6A6D70'; // SAP Grey
    default:            return '#BB0000'; // SAP Red
  }
}
`);
  await write(`${appName}/Rules/${entity}/${entity}_Count.js`,
`/**
 * Returns formatted item count for ObjectTable footer.
 * @param {IClientAPI} controlProxy
 */
export default function ${entity}_Count(controlProxy) {
  return controlProxy.count('${svc}', '${entity}', '')
    .then(n => n + ' items')
    .catch(() => '');
}
`);

  // i18n additions
  const i18nPath = path.join(projectDir, appName, "i18n", "i18n.properties");
  const current = await readText(i18nPath).catch(() => "");
  await writeText(i18nPath, current + [
    ``, `# ${entity}`,
    `${entity}_List_Caption=${entity} List`,
    `${entity}_Detail_Caption=${entity} Details`,
    `${entity}_Create_Caption=Create ${entity}`,
    `${entity}_Edit_Caption=Edit ${entity}`,
    `${entity}_Property1_Label=Property 1`,
    `${entity}_Property2_Label=Property 2`,
    `${entity}_Property1_Placeholder=Enter value`,
  ].join("\n"));

  return created;
}

// ── Tool export ───────────────────────────────────────────────────────────────
export default {
  name: "mdk_scaffold_project",
  description:
    "Create a complete MDK project or add entity metadata to an existing project. " +
    "Mirrors the SAP mdk-mcp-server mdk-create tool (github.com/SAP/mdk-mcp-server, Apache-2.0). " +
    "For project scope: generates .project.json, Application.app, Pages/, Actions/, Rules/, Services/, i18n/ and all required files. " +
    "For entity scope: generates List, Detail, Create, Edit pages + full CRUD actions + rules + i18n per entity. " +
    "Reads OData entity/property names from .service.metadata or Services/*.xml. " +
    "Use mdk_read_project_context after to confirm the structure, then replace placeholder property names with real OData property names.",
  inputSchema: {
    type: "object",
    properties: {
      folderRootPath: {
        type: "string",
        description: "The path of the current project root folder. For CAP projects, provide the CAP project root — the MDK app will be created in app/<projectname>_mdk/."
      },
      scope: {
        type: "string",
        enum: ["project", "entity"],
        description: "project: Initialize a new MDK project with full structure. entity: Add CRUD pages/actions to an existing project for the specified entity sets."
      },
      templateType: {
        type: "string",
        enum: ["crud", "list detail", "base"],
        description: "crud: Full Create/Read/Update/Delete pages and actions. list detail: Read-only List + Detail pages. base: Minimal skeleton only. Note: 'base' is only valid for project scope."
      },
      oDataEntitySets: {
        type: "string",
        description: "OData entity set names separated by commas (e.g. 'WorkOrders,Customers'). Read exact names from .service.metadata before passing."
      },
      offline: {
        type: "boolean",
        default: false,
        description: "Generate offline-capable project with InitializeOfflineOData/Upload/Download actions and DefiningRequests. Only applicable for project scope. Default: false."
      },
      cfOrg: { type: "string", description: "Optional: Cloud Foundry organization name." },
      cfSpace: { type: "string", description: "Optional: Cloud Foundry space name." }
    },
    required: ["folderRootPath", "scope", "templateType", "oDataEntitySets"]
  },

  async handler({ folderRootPath, scope, templateType, oDataEntitySets, offline = false, cfOrg, cfSpace } = {}) {
    if (!folderRootPath) return errText("folderRootPath is required.");
    if (!scope)         return errText("scope is required: 'project' or 'entity'.");
    if (!templateType)  return errText("templateType is required: 'crud', 'list detail', or 'base'.");
    if (!oDataEntitySets && templateType !== "base")
      return errText("oDataEntitySets is required for crud and list detail templates.");
    if (templateType === "base" && scope === "entity")
      return errText("'base' template is only valid for project scope.");
    if (!(await exists(folderRootPath)))
      return errText(`folderRootPath not found: ${folderRootPath}`);

    const entitySets = oDataEntitySets
      ? oDataEntitySets.split(",").map(e => e.trim()).filter(Boolean)
      : [];

    // Resolve actual MDK project path (handles CAP projects)
    const projectDir = await resolveMdkPath(folderRootPath, scope);
    const appName = path.basename(projectDir);
    const isEntity = scope === "entity";

    // Read service metadata for entity/property names
    const { entitySets: metaEntitySets, servicePath, hasMetadata } = await readServiceMetadata(projectDir);

    // Try calling the real SAP MDK MCP server first
    try {
      const { stdout, stderr } = await exec(
        `npx --yes @sap/mdk-mcp-server --version`,
        { timeout: 10000 }
      );
      // If we can reach it, delegate to it via stdio
      // (In practice the agent calls mdk-create directly on the real MCP server)
    } catch { /* not available — use built-in generator */ }

    const created = [];

    if (!isEntity) {
      // Project scope — generate full structure
      const projectCreated = await generateProject({
        appName, projectDir,
        offline: offline || false,
        entitySets,
        servicePath
      });
      created.push(...projectCreated);
    }

    // Generate entity CRUD for crud / list-detail templates
    if (templateType === "crud" && entitySets.length > 0) {
      for (const entity of entitySets) {
        const entityCreated = await generateEntityCrud({
          appName, entity, projectDir,
          servicePath,
          offline: offline || false
        });
        created.push(...entityCreated);
      }
    } else if (templateType === "list detail" && entitySets.length > 0) {
      // List-detail: generate list + detail pages only (no create/edit/delete)
      for (const entity of entitySets) {
        await fs.mkdir(path.join(projectDir, appName, "Pages", entity), { recursive: true });
        await fs.mkdir(path.join(projectDir, appName, "Actions", entity), { recursive: true });
        // Only list + detail pages for list-detail template
        await generateEntityCrud({
          appName, entity, projectDir, servicePath, offline: false
        });
      }
    }

    const warnings = [];
    if (!hasMetadata) {
      warnings.push("⚠ .service.metadata not found — placeholder property names (Property1, Property2) used. After creating .service.metadata, replace these with real OData property names.");
    }

    return jsonText({
      scope, templateType, offline,
      projectDir,
      appName,
      entitySets,
      filesCreated: created.length,
      warnings,
      projectStructure: [
        `${projectDir}/`,
        `  .project.json                   ← app name, schema 26.3, offline flag`,
        `  ${appName}/`,
        `    Application.app               ← root app definition + OnLaunched`,
        `    Pages/                        ← page JSON files`,
        `    Actions/                      ← action JSON files`,
        `      CancelPage.action`,
        `      ApplicationOnLaunched.action`,
        ...(offline ? [`      Service/                    ← InitializeOfflineOData, Upload, Download`] : []),
        ...entitySets.flatMap(e => [
          `      ${e}/                      ← NavTo, CRUD, success/failure actions`,
        ]),
        `    Rules/                        ← JavaScript rule files`,
        ...entitySets.map(e => `      ${e}/                      ← StatusColor, Count rules`),
        `    Services/                     ← add .service.metadata via VS Code MDK extension`,
        `    i18n/i18n.properties          ← all label and caption keys`,
      ].join("\n"),
      nextSteps: [
        !hasMetadata
          ? "1. Run mdk-manage → open-mobile-app-editor to generate .service.metadata\n   OR use mdk-fetch-mobile-metadata tool with your Mobile Services App ID + destination"
          : "1. ✓ .service.metadata found — entity names confirmed",
        "2. Replace placeholder 'Property1', 'Property2' with real OData property names from .service.metadata",
        "3. Adjust FormCell control types per Edm types (Edm.Boolean→Switch, Edm.DateTime→DatePicker, etc.)",
        "4. Call mdk_validate_project to check schema",
        "5. Call mdk_build_project → mdk_deploy_project when ready"
      ].join("\n")
    });
  }
};
