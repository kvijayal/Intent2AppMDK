// Replicated from https://github.com/UI5/mcp-server (Apache-2.0)
// Adapted to Intent2App ES-module style; tool names use our MCP namespace.
const GUIDELINES = `
# UI5 Development Guidelines

## 1. Coding Guidelines

- **NEVER** use global variables to access UI5 framework objects (e.g. \`sap.m.Button\`). Declare all
  dependencies explicitly so they are loaded asynchronously before your code runs.
  - JavaScript: \`sap.ui.define([...], function(...) {...})\` or dynamic \`sap.ui.require\`
  - TypeScript: ES6 \`import\` statements
  - XML: declare controls via their XML tag; for programmatic API (formatters, types) use a \`core:require\` directive

- **ALWAYS** use \`sap/ui/core/ComponentSupport\` to initialise a UI5 app in an HTML page:
  \`\`\`html
  <script id="sap-ui-bootstrap"
    src="resources/sap-ui-core.js"
    data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
    data-sap-ui-async="true"
    data-sap-ui-resource-roots='{"my.app": "./"}'
    ...>
  </script>
  \`\`\`

- **ALWAYS** use data binding in views to connect UI controls to data/i18n models.

- **ALWAYS** prefer built-in data types with format options:
  - OData types from \`sap.ui.model.odata.type\` (Decimal, String, DateTime…) — work with all model types.
  - Standard types from \`sap.ui.model.type\` only when no OData equivalent exists.
  - Write custom formatter functions only for business logic that no built-in type can handle.

- When editing \`*.properties\` files, **ALWAYS** apply the change to all relevant locales (i18n.properties AND i18n_de.properties, i18n_fr.properties, etc.).

- **NEVER** use inline script in HTML — all logic must be in dedicated JS/TS files (CSP compliance).

### TypeScript: Control Event Handler Types

- **UI5 >= 1.115.0:** import and use the specific event type \`<Control>$<Event>Event\`:
  \`\`\`ts
  import { Button$PressEvent } from "sap/m/Button";
  onPress(event: Button$PressEvent): void { ... }
  \`\`\`
- **UI5 < 1.115.0:** use the generic \`import Event from "sap/ui/base/Event"\`.

## 2. Tooling (Intent2App MCP tools)

- **API lookup:** use \`ui5_get_api_reference\` — returns the official UI5 API reference for the
  control/module, scoped to the project's own UI5 version.
- **Linting:** use \`ui5_run_ui5_linter\` — detects deprecated APIs, accessibility issues, and bugs.
  Confirm with the developer before applying auto-fixes (\`fix: true\`).
- **Manifest validation:** use \`ui5_run_manifest_validation\` — validates \`manifest.json\` structure
  and namespace consistency after any routing or metadata change.
- **Project inspection:** use \`ui5_get_project_info\` — reads \`ui5.yaml\` + \`package.json\` and
  returns framework name/version, dependencies, and project type.
- **Version info:** use \`ui5_get_version_info\` — queries the SAPUI5/OpenUI5 CDN for current,
  latest, and LTS version details.
- **Dev server:** the UI5 CLI server does **NOT** serve a default index. Always open files by
  full path: \`http://localhost:8080/index.html\`, not \`http://localhost:8080/\`.

## 3. CAP Integration

When creating a UI5 project inside a CAP project:

- **Location:** always under \`app/<name>/\` in the CAP project root.
- **CDS info:** run \`cds compile '*'\` (definitions) and \`cds compile '*' --to serviceinfo\`
  (service URLs + paths). Use these to set the manifest \`dataSources.uri\`.
- **Plugin:** run \`npm i -D cds-plugin-ui5\` in the CAP root — this plugin mounts the UI5 app
  on the \`cds watch\` server.
- **Run:** **ALWAYS** start from the CAP root with \`cds watch\`, never a separate \`ui5 serve\`
  inside the app folder.
- **Proxy:** **NEVER** configure \`ui5-middleware-simpleproxy\` — same-origin is guaranteed by
  \`cds watch\`.
- **Bootstrap:** use the CDN URL in \`index.html\` (\`https://ui5.sap.com/<version>/resources/sap-ui-core.js\`)
  and keep \`ui5.yaml\` minimal (no \`framework\` block). See the \`fiori-app-bootstrapping\` skill.

## 4. Forms

- **Never** use \`sap.ui.layout.form.SimpleForm\` unless explicitly requested.
- **Always** use \`sap.ui.layout.form.Form\` with \`sap.ui.layout.form.ColumnLayout\`.
- Default columns: M=2, L=3, XL=4 (override on explicit request only).
`;

export default {
  name: "ui5_get_guidelines",
  description:
    "Returns UI5 development guidelines that MUST be followed before any UI5 coding work — coding rules, tooling usage, CAP integration, and form layout. Load this before writing or reviewing any UI5/Fiori code.",
  inputSchema: { type: "object", properties: {} },
  async handler() {
    return { content: [{ type: "text", text: GUIDELINES.trim() }] };
  }
};
