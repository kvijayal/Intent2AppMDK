*Part of the fiori-bootstrap skill.*

# List Report + Object Page (LROP)

> Full file-by-file V4/RAP walkthrough: [`bootstrap-list-report-v4.md`](bootstrap-list-report-v4.md).

The default Fiori Elements floorplan: a filterable list (List Report) that navigates to a detail page (Object Page). Both are **separate UIComponents** loaded by the SAPUI5 flexible programming model — you wire them in `manifest.json`; you do not write views or controllers. Live example: `Claude-Code/purchaseOrder/app/purchaseorderlist/webapp/manifest.json`.

## sap.app — data source

The OData V4 service the app binds to. `uri` is the runtime path; for an external/RAP service add a `localUri` for the mock (see `external-service-app.md`).

```jsonc
"sap.app": {
  "id": "purchase.order.list",
  "type": "application",
  "i18n": "i18n/i18n.properties",
  "title": "{{appTitle}}",
  "description": "{{appDescription}}",
  "applicationVersion": { "version": "1.0.0" },
  "dataSources": {
    "mainService": {
      "uri": "/odata/v4/purchaseorder/",
      "type": "OData",
      "settings": { "odataVersion": "4.0" }
    }
  }
}
```

## OData V4 model settings

Bind the **default (unnamed) model** to `mainService`. These four settings are required on every backend-bound app — `autoExpandSelect` lets Fiori Elements request only the fields the annotations reference (including the criticality column), and `earlyRequests` fires the metadata + first data request as soon as possible.

> **Never include `synchronizationMode` in OData V4 model settings.** It was removed in UI5 1.110+ and the UI5 linter flags it as a deprecated error. The OData V4 model manages synchronisation internally. If you see it in generated output, delete it immediately.

```jsonc
"models": {
  "": {
    "dataSource": "mainService",
    "type": "sap.ui.model.odata.v4.ODataModel",
    "settings": {
      "operationMode": "Server",
      "autoExpandSelect": true,
      "earlyRequests": true,
      "groupId": "$auto",
      "updateGroupId": "$auto"
      // ❌ "synchronizationMode": "None"  ← NEVER — removed in UI5 1.110+
    }
  },
  "i18n": {
    "type": "sap.ui.model.resource.ResourceModel",
    "settings": { "bundleName": "purchase.order.list.i18n.i18n" }
  }
}
```

## Routing — two routes, two Component targets

The List route uses the empty pattern `:?query:` (it is the entry page). The Detail route's pattern carries the entity key: `PurchaseOrders({key}):?query:`. Both targets are `"type": "Component"` — the `sap.fe.templates.*` templates ARE the components.

```jsonc
"routing": {
  "routes": [
    { "name": "POList",   "pattern": ":?query:",                         "target": "POList" },
    { "name": "PODetail", "pattern": "PurchaseOrders({key}):?query:",    "target": "PODetail" }
  ],
  "targets": {
    "POList": {
      "type": "Component",
      "id": "POList",
      "name": "sap.fe.templates.ListReport",
      "options": {
        "settings": {
          "contextPath": "/PurchaseOrders",
          "variantManagement": "Page",
          "initialLoad": "Enabled",
          "controlConfiguration": {
            "@com.sap.vocabularies.UI.v1.LineItem": {
              "tableSettings": { "type": "ResponsiveTable", "selectionMode": "Multi" }
            }
          },
          "navigation": {
            "PurchaseOrders": { "detail": { "route": "PODetail" } }
          }
        }
      }
    },
    "PODetail": {
      "type": "Component",
      "id": "PODetail",
      "name": "sap.fe.templates.ObjectPage",
      "options": {
        "settings": {
          "contextPath": "/PurchaseOrders",
          "editableHeaderContent": false
        }
      }
    }
  }
}
```

### Key settings explained

- **`contextPath: "/PurchaseOrders"`** — the entity set the floorplan binds to. ALWAYS use `contextPath`; the old `entitySet` property is deprecated and breaks newer annotation resolution.
- **`variantManagement: "Page"`** — one variant for the whole List Report page (filter bar + table). Required by the Intent2App conventions; the alternative `"Control"` is rarely what you want.
- **`initialLoad: "Enabled"`** — the table queries data on open instead of waiting for the user to press *Go*.
- **`navigation.<Entity>.detail.route`** — connects a row click in the List Report to the Detail route by name. The key in `navigation` is the entity set name, matching the LineItem's binding.
- **`controlConfiguration.@…LineItem.tableSettings`** — `ResponsiveTable` (an `sap.m.Table`) is the Fiori default; switch to `GridTable` only for dense/analytical data (> ~8 columns). `selectionMode: "Multi"` enables bulk actions.
- **`editableHeaderContent: false`** — the Object Page header is display-only.

