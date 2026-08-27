// Workflow UI engine — shared by create_start_ui and create_task_ui.
//
// SAP Build Process Automation has two custom UI module types:
//   • Start UI  — a UI5 app that POSTs a new workflow instance (FLP tile, crossNavigation inbound).
//   • Task UI   — a UI5 app loaded by My Inbox; its manifest carries the `sap.bpa.task` contract
//                 (outcomes + input/output JSON-Schema) and its Component reads startupParameters.
//
// Both are plain SAPUI5 apps; what makes them workflow modules is a small set of manifest + config
// "key drivers" (see references in .claude/skills/workflow-ui-bootstrapping/). This engine clones a
// proven reference module, rewrites its identity tokens, then generates the field-specific content
// (Start form/validations/trigger, Task sap.bpa.task contract + sections) from the gate answers, and
// (re)generates the combined MTA wrapper so a Start + Task pair live in one deployable project.
import path from "node:path";
import { promises as fs } from "node:fs";
import { REFERENCE_APPS, OUTPUT_DIR } from "./starters.js";
import { copyDir, exists, walk, readText, writeText, readJSON } from "./fs-utils.js";
import { rewriteNamespace } from "./namespace.js";

// ── Reference templates the user supplied (projectbudgetapproval_ui) ─────────────
const WF_PROJECT = path.join(REFERENCE_APPS, "projectbudgetapproval_ui");

export const WF_TEMPLATES = {
  start: {
    dir: path.join(WF_PROJECT, "financialData"),
    base: identityFromNs("com.budget.financialData", "importfinancialdata"),
    note: "Workflow Start UI (submit / trigger a workflow instance)"
  },
  task: {
    dir: path.join(WF_PROJECT, "approveFinancialData"),
    base: identityFromNs("com.budget.approveFinancialData", "importfinancialdata"),
    note: "Workflow Task UI (My Inbox task — sap.bpa.task contract)"
  }
};

// ── Identity helpers ─────────────────────────────────────────────────────────────
/** Build the full token identity of a module from its dotted namespace. */
export function identityFromNs(dottedNs, cloudService) {
  const lastSeg = dottedNs.split(".").pop();
  return {
    dottedNs,                              // com.budget.financialData
    slashNs: dottedNs.replace(/\./g, "/"), // com/budget/financialData
    moduleId: lastSeg,                     // financialData  (index.html data-settings id)
    flatId: dottedNs.replace(/\./g, ""),   // combudgetfinancialData (archive / FLP intent)
    pkgName: lastSeg.toLowerCase(),        // financialdata  (package.json name)
    cloudService: cloudService || "importfinancialdata"
  };
}

