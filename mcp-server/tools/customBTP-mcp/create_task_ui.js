import path from "node:path";
import { OUTPUT_DIR } from "../../lib/starters.js";
import { scaffoldWorkflowModule, applyTaskContract, wireWorkflowMta } from "../../lib/workflow.js";
import { okText, errText } from "../_util.js";

export default {
  name: "create_task_ui",
  description:
    "Scaffold a SAP Build Process Automation Task UI (a My Inbox task form) into a shared workflow MTA " +
    "project under output/<workflowProject>. Clones the proven reference Task module, rewrites its " +
    "identity, and generates the sap.bpa.task contract (outcomes + input/output JSON-Schema), the " +
    "ObjectPageLayout sections, and the Component outcome wiring from the gate answers (GW0/GW-Task). " +
    "Requires the xs-app.json route to com.sap.spa.processautomation and an SAP Build Process " +
    "Automation instance binding for the inbox contract. The main thread collects inputs via gates first.",
  inputSchema: {
    type: "object",
    properties: {
      namespace: { type: "string", description: "Lowercase dotted namespace, e.g. com.acme.invoiceapprove." },
      environmentId: { type: "string", description: "SAP Build Process Automation environmentId. REQUIRED (GW0 — always ask)." },
      workflowProject: { type: "string", description: "Workflow MTA project name (shared with the Start UI). Defaults to the namespace's 2nd segment." },
      moduleFolder: { type: "string", description: "Folder name for this module under the project. Defaults to the last namespace segment." },
      mtaProjectDir: { type: "string", description: "Absolute project dir (overrides output/<workflowProject>)." },
      cloudService: { type: "string", description: "sap.cloud.service value shared across the workflow modules." },
      task: { type: "object", description: "Task metadata.", properties: { title: { type: "string" }, category: { type: "string" } } },
      outcomes: {
        type: "array", description: "Decision outcomes → My Inbox action buttons + sap.bpa.task.outcomes.",
        items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id"] }
      },
      sections: {
        type: "array", description: "Task screen sections → ObjectPageLayout + the context schema.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" }, title: { type: "string" }, kind: { type: "string", enum: ["form", "table"] },
            fields: { type: "array", items: { type: "object", properties: { name: { type: "string" }, label: { type: "string" }, type: { type: "string" }, editable: { type: "boolean" } }, required: ["name"] } }
          },
          required: ["name", "kind"]
        }
      },
      inputContext: { type: "object", description: "Explicit sap.bpa.task.inputs.properties (overrides the schema derived from sections)." },
      outputContext: { type: "object", description: "Explicit sap.bpa.task.outputs.properties (overrides derived)." }
    },
    required: ["namespace", "environmentId"]
  },
  async handler(args) {
    const { namespace, environmentId, workflowProject, moduleFolder, mtaProjectDir, cloudService, task, outcomes, sections, inputContext, outputContext } = args;
    if (!environmentId) return errText("environmentId is REQUIRED for a Task UI (GW0 — always ask, never default).");
    if (!namespace || !/^[a-z][a-z0-9_.]*$/.test(namespace)) return errText(`namespace must be lowercase dotted (e.g. com.acme.invoiceapprove). Got "${namespace}".`);

    const projectName = workflowProject || namespace.split(".")[1] || namespace.split(".").pop();
    const projectDir = mtaProjectDir || path.join(OUTPUT_DIR, projectName);

    let scaffold;
    try {
      scaffold = await scaffoldWorkflowModule({ kind: "task", namespace, moduleFolder, mtaProjectDir: projectDir, cloudService });
    } catch (e) { return errText(e.message); }

    const taskNotes = await applyTaskContract(scaffold.moduleDir, scaffold.identity, { task, outcomes, sections, inputContext, outputContext });
    const mta = await wireWorkflowMta(projectDir, { mtaId: projectName, cloudService });

    return okText(
      `Created Task UI module:\n` +
      `  project : ${projectDir}\n` +
      `  module  : ${scaffold.moduleFolder}  (namespace ${namespace})\n` +
      `  environmentId: ${environmentId}\n` +
      `  files rewritten: ${scaffold.filesChanged.length}\n` +
      `  task config: ${taskNotes.join("; ")}\n` +
      `  MTA: ${mta.wrote.join(", ")} (modules: ${mta.modules.map((m) => `${m.folder}${m.isTask ? " [task]" : ""}`).join(", ")})\n\n` +
      `Next: validate_namespace on ${scaffold.moduleDir}; confirm xs-app.json keeps the ^/bpmworkflowruntime/ → ` +
      `com.sap.spa.processautomation route; bind the SAP Build Process Automation instance; register the Task UI in My Inbox.`
    );
  }
};
