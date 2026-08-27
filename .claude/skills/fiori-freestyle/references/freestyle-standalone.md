*Part of the fiori-bootstrap skill.*

# Freestyle UI5 (standalone, TypeScript)

A freestyle app is hand-built UX: your own XML views, controllers, and `sap.m.routing.Router` — no Fiori Elements templates. Use it when the requirement does not fit a standard floorplan. Intent2App uses **TypeScript** freestyle. Canonical example: `Claude-Code/project1`.

"Standalone" means it runs on its own dev server (`fiori run` / `ui5 serve`) and proxies UI5 resources from the SAP CDN or a mock. For the same app served inside a CAP project, see `freestyle-in-cap.md`.

## Folder layout

```
project1/
├── package.json
├── ui5.yaml              # proxy/transpile middleware
├── ui5-mock.yaml         # + sap-fe-mockserver for offline runs
├── tsconfig.json
└── webapp/
    ├── Component.ts
    ├── index.html
    ├── manifest.json
    ├── controller/  App.controller.ts, View1.controller.ts
    ├── view/        App.view.xml, View1.view.xml
    ├── model/       models.ts
    ├── i18n/        i18n.properties
    └── test/        unit/ + integration/ (QUnit + OPA5)
```

## Component.ts — extends UIComponent

The `@namespace` JSDoc tag is what `ui5-tooling-transpile` turns into the runtime `extend("project1.Component")`. It must match the manifest id, the resource-roots, and `ui5.yaml metadata.name`. Note `IAsyncContentCreation`, the device model, and `getRouter().initialize()`.

```typescript
import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";

/**
 * @namespace project1
 */
export default class Component extends BaseComponent {

  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"]
  };

  public init(): void {
    super.init();                                   // base UIComponent init
    this.setModel(createDeviceModel(), "device");   // device model for responsive bindings
    this.getRouter().initialize();                  // start routing (async)
  }
}
```

`model/models.ts`:

```typescript
import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";

export function createDeviceModel() {
  const model = new JSONModel(Device);
  model.setDefaultBindingMode("OneWay");
  return model;
}
```

## index.html — ComponentSupport bootstrap

No inline component instantiation script (CSP-safe). `ComponentSupport` reads the `data-sap-ui-component` div and instantiates the component. `resource-roots` MUST match the namespace.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Title</title>
  <style>html, body, body > div, #container, #container-uiarea { height: 100%; }</style>
  <script id="sap-ui-bootstrap"
    src="resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-resource-roots='{"project1": "./"}'
    data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
    data-sap-ui-compat-version="edge"
    data-sap-ui-async="true"
    data-sap-ui-frame-options="trusted"></script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content">
  <div data-sap-ui-component data-name="project1" data-id="container"
       data-settings='{"id": "project1"}' data-handle-validation="true"></div>
</body>
</html>
```

## App.view.xml — root view with `<App>`

The router's `controlId: "app"` targets this `<App>` control; views are placed into its `pages` aggregation.

```xml
<mvc:View controllerName="project1.controller.App"
          displayBlock="true"
          xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m">
  <App id="app" />
</mvc:View>
```

Each routed view uses `sap.m.Page` as its root container (Fiori convention):

```xml
<mvc:View controllerName="project1.controller.View1"
          xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m">
  <Page id="page" title="{i18n>title}">
    <content />
  </Page>
