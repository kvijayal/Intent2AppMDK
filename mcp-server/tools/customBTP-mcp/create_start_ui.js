import path from "node:path";
import { OUTPUT_DIR } from "../../lib/starters.js";
import { scaffoldWorkflowModule, applyStartParams, wireWorkflowMta } from "../../lib/workflow.js";
import { okText, errText } from "../_util.js";

export default {
  name: "create_start_ui",
  description:
    "Scaffold a SAP Build Process Automation Start UI (a UI5 app that triggers a workflow instance) " +
    "into a shared workflow MTA project under output/<workflowProject>. Clones the proven reference " +
    "Start module, rewrites its identity, injects environmentId (REQUIRED) + workflowDefinitionId + " +
    "the FLP inbound, optionally generates a field-driven trigger form with validations (or keeps the " +
    "CSV-import flow), and (re)generates the MTA wrapper. The interactive gates GW0/GW-Data/GW-Start " +
    "in the main thread collect these inputs first (ask, don't assume).",
  inputSchema: {
    type: "object",
    properties: {
      namespace: { type: "string", description: "Lowercase dotted namespace, e.g. com.acme.invoicestart." },
      environmentId: { type: "string", description: "SAP Build Process Automation environmentId for the workflow-instances POST. REQUIRED — never defaulted (GW0)." },
      workflowDefinitionId: { type: "string", description: "The workflow definition id to start." },
      workflowProject: { type: "string", description: "Workflow MTA project name → output/<workflowProject> + mta ID/xsuaa. Defaults to the namespace's 2nd segment." },
      moduleFolder: { type: "string", description: "Folder name for this module under the project. Defaults to the last namespace segment." },
      mtaProjectDir: { type: "string", description: "Absolute project dir (overrides output/<workflowProject>)." },
      cloudService: { type: "string", description: "sap.cloud.service value shared across the workflow modules." },
      flp: {
        type: "object", description: "FLP tile (crossNavigation inbound).",
        properties: {
          semanticObject: { type: "string" }, action: { type: "string" },
          title: { type: "string" }, subTitle: { type: "string" }, icon: { type: "string" }
        }
      },
      triggerFields: {
        type: "array", description: "Fields that trigger the workflow (generates a form when upload is off).",
        items: { type: "object", properties: { name: { type: "string" }, label: { type: "string" }, type: { type: "string" }, mandatory: { type: "boolean" } }, required: ["name"] }
      },
      upload: { type: "object", description: "CSV/file import.", properties: { enabled: { type: "boolean" }, format: { type: "string" }, templateColumns: { type: "array", items: { type: "string" } } } },
      attachments: { type: "object", description: "Attachment upload.", properties: { enabled: { type: "boolean" }, maxCount: { type: "number" } } },
      validations: { type: "array", description: "Validations gating the trigger.", items: { type: "object", properties: { field: { type: "string" }, rule: { type: "string" }, expr: { type: "string" }, message: { type: "string" } } } },
      csvTemplate: { type: "object", description: "CSV template to drop in webapp/data/.", properties: { name: { type: "string" }, content: { type: "string" } } }
    },
    required: ["namespace", "environmentId"]
  },
  async handler(args) {
    const { namespace, environmentId, workflowDefinitionId, workflowProject, moduleFolder, mtaProjectDir, cloudService, flp, triggerFields, upload, attachments, validations, csvTemplate } = args;
    if (!environmentId) return errText("environmentId is REQUIRED for a Start UI (GW0 — always ask, never default).");
    if (!namespace || !/^[a-z][a-z0-9_.]*$/.test(namespace)) return errText(`namespace must be lowercase dotted (e.g. com.acme.invoicestart). Got "${namespace}".`);

    const projectName = workflowProject || namespace.split(".")[1] || namespace.split(".").pop();
    const projectDir = mtaProjectDir || path.join(OUTPUT_DIR, projectName);

    let scaffold;
    try {
      scaffold = await scaffoldWorkflowModule({ kind: "start", namespace, moduleFolder, mtaProjectDir: projectDir, cloudService });
    } catch (e) { return errText(e.message); }

    const startNotes = await applyStartParams(scaffold.moduleDir, scaffold.identity, {
      environmentId, workflowDefinitionId, flp, triggerFields, upload, attachments, validations, csvTemplate
    });
    const mta = await wireWorkflowMta(projectDir, { mtaId: projectName, cloudService });

    return okText(
      `Created Start UI module:\n` +
      `  project : ${projectDir}\n` +
      `  module  : ${scaffold.moduleFolder}  (namespace ${namespace})\n` +
      `  environmentId: ${environmentId}${workflowDefinitionId ? `\n  definitionId : ${workflowDefinitionId}` : ""}\n` +
      `  files rewritten: ${scaffold.filesChanged.length}\n` +
      `  start config: ${startNotes.join("; ")}\n` +
      `  MTA: ${mta.wrote.join(", ")} (modules: ${mta.modules.map((m) => m.folder).join(", ")})\n\n` +
      `Next: validate_namespace on ${scaffold.moduleDir}; create_task_ui for the matching approval task; ` +
      `set destination sap_process_automation_service + bind the SAP Build Process Automation instance for run/deploy.`
    );
  }
};
