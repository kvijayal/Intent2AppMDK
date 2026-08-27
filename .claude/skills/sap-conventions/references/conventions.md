# Engineering Conventions — Intent2App

Binding conventions for every solution generated in this workspace. They make the codebase
self-contained: even without the optional `ui5` plugin, everything needed to write correct CAP +
UI5 code is here. The `skills/` encode the same rules in more depth; the `mcp__intent2app__*` tools
enforce them. Versions: `@sap/cds ^9` · `@ui5/cli ^4` · `cds-plugin-ui5 ^0.16.3` ·
`@sap-ux/ui5-middleware-fe-mockserver 2` · `jest ^29` · OData **V4** · SAPUI5 1.120+/1.146 ·
TypeScript for freestyle UI5 · theme `sap_horizon`.

## 1. CDS naming patterns (CAP)

| Artifact | Convention | Example |
|---|---|---|
| Entity | PascalCase, plural | `PurchaseOrders`, `Products` |
| Field | camelCase | `poNumber`, `totalAmount`, `modifiedAt` |
| Service | PascalCase ending `Service` | `PurchaseOrderService` |
| Service path | lowercase | `@(path: '/odata/v4/purchaseorder')` |
| Type / enum | PascalCase type, UPPER enum values | `type POStatusType : String(20) enum { DRAFT = 'DRAFT'; ... }` |
| Action / function | PascalCase | `approve`, `SetToHandover` |

- Reuse `@sap/cds/common` aspects: `managed` (createdAt/By, modifiedAt/By), `cuid` (UUID key).
- `Association to X` for references; `Composition of many Y on Y.parent = $self` for owned children.
- `@odata.etag` on a managed timestamp for any user-edited entity (optimistic concurrency).
- Money is always an amount + currency code, linked via `@Measures.ISOCurrency`.

## 2. UI5 namespace + the 4-place rule

The **identical** namespace string must appear in all four places, and `ui5.yaml metadata.name` must
be **all lowercase** (`^[a-z][0-9a-z-_.]*$`). Any mismatch → `failed to load Component.js`.

| Place | Field |
|---|---|
| `Component.(js\|ts)` | `extend("<ns>.Component")` / `@namespace <ns>` |
| `manifest.json` | `sap.app.id` |
| `index.html` | `data-sap-ui-resource-roots='{"<ns>": "./"}'` |
| `ui5.yaml` | `metadata.name` (lowercase) |

Run `mcp__intent2app__validate_namespace` after scaffolding or editing any of these. Namespace is
lowercase dotted: `com.clientname.appname`.

## 3. File & folder naming

| Artifact | Convention | Example |
|---|---|---|
| XML view | PascalCase `.view.xml` | `PurchaseOrderList.view.xml` |
| Controller | PascalCase `.controller.(js\|ts)` | `PurchaseOrderList.controller.ts` |
| Route name | PascalCase | `RoutePurchaseOrderList` |
| i18n key | camelCase | `appTitle`, `btnSave`, `lblStatus` |
| CSS class | kebab-case, app-prefixed | `poapp-status-row` |

Standard CAP layout: `db/schema.cds`, `srv/service.cds`, `srv/service.js`, `srv/annotations.cds`,
`app/<ui>/`, `test/`. Fiori app: `webapp/{Component,index.html,manifest.json,view/,controller/,model/,i18n/,localService/}`.

## 4. JavaScript / TypeScript style

- **No `console.log`** — `cds.log('<area>')` in CAP, the UI5 `Log` module in the frontend.
- **No jQuery** — deprecated in UI5 1.120+; use `sap.ui.require` / ES module imports.
- **No `sap.ui.getCore()`** for model access — `this.getView().getModel()` / `getModel("<name>")`.
- **Navigate** via `this.getOwnerComponent().getRouter().navTo(...)` — never `window.location`.
- **All user-facing strings** via i18n resource bundles — never hard-code labels.
- **TypeScript** for freestyle UI5: `tsc --noEmit` must pass; transpiled by `ui5-tooling-transpile`.
- **`sap.m.*` controls only**; `sap.m.Table` (responsive) unless data is dense/analytical (>8 columns), then `sap.ui.table.Table`.

