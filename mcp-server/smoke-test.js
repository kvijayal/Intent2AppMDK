// Dependency-free smoke test: validates the tool registry without needing the MCP SDK.
// Run: node smoke-test.js   (or: npm run smoke)
import assert from "node:assert";
import { allTools } from "./tools/index.js";

const EXPECTED = [
  // CAP / Fiori scaffolding
  "scaffold_app",
  "validate_namespace",
  "add_cds_entity",
  "generate_annotations",
  "gen_mock_from_edmx",
  "configure_service",
  "run_checks",
  "clean_core_check",
  // Workflow UI (SAP Build Process Automation)
  "create_start_ui",
  "create_task_ui",
  // UI5 (replicated from github.com/UI5/mcp-server)
  "ui5_get_guidelines",
  "ui5_get_version_info",
  "ui5_get_api_reference",
  "ui5_get_project_info",
  "ui5_run_manifest_validation",
  "ui5_run_ui5_linter",
  // CAP (replicated from github.com/cap-js/mcp-server)
  "cap_search_model",
  "cap_search_docs",
  // Fiori (replicated from SAP/open-ux-tools fiori-mcp-server)
  "fiori_search_docs",
  "fiori_list_apps",
  "fiori_download_odata_metadata"
];

assert.equal(allTools.length, EXPECTED.length, `expected ${EXPECTED.length} tools, got ${allTools.length}`);
for (const t of allTools) {
  assert.ok(t.name, "tool missing name");
  assert.ok(t.description && t.description.length > 20, `tool ${t.name} needs a real description`);
  assert.ok(t.inputSchema && t.inputSchema.type === "object", `tool ${t.name} needs an object inputSchema`);
  assert.equal(typeof t.handler, "function", `tool ${t.name} missing handler`);
}
const names = allTools.map((t) => t.name).sort();
assert.deepEqual(names, [...EXPECTED].sort(), "tool names do not match the expected set");

// Exercise a pure handler that needs no filesystem: generate_annotations inline.
const gen = allTools.find((t) => t.name === "generate_annotations");
const res = await gen.handler({
  target: "cds",
  service: "DemoService",
  entity: "Things",
  columns: ["name", "status"],
  statusField: "status",
  criticalityField: "statusCriticality"
});
assert.ok(res.content?.[0]?.text.includes("UI.LineItem"), "generate_annotations did not produce annotations");
assert.ok(res.content[0].text.includes("CriticalityRepresentation: #WithIcon"), "criticality representation missing");

// Workflow tools: environmentId must be a required input (GW0 — always asked, never defaulted).
for (const wfName of ["create_start_ui", "create_task_ui"]) {
  const wf = allTools.find((t) => t.name === wfName);
  assert.ok(wf, `${wfName} not registered`);
  assert.ok(wf.inputSchema.required?.includes("environmentId"), `${wfName} must require environmentId`);
  assert.ok(wf.inputSchema.required?.includes("namespace"), `${wfName} must require namespace`);
  const bad = await wf.handler({ namespace: "com.acme.x" }); // missing environmentId
  assert.ok(bad.isError, `${wfName} should reject a call with no environmentId`);
}

// Exercise ui5_get_guidelines — pure in-memory, no network.
const guidelines = allTools.find((t) => t.name === "ui5_get_guidelines");
const gRes = await guidelines.handler();
assert.ok(gRes.content?.[0]?.text.includes("sap.ui.define"), "ui5_get_guidelines missing coding rules");
assert.ok(gRes.content[0].text.includes("CAP"), "ui5_get_guidelines missing CAP section");

// Exercise cap_search_docs — pure in-memory keyword index.
const capDocs = allTools.find((t) => t.name === "cap_search_docs");
const capRes = await capDocs.handler({ query: "authorization restrict" });
assert.ok(capRes.content?.[0]?.text.includes("cap.cloud.sap"), "cap_search_docs did not return capire URLs");
assert.ok(/authorization/i.test(capRes.content[0].text), "cap_search_docs did not match the auth topic");

// Exercise fiori_search_docs — pure in-memory keyword index.
const fioriDocs = allTools.find((t) => t.name === "fiori_search_docs");
const fioriRes = await fioriDocs.handler({ query: "criticality status" });
assert.ok(/criticality/i.test(fioriRes.content?.[0]?.text || ""), "fiori_search_docs did not match the criticality topic");

console.log(`OK — ${allTools.length} tools registered and exercised: ${names.join(", ")}`);