export function sanitizeId(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ── Identity rewrite ─────────────────────────────────────────────────────────────
/**
 * Rewrite every occurrence of the base module identity to the target across the copied module.
 * Order matters: longer/contained tokens first (importfinancialdata BEFORE financialdata; the flat
 * id BEFORE the namespace would break, so namespace dotted/slash is done first by rewriteNamespace).
 */
export async function rewriteWorkflowIdentity(moduleDir, base, target) {
  // 1) dotted + slash namespace (manifest id, Component, controllerName, ui5.yaml name, i18n bundle, index roots)
  const nsChanged = await rewriteNamespace(moduleDir, base.dottedNs, target.dottedNs);

  // The SAP basic-app template also writes a hybrid "dotted-parent/segment" module path
  // (e.g. module:com.budget/financialData/test/initMockServer) which rewriteNamespace's pure
  // dotted/slash forms miss. Map the hybrid and the bare parent label too.
  const baseParent = base.dottedNs.replace(/\.[^.]+$/, "");      // com.budget
  const targetParent = target.dottedNs.replace(/\.[^.]+$/, "");  // com.acme(.fin)
  const baseHybrid = `${baseParent}/${base.moduleId}`;           // com.budget/financialData
  const targetHybrid = `${targetParent}/${target.moduleId}`;    // com.acme/invoicestart

  // 2) the remaining identity tokens, ordered so a contained token isn't half-replaced.
  const files = await walk(moduleDir);
  const changed = new Set(nsChanged);
  for (const f of files) {
    if (!/\.(json|js|ts|xml|html|ya?ml|properties|md)$/.test(f)) continue;
    let s = await readText(f);
    const before = s;
    // hybrid module path first (contains the parent token).
    s = s.split(baseHybrid).join(targetHybrid);
    // cloudService contains pkgName as a substring → replace cloudService first.
    s = s.split(base.cloudService).join(target.cloudService);
    // flat id (combudget…) — archive name, FLP intent prefix.
    s = s.split(base.flatId).join(target.flatId);
    // index.html data-settings id: {"id" : "financialData"}
    s = s
      .split(`"id" : "${base.moduleId}"`).join(`"id" : "${target.moduleId}"`)
      .split(`"id": "${base.moduleId}"`).join(`"id": "${target.moduleId}"`);
    // package.json name (lowercase) — scope to that exact key to avoid touching other strings.
    s = s.split(`"name": "${base.pkgName}"`).join(`"name": "${target.pkgName}"`);
    // bare parent label last (e.g. README "Namespace: com.budget"); safe after the fuller forms.
    s = s.split(baseParent).join(targetParent);
    if (s !== before) { await writeText(f, s); changed.add(path.relative(moduleDir, f)); }
  }
  return [...changed];
}

// ── Scaffold one module ──────────────────────────────────────────────────────────
/**
 * Copy a workflow template module into <mtaProjectDir>/<moduleFolder> and rewrite its identity.
 * Returns { moduleDir, moduleFolder, identity, filesChanged }.
 */
export async function scaffoldWorkflowModule({ kind, namespace, moduleFolder, mtaProjectDir, cloudService }) {
  const tpl = WF_TEMPLATES[kind];
  if (!tpl) throw new Error(`Unknown workflow kind "${kind}". Use "start" or "task".`);
  if (!(await exists(tpl.dir))) throw new Error(`Workflow template missing at ${tpl.dir}. Populate reference-apps/projectbudgetapproval_ui first.`);
  if (!namespace || !/^[a-z][a-z0-9_.]*$/.test(namespace))
    throw new Error(`namespace must be lowercase dotted (e.g. com.acme.invoicestart). Got "${namespace}".`);

  const folder = moduleFolder || namespace.split(".").pop();
  const moduleDir = path.join(mtaProjectDir, folder);
  if (await exists(moduleDir)) throw new Error(`Module target already exists: ${moduleDir}. Choose another moduleFolder.`);

  const target = identityFromNs(namespace, cloudService || sanitizeId(path.basename(mtaProjectDir)) + "svc");
  await copyDir(tpl.dir, moduleDir);                 // copyDir already skips .git / node_modules / dist
  const filesChanged = await rewriteWorkflowIdentity(moduleDir, tpl.base, target);
  return { moduleDir, moduleFolder: folder, identity: target, filesChanged };
}

// ── Start UI parameterisation ────────────────────────────────────────────────────
/**
 * Inject the Start UI's workflow trigger settings and (optionally) a generated form.
 * Always sets environmentId + definitionId + FLP inbound. If triggerFields are given and upload is
 * off, generates a SimpleForm + payload; otherwise keeps the template's CSV-import flow.
 */
export async function applyStartParams(moduleDir, identity, {
  environmentId, workflowDefinitionId, flp, triggerFields, upload, attachments, validations, csvTemplate
} = {}) {
  const notes = [];

  // 1) Trigger settings in Homepage.controller.js
  const ctrl = path.join(moduleDir, "webapp", "controller", "Homepage.controller.js");
  if (await exists(ctrl)) {
    let s = await readText(ctrl);
    if (environmentId) s = s.replace(/workflow-instances\?environmentId=[^"']*/g, `workflow-instances?environmentId=${environmentId}`);
    if (workflowDefinitionId) {
      // Replace the hardcoded definitionId string in the jsonData = { definitionId: "…" } line.
      s = s.replace(/definitionId:\s*"[^"]*"/g, `definitionId: "${workflowDefinitionId}"`);
    }
    await writeText(ctrl, s);
    notes.push("Homepage.controller.js: environmentId + definitionId injected");
  }

  // 2) FLP inbound in manifest crossNavigation
  if (flp && Object.keys(flp).length) {
    const manifestPath = path.join(moduleDir, "webapp", "manifest.json");
    const m = await readJSON(manifestPath);
    m["sap.app"] = m["sap.app"] || {};
    m["sap.app"].crossNavigation = {
      inbounds: {
        newtile: {
          semanticObject: flp.semanticObject || "workflow",
          action: flp.action || "start",
          icon: flp.icon || "sap-icon://begin",
          title: flp.title || "Start Workflow",
          subTitle: flp.subTitle || "Submit for Approval"
        }
      }
    };
    await writeText(manifestPath, JSON.stringify(m, null, 2) + "\n");
    notes.push("manifest crossNavigation inbound set");
  }

  // 3) Optional generated form (field-driven) — only when no CSV upload flow is requested.
  if (Array.isArray(triggerFields) && triggerFields.length && !(upload && upload.enabled)) {
    await generateStartForm(moduleDir, identity, { triggerFields, validations, attachments });
    notes.push(`Homepage form generated from ${triggerFields.length} field(s)`);
  } else {
    notes.push("kept template CSV-import flow (no triggerFields, or upload enabled)");
  }

  // 4) Drop a provided CSV template
  if (csvTemplate && csvTemplate.content) {
    const name = csvTemplate.name || "Template.csv";
    await writeText(path.join(moduleDir, "webapp", "data", name), csvTemplate.content);
    notes.push(`CSV template webapp/data/${name} written`);
  }

  return notes;
}

/** Generate a simple field-driven Start form (Homepage.view.xml) + a trigger payload builder. */
async function generateStartForm(moduleDir, identity, { triggerFields, validations = [], attachments }) {
  const labelFor = (f) => f.label || f.name;
  const inputs = triggerFields.map((f) => {
    const req = f.mandatory ? ` required="true"` : "";
    return `                        <Label text="${labelFor(f)}"${f.mandatory ? ' required="true"' : ""}/>\n` +
           `                        <Input id="in_${f.name}" value="{form>/${f.name}}"${req}/>`;
  }).join("\n");
  const upload = attachments && attachments.enabled
    ? `\n                        <Label text="Attachment"/>\n                        <u:FileUploader id="attachment" name="attachment" width="100%"/>`
    : "";

  const view = `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns="sap.m" xmlns:u="sap.ui.unified" xmlns:f="sap.ui.layout.form" displayBlock="true" controllerName="${identity.dottedNs}.controller.Homepage">
    <Page showHeader="false">
        <f:SimpleForm id="startForm" editable="true" layout="ResponsiveGridLayout" labelSpanXL="4" labelSpanL="4" labelSpanM="12" labelSpanS="12" columnsXL="1" columnsL="1" columnsM="1">
            <f:content>
${inputs}${upload}
            </f:content>
        </f:SimpleForm>
        <footer>
            <OverflowToolbar>
                <ToolbarSpacer/>
                <Button id="import" type="Emphasized" text="Send for Approval" press="onTriggerWorkflow"/>
            </OverflowToolbar>
        </footer>
    </Page>
</mvc:View>
`;
  await writeText(path.join(moduleDir, "webapp", "view", "Homepage.view.xml"), view);

  // Replace the CSV-driven payload build in onTriggerWorkflow with a form-model build + validation.
  const ctrlPath = path.join(moduleDir, "webapp", "controller", "Homepage.controller.js");
  if (await exists(ctrlPath)) {
    let s = await readText(ctrlPath);
    const validationLines = (validations || []).map((v) =>
      `                    if (!(${jsValidation(v)})) { MessageToast.show(${JSON.stringify(v.message || (labelOf(v) + " is invalid"))}); this.getView().setBusy(false); return; }`
    ).join("\n");
    const mandatoryChecks = triggerFields.filter((f) => f.mandatory).map((f) =>
      `                    if (!form.${f.name}) { MessageToast.show(${JSON.stringify((f.label || f.name) + " is required")}); this.getView().setBusy(false); return; }`
    ).join("\n");
    // Prepend an onInit that seeds an empty form model, and rewrite the payload assembly.
    s = s.replace(
      /onInit:\s*function\s*\(\s*\)\s*\{\s*\}/,
      `onInit: function () { this.getView().setModel(new JSONModel({}), "form"); }`
    );
    s = s.replace(
      /var jsonData = sap\.ui\.getCore\(\)\.getModel\("csv"\)\.getData\(\);[\s\S]*?temp\.requestorEmail[^\n]*\n/,
      `var form = this.getView().getModel("form").getData();\n${mandatoryChecks ? mandatoryChecks + "\n" : ""}${validationLines ? validationLines + "\n" : ""}                    var temp = { d: [form], metadata: form };\n`
    );
    await writeText(ctrlPath, s);
  }
}

function labelOf(v) { return v.field || "field"; }
function jsValidation(v) {
  const f = `form.${v.field}`;
  switch ((v.rule || "").toLowerCase()) {
    case "required":  return `${f}`;
    case "number":    return `!isNaN(parseFloat(${f}))`;
    case "positive":  return `parseFloat(${f}) > 0`;
    case "email":     return `/^[^@\\s]+@[^@\\s]+$/.test(${f})`;
    default:          return v.expr || `${f}`; // custom JS expression on `form`
  }
}

// ── Task UI parameterisation ─────────────────────────────────────────────────────
/**
 * Generate the sap.bpa.task contract (outcomes + input/output schema), the App.view.xml sections,
 * and wire the Component outcomes. When no sections/outcomes are given, keeps the template content.
 */
export async function applyTaskContract(moduleDir, identity, { task = {}, outcomes, sections, inputContext, outputContext } = {}) {
  const notes = [];
  const manifestPath = path.join(moduleDir, "webapp", "manifest.json");
  const m = await readJSON(manifestPath);

  if (Array.isArray(outcomes) && outcomes.length) {
    const props = buildContextSchema(sections, inputContext);
    m["sap.bpa.task"] = {
      _version: "1.0.0",
      outcomes: outcomes.map((o) => ({ id: o.id, label: o.label || o.id })),
      inputs: { $schema: "http://json-schema.org/draft-07/schema", title: "input", type: "object", properties: props },
      outputs: { $schema: "http://json-schema.org/draft-07/schema", title: "output", type: "object", properties: buildContextSchema(sections, outputContext, true) },
      category: task.category || "standard"
    };
    await writeText(manifestPath, JSON.stringify(m, null, 2) + "\n");
    notes.push(`sap.bpa.task contract generated (${outcomes.length} outcome(s))`);

    // Generate the App view from sections + wire Component outcomes.
    if (Array.isArray(sections) && sections.length) {
      await writeText(path.join(moduleDir, "webapp", "view", "App.view.xml"), generateTaskView(identity, { task, sections }));
      notes.push(`App.view.xml generated (${sections.length} section(s))`);
    }
    await wireTaskOutcomes(moduleDir, outcomes);
    notes.push("Component outcomes wired (inboxAPI.addAction per outcome)");
  } else {
    notes.push("kept template sap.bpa.task contract (no outcomes provided)");
  }
  return notes;
}

function jsonType(t) {
  const x = (t || "string").toLowerCase();
  if (x.includes("num") || x.includes("dec") || x.includes("int") || x.includes("amount")) return "number";
  if (x.includes("bool")) return "boolean";
  return "string";
}

/** Build a JSON-Schema `properties` object from task sections (table → array, form → object). */
function buildContextSchema(sections, explicit, isOutput) {
  if (explicit && typeof explicit === "object") return explicit;
  const props = {};
  for (const sec of sections || []) {
    const fieldProps = {};
    for (const f of sec.fields || []) fieldProps[f.name] = { title: f.label || f.name, type: jsonType(f.type) };
    if (sec.kind === "table") {
      props[sec.name || "items"] = { type: "array", title: sec.title || sec.name, items: { type: "object", properties: fieldProps } };
    } else {
      props[sec.name || "metadata"] = { type: "object", title: sec.title || sec.name, properties: fieldProps };
    }
  }
  if (isOutput) { props.ApproverComment = { type: "string", title: "Approver Comment" }; props.decision = { type: "string", title: "decision" }; }
  return props;
}

/** Generate a Task UI App view: an ObjectPageLayout with a section per requested section. */
function generateTaskView(identity, { task = {}, sections = [] }) {
  const sectionXml = sections.map((sec) => {
    if (sec.kind === "table") {
      const cols = (sec.fields || []).map((f) => `                                <Column hAlign="Center"><Text text="${f.label || f.name}"/></Column>`).join("\n");
      const cells = (sec.fields || []).map((f) => f.editable
        ? `                                    <Input value="{${f.name}}"/>`
        : `                                    <Text text="{${f.name}}"/>`).join("\n");
      return `            <uxap:ObjectPageSection title="${sec.title || sec.name}" titleUppercase="false">
                <uxap:subSections><uxap:ObjectPageSubSection>
                    <uxap:blocks>
                        <Table items="{/${sec.name || "items"}}">
                            <columns>
${cols}
                            </columns>
                            <items><ColumnListItem><cells>
${cells}
                            </cells></ColumnListItem></items>
                        </Table>
                    </uxap:blocks>
                </uxap:ObjectPageSubSection></uxap:subSections>
            </uxap:ObjectPageSection>`;
    }
    const formFields = (sec.fields || []).map((f) =>
      `                            <Label text="${f.label || f.name}"/>\n` +
      `                            <Input value="{/${sec.name || "metadata"}/${f.name}}" editable="${!!f.editable}"/>`).join("\n");
    return `            <uxap:ObjectPageSection title="${sec.title || sec.name}" titleUppercase="false">
                <uxap:subSections><uxap:ObjectPageSubSection>
                    <uxap:blocks>
                        <f:SimpleForm editable="true" layout="ResponsiveGridLayout" labelSpanXL="4" labelSpanL="4" columnsXL="1" columnsL="1">
                            <f:content>
${formFields}
                            </f:content>
                        </f:SimpleForm>
                    </uxap:blocks>
                </uxap:ObjectPageSubSection></uxap:subSections>
            </uxap:ObjectPageSection>`;
  }).join("\n");

  return `<mvc:View controllerName="${identity.dottedNs}.controller.App" xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m" xmlns:l="sap.ui.layout" xmlns:uxap="sap.uxap" xmlns:core="sap.ui.core" xmlns:f="sap.ui.layout.form">
    <App id="app">
        <pages>
            <Page id="page" title="${task.title || "{i18n>title}"}">
                <content>
                    <uxap:ObjectPageLayout id="ObjectPageLayout" upperCaseAnchorBar="false">
                        <uxap:sections>
${sectionXml}
                        </uxap:sections>
                    </uxap:ObjectPageLayout>
                </content>
            </Page>
        </pages>
    </App>
</mvc:View>
`;
}

/** Inject one inboxAPI.addAction per outcome into the Task Component, completing with that decision. */
async function wireTaskOutcomes(moduleDir, outcomes) {
  const compPath = path.join(moduleDir, "webapp", "Component.js");
  if (!(await exists(compPath))) return;
  let s = await readText(compPath);
  const block = outcomes.map((o) =>
    `                    startupParameters.inboxAPI.addAction({ action: ${JSON.stringify(o.label || o.id)}, label: ${JSON.stringify(o.label || o.id)} },\n` +
    `                        function () { that._completeTask(that.getTaskInstanceID(), "Yes", ${JSON.stringify(o.id)}); });`
  ).join("\n");
  // Insert just before the resolve() that closes the request-completed handler, replacing the single
  // template "oSendAction" registration if present; otherwise append before that.resolve().
  if (s.includes("startupParameters.inboxAPI.addAction({")) {
    s = s.replace(
      /var oSendAction[\s\S]*?startupParameters\.inboxAPI\.addAction\(\{[\s\S]*?\}, oSendAction\.onBtnPressed\);/,
      `// Generated outcome actions\n${block}`
    );
  } else {
    s = s.replace(/that\.resolve\(\);/, `${block}\n                    that.resolve();`);
  }
  await writeText(compPath, s);
}

// ── MTA wrapper ──────────────────────────────────────────────────────────────────
/** Discover workflow modules in a project dir (subfolders with webapp/manifest.json). */
export async function discoverWorkflowModules(mtaProjectDir) {
  const out = [];
  let entries;
  try { entries = await fs.readdir(mtaProjectDir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const manifestPath = path.join(mtaProjectDir, e.name, "webapp", "manifest.json");
    if (!(await exists(manifestPath))) continue;
    try {
      const m = JSON.parse(await readText(manifestPath));
      const id = m["sap.app"]?.id;
      if (!id) continue;
      out.push({ folder: e.name, id, flatId: id.replace(/\./g, ""), isTask: !!m["sap.bpa.task"], cloudService: m["sap.cloud"]?.service });
    } catch { /* ignore */ }
  }
  return out;
}

/** (Re)generate mta.yaml, xs-security.json and the root package.json for the workflow project. */
export async function wireWorkflowMta(mtaProjectDir, { mtaId, cloudService, processAutomationService = "sbpa" } = {}) {
  const modules = await discoverWorkflowModules(mtaProjectDir);
  if (!modules.length) return { modules, wrote: [] };
  const id = sanitizeId(mtaId || path.basename(mtaProjectDir)) || "workflowmta";
  const svc = cloudService || modules[0].cloudService || (id + "svc");
  const wrote = [];

  await writeText(path.join(mtaProjectDir, "mta.yaml"), renderMtaYaml({ id, svc, modules, processAutomationService }));
  wrote.push("mta.yaml");

  const xsSecPath = path.join(mtaProjectDir, "xs-security.json");
  await writeText(xsSecPath, JSON.stringify({
    xsappname: id, "tenant-mode": "dedicated", description: "Security profile of called application",
    scopes: [{ name: "uaa.user", description: "UAA" }],
    "role-templates": [{ name: "Token_Exchange", description: "UAA", "scope-references": ["uaa.user"] }]
  }, null, 2) + "\n");
  wrote.push("xs-security.json");

  const rootPkgPath = path.join(mtaProjectDir, "package.json");
  if (!(await exists(rootPkgPath))) {
    await writeText(rootPkgPath, JSON.stringify({
      name: id, version: "0.0.1", description: "Workflow UI MTA (Start + Task) — Build and deployment scripts",
      scripts: { clean: "rimraf resources mta_archives", build: "rimraf resources mta_archives && mbt build --mtar archive", deploy: "cf deploy mta_archives/archive.mtar" },
      devDependencies: { mbt: "^1.2.18", rimraf: "^3.0.2" }
    }, null, 2) + "\n");
    wrote.push("package.json");
  }
  return { modules, wrote, mtaId: id, cloudService: svc };
}

function renderMtaYaml({ id, svc, modules, processAutomationService }) {
  const destLines = modules.map((mod) => `        - artifacts:\n          - ${mod.flatId}.zip\n          name: ${mod.flatId}\n          target-path: resources/`).join("\n");
  const html5Modules = modules.map((mod) => `- name: ${mod.flatId}
  type: html5
  path: ${mod.folder}
  build-parameters:
    build-result: dist
    builder: custom
    commands:
    - npm install
    - npm run build:cf
    supported-platforms: []`).join("\n");

  return `_schema-version: "3.2"
ID: ${id}
version: 0.0.1
modules:
- name: ${id}-destination-content
  type: com.sap.application.content
  requires:
  - name: ${id}-destination-service
    parameters:
      content-target: true
  - name: ${id}_html_repo_host
    parameters:
      service-key:
        name: ${id}_html_repo_host-key
  - name: uaa_${id}
    parameters:
      service-key:
        name: uaa_${id}-key
  parameters:
    content:
      subaccount:
        destinations:
        - Name: ${svc}_${id}_html_repo_host
          ServiceInstanceName: ${id}-html5-app-host-service
          ServiceKeyName: ${id}_html_repo_host-key
          sap.cloud.service: ${svc}
        - Authentication: OAuth2UserTokenExchange
          Name: ${svc}_uaa_${id}
          ServiceInstanceName: ${id}-xsuaa-service
          ServiceKeyName: uaa_${id}-key
          sap.cloud.service: ${svc}
        existing_destinations_policy: ignore
  build-parameters:
    no-source: true
- name: ${id}-app-content
  type: com.sap.application.content
  path: .
  requires:
  - name: ${id}_html_repo_host
    parameters:
      content-target: true
  build-parameters:
    build-result: resources
    requires:
${destLines}
${html5Modules}
resources:
- name: ${id}-destination-service
  type: org.cloudfoundry.managed-service
  parameters:
    config:
      HTML5Runtime_enabled: true
      init_data:
        instance:
          destinations:
          - Authentication: NoAuthentication
            Name: ui5
            ProxyType: Internet
            Type: HTTP
            URL: https://ui5.sap.com
          existing_destinations_policy: update
      version: 1.0.0
    service: destination
    service-name: ${id}-destination-service
    service-plan: lite
- name: ${id}_html_repo_host
  type: org.cloudfoundry.managed-service
  parameters:
    service: html5-apps-repo
    service-name: ${id}-html5-app-host-service
    service-plan: app-host
- name: uaa_${id}
  type: org.cloudfoundry.managed-service
  parameters:
    path: ./xs-security.json
    service: xsuaa
    service-name: ${id}-xsuaa-service
    service-plan: application
- name: ${processAutomationService}
  type: org.cloudfoundry.existing-service
parameters:
  deploy_mode: html5-repo
`;
}

export { OUTPUT_DIR };