## 5. CDS annotation patterns

- Annotations live in **`srv/annotations.cds`** (`annotate Service.Entity with @(...)`) — never inline in `service.cds`.
- **Always `contextPath`** in Fiori Elements targets — `entitySet` is deprecated.
- **Criticality = SAP standard enum:** `0` Neutral · `1` Negative (red) · `2` Critical (orange) · `3` Positive (green). Render status via a `UI.DataPoint` with `Criticality` + `CriticalityRepresentation: #WithIcon`; reference it from `UI.LineItem`/`UI.HeaderFacets` as a `UI.DataFieldForAnnotation`. Hide the raw integer with `UI.Hidden`.
- **Value helps:** `Common.ValueListWithFixedValues: true` for enums; `Common.ValueList` with `Common.ValueListParameterInOut`/`...DisplayOnly` for reference lookups.
- **Side effects:** declare `Common.SideEffects` so dependent fields/actions refresh after a trigger field changes (e.g. recompute totals after a quantity edit).
- **Actions** surfaced as `UI.DataFieldForAction` — never trigger OData actions from controller code in Fiori Elements.
- Labels via `Common.Label`; currency via `@Measures.ISOCurrency`.

## 6. Authorization pattern (mandatory)

Every service `@requires`; every writable entity `@restrict`. Example:

```cds
service PurchaseOrderService @(requires: 'authenticated-user') {
  entity PurchaseOrders @(restrict: [
    { grant: 'READ',              to: ['Viewer','Editor','Admin'] },
    { grant: ['CREATE','UPDATE'], to: ['Editor','Admin'] },
    { grant: 'DELETE',            to: ['Admin'] }
  ]) as projection on po.PurchaseOrders;

  action approve(POID: Integer) returns PurchaseOrders @(requires: 'Editor');
}
```

Roles → scopes → role-collections live in `xs-security.json`. Dev uses mocked users; prod uses `xsuaa`.

## 7. Essential UI5 rules (self-contained)

- **Async module loading.** `sap.ui.define([...], (Dep) => { "use strict"; ... })`, or ES6 `import` in TypeScript. Lazy-load views via async routing — never preload in `Component.init`.
- **ComponentSupport bootstrap.** `index.html` boots via `data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"` and a `data-sap-ui-component` div — **no inline init script** (CSP).
- **CSP compliance.** No inline `<script>` and no inline `style=` — keep CSS in `css/style.css` referenced from the manifest `resources`.
- **XML MVC views only** — declarative, tooling-supported. Root container is `sap.m.Page` (or `sap.f.DynamicPage`); `App.view.xml` holds `<App>`.
- **Component.** Freestyle extends `sap/ui/core/UIComponent` with `interfaces: ["sap.ui.core.IAsyncContentCreation"]`, `manifest: "json"`, calls `this.getRouter().initialize()` in `init`. Fiori Elements extends `sap/fe/core/AppComponent`.
- **OData V4 data binding + types.** Default (unnamed) model is the OData service; set `operationMode: "Server"`, `autoExpandSelect: true`, `earlyRequests: true`. Two-way binding only on editable form fields; one-way for display + the `device` model. Use OData types (`sap.ui.model.odata.type.*`) so formatting/validation are automatic. Element binding on detail views via `bindElement("/EntitySet(key)")` — don't pass data through nav params.
- **Forms.** Use `sap.ui.layout.form.Form` with `ColumnLayout` — **never `SimpleForm`**, and never `HBox`/`VBox` grids for form data.
- **TypeScript event types** (UI5 ≥ 1.115): use generated event types, e.g. `Button$PressEvent`, instead of the generic `Event`.
- **i18n + theme.** Named `i18n` `ResourceModel`; theme `sap_horizon` only; support `compact` + `cozy` densities.
- **Validation/feedback.** `valueState` + `valueStateText` (never `alert()`); `MessageBox.error` for blocking errors, `MessageToast.show` for short success; busy via `page.setBusy(true/false)`.

## 8. Git branching strategy