## Create & edit need drafts (or sticky) — or the page is display-only

A List Report / Object Page where users must **create or edit** records requires **`@odata.draft.enabled`** on the entity (the Clean-Core default for CAP) **or** sticky-session handling. With **draft off and no sticky config, Fiori Elements renders the Object Page read-only and provides no working Create flow** — the app looks "display-only" even though the form fields are annotated and the service grants `CREATE`/`UPDATE`. This is a frequent, silent gap: the model says create is allowed, but the UI offers no way to do it.

```cds
// db/schema.cds (or srv via annotate) — enable draft on the editable root entity
annotate SupplierOnboardingService.Suppliers with @odata.draft.enabled;
```

Decision rule:
- **Read-only / display app** → draft off is correct (no Create/Edit buttons expected).
- **Users create or edit records (an input form is in scope)** → **draft on** (recommended), or sticky sessions, or move that screen to a Freestyle form.
- Never ship a non-draft LROP while a requirement asks for a create/edit form — raise it as a contradiction at Gate D/G6 (see `sap-architecture/references/decision-gates.md`).

When draft is on, keep the `managed`/`@odata.etag` interplay correct and ensure compositions (e.g. `Addresses`) cascade with the draft. Seed CSVs are unaffected.

## Required libraries

```jsonc
"dependencies": {
  "minUI5Version": "{RECOMMENDED_UI5_VERSION}",
  "libs": {
    "sap.ui.core": {},
    "sap.m": {},
    "sap.fe.core": {},
    "sap.fe.templates": {},
    "sap.fe.macros": {},
    "sap.uxap": {},
    "sap.ui.layout": {}
  }
}
```

`sap.fe.templates` provides ListReport/ObjectPage; `sap.fe.macros` provides the building blocks used by FPM extensions; `sap.uxap` is the Object Page layout library.

## Top-level flags

```jsonc
"flexEnabled": true,
"contentDensities": { "compact": true, "cozy": true }
```

## Serving on CAP (`cds-plugin-ui5`) — get the UI5 runtime right or the page is blank

When this floorplan lives inside a CAP project under `app/<name>/`, `cds watch` serves it via **`cds-plugin-ui5`**. Two things must be in place or you get a **blank page / `sap-ui-core.js not found`**:

1. **`cds-plugin-ui5` in the CAP root `devDependencies`** (`^0.17.0`) — otherwise `cds watch` serves only OData, not the app HTML/manifest/Component. The reference starter (`reference-apps/cap-fullstack-listreport/package.json`) already declares it; copy it.
2. **The `index.html` bootstrap must match `ui5.yaml`.** The reference starter bootstraps UI5 from the **CDN** and keeps `ui5.yaml` minimal (no `framework` block):

   ```html
   <script id="sap-ui-bootstrap"
       src="https://ui5.sap.com/{RECOMMENDED_UI5_VERSION}/resources/sap-ui-core.js"
       data-sap-ui-theme="sap_horizon"
       data-sap-ui-resource-roots='{"com.client.appname": "./"}'
       data-sap-ui-async="true"
       data-sap-ui-frame-options="trusted"
       data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
       data-sap-ui-compat-version="edge">
   </script>
   ```

   A **relative** `src="resources/sap-ui-core.js"` with **no** `framework` block in `ui5.yaml` is the broken combination → 404 → blank page. See [`freestyle-in-cap.md`](freestyle-in-cap.md) "UI5 runtime resources" for the full A/B rule. Use the CDN bootstrap (Setup A) by default.

The service `dataSources.uri` stays **relative** (`/odata/v4/...`) — same-origin under CAP, no proxy. Only the framework loader uses the CDN URL.

## What drives the UI

The columns, filter fields, header, and sections come entirely from **annotations** (`UI.LineItem`, `UI.SelectionFields`, `UI.HeaderInfo`, `UI.Facets`). The manifest only wires routing/config. See the `fiori-elements` skill (`references/list-report.md` and `references/object-page.md`).

## Checklist

Namespace identical in all four places · `contextPath` not `entitySet` · default model bound to `mainService` with the V4 settings block · two routes (List empty-pattern, Detail key-pattern) · `navigation` links list → detail · `variantManagement: "Page"` + `initialLoad: "Enabled"` · all FE libs declared · `sap_horizon`.