</mvc:View>
```

## manifest.json — sap.m.routing.Router

Freestyle routing uses `sap.m.routing.Router` with `controlId: "app"` and `controlAggregation: "pages"`, a `rootView`, and `async: true`. Views are `"type": "View"` (not Component).

```jsonc
"sap.ui5": {
  "flexEnabled": true,
  "dependencies": { "minUI5Version": "1.146.0",
    "libs": { "sap.m": {}, "sap.ui.core": {} } },
  "contentDensities": { "compact": true, "cozy": true },
  "models": {
    "i18n": { "type": "sap.ui.model.resource.ResourceModel",
              "settings": { "bundleName": "project1.i18n.i18n" } }
  },
  "resources": { "css": [ { "uri": "css/style.css" } ] },
  "routing": {
    "config": {
      "routerClass": "sap.m.routing.Router",
      "controlId": "app",
      "controlAggregation": "pages",
      "viewType": "XML",
      "viewPath": "project1.view",
      "transition": "slide",
      "async": true
    },
    "routes": [
      { "name": "RouteView1", "pattern": ":?query:", "target": ["TargetView1"] }
    ],
    "targets": {
      "TargetView1": { "id": "View1", "name": "View1" }
    }
  },
  "rootView": {
    "viewName": "project1.view.App", "type": "XML", "id": "App", "async": true
  }
}
```

If the app binds to an OData service, add the `dataSources.mainService` + default-model block from `list-report-op.md`; project1 binds to an external V4 service and adds a `localUri` for the mock.

## package.json — scripts & TS toolchain

```jsonc
"scripts": {
  "start":      "fiori run --open \"test/flp.html#app-preview\"",
  "start-mock": "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",
  "build":      "ui5 build --config=ui5.yaml --clean-dest --dest dist",
  "lint":       "eslint ./",
  "ts-typecheck": "tsc --noEmit",
  "prestart":   "npm run ts-typecheck",
  "unit-test":  "fiori run --config ./ui5-mock.yaml --open \"test/unit/unitTests.qunit.html\"",
  "int-test":   "fiori run --config ./ui5-mock.yaml --open \"test/integration/opaTests.qunit.html\""
},
"devDependencies": {
  "@ui5/cli": "^4.0.33",
  "@sap/ux-ui5-tooling": "1",
  "@sapui5/types": "~1.146.0",
  "ui5-tooling-transpile": "^3.10.0",
  "typescript": "^5.9.3",
  "@sap-ux/ui5-middleware-fe-mockserver": "2"
}
```

`ui5.yaml` carries `ui5-tooling-transpile-middleware`/`-task` (TS → UI5 AMD) plus `fiori-tools-proxy` (CDN for `/resources`, optional `backend`). `ui5-mock.yaml` adds `sap-fe-mockserver` for offline data — see `external-service-app.md`.

## Hard rules

- Namespace identical in 4 places; `ui5.yaml metadata.name` lowercase.
- `IAsyncContentCreation` + async routing always on.
- `sap.m.Page` as the root of each view; `sap.m.*` controls only; `sap_horizon`.
- No jQuery, no `sap.ui.getCore()`, navigate via `this.getOwnerComponent().getRouter().navTo()`, log via the `Log` module (no `console.log`).
- All labels in i18n.

## Value Help (SelectDialog) Pattern

Any field with a constrained vocabulary (plant, cost centre, material, etc.) **must** have a value
help wired end-to-end. Three layers are all required — missing any one of them means the feature
is not built.

### Layer 1 — View XML

Add `showValueHelp="true"` and `valueHelpRequest` to the `MultiInput` (or `Input`):

```xml
<MultiInput
    id="plantInput"
    showValueHelp="true"
    valueHelpRequest=".onPlantValueHelp"
    tokenUpdate=".onTokenUpdate"
    submit=".onAddPlant"
    placeholder="{i18n>plantPlaceholder}"/>
```

### Layer 2 — Controller (TypeScript)

```typescript
import SelectDialog from "sap/m/SelectDialog";
import StandardListItem from "sap/m/StandardListItem";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

// Private fields
private _plantDialog: SelectDialog | null = null;
private _allPlants: Array<{ plant: string; description: string }> = [];

public async onPlantValueHelp(): Promise<void> {
    // 1. Fetch from CAP lookup function
    try {
        const companyCode: string = this._viewModel.getProperty("/companyCode");
        const resp = await fetch(
            `/odata/v4/my-service/getPlants(companyCode='${encodeURIComponent(companyCode)}')`,
            { headers: { Accept: "application/json" } }
        );
        if (resp.ok) {
            const json = await resp.json() as { value: typeof this._allPlants };
            this._allPlants = json.value ?? [];
        }
    } catch { this._allPlants = []; }

    // 2. Lazy-create dialog
    if (!this._plantDialog) {
        this._plantDialog = new SelectDialog({
            title: this._getText("selectPlantsTitle"),
            multiSelect: true,
            rememberSelections: false,
            confirm: (oEvt: Event) => {
                const items = oEvt.getParameter("selectedItems") as StandardListItem[];
                const oInput = this.byId("plantInput") as MultiInput;
                items?.forEach(item => {
                    const key = item.getTitle();
                    if (!oInput.getTokens().some(t => t.getKey() === key)) {
                        oInput.addToken(new Token({ key, text: `${key} – ${item.getDescription()}` }));
                    }
                });
                this._syncPlants();
            },
            search: (oEvt: Event) => {
                const q = ((oEvt.getParameter("value") as string) ?? "").toLowerCase();
                (oEvt.getSource() as SelectDialog).getBinding("items")?.filter(
                    q ? [new Filter({ and: false, filters: [
                        new Filter("plant", FilterOperator.Contains, q),
                        new Filter("description", FilterOperator.Contains, q)
                    ]})] : []
                );
            }
        });
        this.getView()!.addDependent(this._plantDialog);
    }

    // 3. Bind fresh data and open
    const model = new JSONModel(this._allPlants);
    this._plantDialog.setModel(model);
    this._plantDialog.bindAggregation("items", {
        path: "/", templateShareable: false,
        template: new StandardListItem({ title: "{plant}", description: "{description}", type: "Active" })
    });
    this._plantDialog.open();
}
```

### Layer 3 — CAP backend (required even for mock data)

See `cap-skill/references/cap-service.md` → "Lookup / Value Help Function" for the CDS type,
function definition, and `srv.on` handler with mock data.

### Coverage gate

A value help requirement is **Built** only when ALL THREE layers are present and connected.
Grep for `valueHelpRequest` in the view and verify the matching controller method, CDS function,
and `srv.on` handler all exist before marking the requirement done.

---

## Checklist

`Component.ts` extends `UIComponent`, sets device model, calls `getRouter().initialize()` · `IAsyncContentCreation` in metadata · `index.html` uses `ComponentSupport` (no inline script) · `App.view.xml` has `<App id="app">` matching `controlId` · `sap.m.routing.Router` + `rootView` + `async: true` · `tsc --noEmit` clean · namespace consistent · every `valueHelpRequest` in the view has a matching controller method **and** a CAP lookup function.