- `main` — always releasable; protected.
- `feature/<short-desc>` — new functionality (e.g. `feature/po-approval-action`).
- `fix/<short-desc>` — bug fixes against `main`.
- `hotfix/<short-desc>` — urgent production fixes; fast-tracked.
- `chore/<short-desc>` — tooling, deps, docs, config (no runtime behaviour change).

One logical change per branch; PR into `main` after `run_checks` passes (CAP `cds build`/`npm test`; UI5 `ui5lint`/tests/`tsc --noEmit`). Commit messages: imperative mood, scoped (`feat(po): add approve action`).

## 9. File-header and function JSDoc standard (mandatory on every generated file)

Every generated source file — `.js`, `.ts`, `.cds`, `.json` — must start with this file-level header block. Adapt the comment syntax per file type (CDS uses `//`, JSON comments are not valid — embed the header in the first key or omit for pure JSON).

### File-level header (top of every JS/TS/CDS file)

```javascript
// ---------------------------------------------------------------------------*
// Application Name : <App Name — from FD title>
// Object Id       : <filename — role/purpose of this file>
// Release         : 1
// Author          : <from git config user.name or FD author field>
// Date            : <YYYY-MM-DD — file creation date>
// Description     : <One or two sentences describing what this file does>
// ---------------------------------------------------------------------------*
// Descriptions: <One-line summary of the main abstraction or pattern>
// ---------------------------------------------------------------------------*
// Change Log:
//     Date          |   Author       |   Change Id     |   Change Description
// ---------------------------------------------------------------------------*
```

### Function-level JSDoc (above every exported function, method, or handler)

```javascript
/**
 * <Short imperative sentence describing what the function does.>
 * <Optional: REST path or CAP hook — e.g. POST /odata/v4/OrdersService/Orders(<ID>)/OrdersService.approve>
 * @param {type} paramName - Description of the parameter
 * @param {type} paramName2 - Description of the parameter
 * @returns {type} Description of the return value, or omit if void/side-effect only
 */
```

### Rules

- **Every file** must have the file-level header. There are no exceptions.
- **Every exported function** (module.exports, `export function`, `export default`) and every CAP event hook registration comment block must have a JSDoc comment above it.
- **Private/internal helper** functions (`_name` convention) also get JSDoc — the `@param` and `@returns` tags help the next developer understand the contract.
- The `Object Id` field must uniquely identify the file within the app: use the relative path + a short role description (e.g. `assessmentOps.js — Passed / Mitigated bound action handlers`).
- The `Date` field is the file creation date. Update the **Change Log** table — not the header Date — when the file is modified.
- For CDS files, use `//` comments; the header block is identical.
- For `manifest.json` and other pure-JSON files, the header cannot be included (JSON has no comment syntax). Instead, ensure the file path and purpose are documented in the `Application-Architecture.md` deliverable.

### Example — CAP service handler (`srv/service.js`)

```javascript
// ---------------------------------------------------------------------------*
// Application Name : Purchase Order App
// Object Id       : PurchaseOrderService — CAP service handler hub
// Release         : 1
// Author          : Suraj
// Date            : 2026-07-28
// Description     : Registers before/on/after hooks for the PurchaseOrderService.
//                   Delegates to operations/ and validators/ sub-modules.
// ---------------------------------------------------------------------------*
// Descriptions: Service implementation entry point — wires all CAP event hooks.
// ---------------------------------------------------------------------------*
// Change Log:
//     Date          |   Author       |   Change Id     |   Change Description
// ---------------------------------------------------------------------------*

'use strict';
const cds = require('@sap/cds');

/**
 * PurchaseOrderService CAP implementation.
 * Registers validation, computed-field, and action handlers.
 * @param {object} srv - CAP service instance provided by cds.service.impl
 */
module.exports = cds.service.impl(async function (srv) {

  /**
   * Validates that quantity > 0 before creating a Purchase Order.
   * POST /odata/v4/PurchaseOrderService/PurchaseOrders
   * @param {object} req - CAP request context with req.data.quantity
   */
  srv.before('CREATE', 'PurchaseOrders', (req) => {
    if (!req.data.quantity || req.data.quantity <= 0) {
      req.error(400, 'Quantity must be greater than zero.');
    }
  });
});
```
