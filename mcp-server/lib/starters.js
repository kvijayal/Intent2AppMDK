// Maps a chosen app type to a bundled reference-app starter and resolves key paths.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..", ".."); // Intent2App/
export const REFERENCE_APPS = path.join(PROJECT_ROOT, "reference-apps");
export const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

// The base namespace every bundled starter ships with; scaffold_app rewrites it to the target.
export const BASE_NAMESPACE = "com.intent2app.sample";

export const STARTERS = {
  "cap-service":   { dir: "cap-service-only",                note: "CAP backend only, no UI" },
  "cap-fe-lrop":   { dir: "cap-fullstack-listreport",        note: "CAP + Fiori Elements List Report + Object Page" },
  "cap-fe-alp":    { dir: "cap-fullstack-listreport",        note: "CAP + Fiori Elements; convert ListReport target to Analytical List Page (see skills/fiori-bootstrap/references/analytical-list-page.md)" },
  "cap-fe-op":     { dir: "cap-fullstack-listreport",        note: "CAP + Fiori Elements Object Page focus; remove the ListReport target from manifest routing" },
  "cap-fpm":       { dir: "cap-fullstack-listreport",        note: "CAP + FPM custom page (see skills/fiori-bootstrap/references/fpm.md)" },
  "freestyle-ui5": { dir: "freestyle-ui5-ts",                note: "Freestyle UI5 (TypeScript)" },
  "cap-freestyle":  { dir: "cap-fullstack-freestyle",        note: "CAP + Freestyle UI5 (JavaScript) served by cds-plugin-ui5" },
  "external-fe":   { dir: "fiori-elements-external-service", note: "Fiori Elements bound to external/RAP OData via EDMX + mock + proxy" }
};

export function resolveStarter(appType) {
  const s = STARTERS[appType];
  if (!s) return null;
  return { ...s, path: path.join(REFERENCE_APPS, s.dir) };
}

// SAP Build Process Automation workflow UI templates. NOT part of STARTERS / scaffold_app — these
// carry a different base namespace (com.budget.*) and extra workflow drivers, so they must be
// scaffolded via the dedicated create_start_ui / create_task_ui tools (lib/workflow.js), not the
// generic namespace rewrite. Listed here for discovery only.
export const WORKFLOW_STARTERS = {
  "workflow-start": { dir: "projectbudgetapproval_ui/financialData",        tool: "create_start_ui", note: "Workflow Start UI (trigger a workflow instance)" },
  "workflow-task":  { dir: "projectbudgetapproval_ui/approveFinancialData", tool: "create_task_ui",  note: "Workflow Task UI (My Inbox task — sap.bpa.task contract)" }
};
