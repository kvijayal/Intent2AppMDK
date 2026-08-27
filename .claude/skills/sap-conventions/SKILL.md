---
name: sap-conventions
description: >
  Cross-cutting SAP conventions for Intent2App — namespace consistency (the #1 failure), project/
  folder layout, naming, tech-stack defaults, and the <app>/ deliverable layout. Load before
  scaffolding, naming a project, or wiring a manifest. Keywords: namespace, resource-roots, ui5.yaml
  metadata.name, sap.app.id, folder layout, naming, conventions, output layout, tech stack.
---

# SAP Conventions (Intent2App)

## The namespace rule (the #1 failure)
The identical namespace string must appear in all four places, and `ui5.yaml metadata.name` must be
all lowercase:

| Place | Field |
|---|---|
| `Component.(js\|ts)` | `extend("<ns>.Component")` / `@namespace <ns>` |
| `manifest.json` | `sap.app.id` |
| `index.html` | `data-sap-ui-resource-roots='{"<ns>": "./"}'` |
| `ui5.yaml` | `metadata.name` (lowercase) |

Run `mcp__intent2app__validate_namespace` after scaffolding or editing any of these.

## Tech-stack defaults
`@sap/cds ^9` · `@ui5/cli ^4` · `cds-plugin-ui5 ^0.16.3` · OData V4 · SAPUI5 1.120+ · theme
`sap_horizon` · `sap.m.*` controls · TypeScript for freestyle UI5 · CAP Node.js · dev run =
in-memory sqlite (CAP) / mock server (external/RAP).

## Output layout
Each app lands under `<app-name>/` at the project root with a deliverables subfolder so hand-over
docs never ship inside the build: `<app-name>/` (runnable code; `gen/`, `node_modules/` are
git-ignored) and `<app-name>/deliverables/` (markdown deliverables).

## References
- Full conventions → [`references/conventions.md`](references/conventions.md)
- Bootstrapping notes → [`references/bootstrapping.md`](references/bootstrapping.md)
