---
name: fiori-freestyle
description: >
  Freestyle SAPUI5 (TypeScript) development for Intent2App — hand-built MVC when Fiori Elements
  can't express the UX. Covers Component + async routing, XML views/controllers, OData V4 model
  settings, i18n, and standalone vs in-CAP serving. Load when building a freestyle UI5 app or
  writing UI5 controllers/views. Keywords: freestyle, UI5, TypeScript, MVC, Router, navTo,
  XML view, controller, JSONModel, ODataModel v4, IAsyncContentCreation, sap.m.
---

# Freestyle UI5 (TypeScript)

Use only when a floorplan (Fiori Elements) cannot express the required UX (Gate C). Canonical
Two starters exist — pick by context:
- **In CAP** (served by `cds watch` via `cds-plugin-ui5`): `scaffold_app` (`cap-freestyle`) from `reference-apps/cap-fullstack-freestyle/`; run via `npm run watch-freestyleapp`.
- **Standalone / external service**: `scaffold_app` (`freestyle-ui5`) from `reference-apps/freestyle-ui5-ts/` (TypeScript, OPA5 + QUnit, mock + proxy); run via `start:mock` / `start:proxy`.

Never hand-roll the bootstrap — always start from the matching starter.

## Conventions (HARD CONSTRAINTS)
- Theme `sap_horizon`; controls `sap.m.*` only (`sap.m.Table` responsive unless dense/analytical).
- `Component` extends `sap/ui/core/UIComponent` with `IAsyncContentCreation`; async routing on.
- Navigate via `Router.navTo()`; model access via `this.getView().getModel()` — never
  `sap.ui.getCore()`, no jQuery.
- OData V4 model settings: `operationMode: "Server"`, `autoExpandSelect: true`, `groupId: "$auto"`.
- All user-facing strings in i18n; no `console.log` (use the UI5 `Log` module); no hardcoded URLs.
- Namespace identical in Component / manifest `sap.app.id` / index.html resource-roots / `ui5.yaml`
  (lowercase) — run `mcp__intent2app__validate_namespace`.

## References
- Standalone freestyle (own router/index.html) → [`references/freestyle-standalone.md`](references/freestyle-standalone.md)
- Freestyle inside a CAP project (served by cds watch) → [`references/freestyle-in-cap.md`](references/freestyle-in-cap.md)

Manifest routing/config details are in the `fiori-bootstrap` skill; tests in `sap-unit-testing`.
