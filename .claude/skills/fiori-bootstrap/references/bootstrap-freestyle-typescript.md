*Part of the fiori-bootstrap skill.*

> Full file-by-file walkthrough for a **standalone Freestyle SAPUI5 TypeScript** app. For the concise Intent2App wiring, see [`freestyle-standalone.md`](freestyle-standalone.md); for the same app inside CAP, see [`freestyle-in-cap.md`](freestyle-in-cap.md).

# SAPUI5 Freestyle TypeScript — Bootstrap Reference

Minimal file set to get a working SAPUI5 Freestyle TypeScript app off the ground.
Covers TS controllers, XML views, client-side routing, and i18n. No Fiori Elements.

---

## Project conventions

| Item | Value |
|---|---|
| Namespace | `com.<org>.<appid>` (e.g. `com.demo.myapp`) |
| SAPUI5 version | 1.148.0 |
| TypeScript | 5.8, `target: ES2023`, `module: ES2022` |
| Transpiler | `ui5-tooling-transpile` (handles AMD→ESM at dev-serve / build time) |
| Theme | `sap_horizon` |
| `webapp/` root | All source lives here; `rootDir` in tsconfig points here |

---

## Required files

### `package.json`
Root of project. Declares dev tools — no runtime deps needed (UI5 is served by `ui5 serve`).

```json
{
  "name": "com-demo-myapp",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "ui5 serve -o index.html",
    "build": "ui5 build --clean-dest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@sapui5/types": "^1.148.0",
    "@ui5/cli": "^4.0.0",
    "typescript": "^5.8.0",
    "ui5-tooling-transpile": "^3.7.4"
  }
}
```

---

### `ui5.yaml`
UI5 tooling config: declares the framework version, consumed libraries, and wires in the TypeScript transpile middleware/task.

```yaml
specVersion: "4.0"
metadata:
  name: com.demo.myapp
type: application
framework:
  name: SAPUI5
  version: "1.148.0"
  libraries:
    - name: sap.m
    - name: sap.ui.core
    - name: sap.ui.layout
    - name: themelib_sap_horizon
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
```

---

### `tsconfig.json`
TypeScript config. `paths` maps the app namespace to `./webapp/` so cross-file imports resolve without relative `../../` chains.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "strictPropertyInitialization": false,
    "skipLibCheck": true,
    "allowJs": true,
    "noEmit": true,
    "rootDir": "./webapp",
    "baseUrl": ".",
    "paths": {
      "com/demo/myapp/*": ["./webapp/*"]
    },
    "types": ["@sapui5/types"]
  },
  "include": ["webapp/**/*.ts"]
}
```

---

### `webapp/index.html`
Entry point loaded by `ui5 serve`. Bootstraps the UI5 core, declares the namespace–path mapping, and delegates component mounting to `ComponentSupport`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <script
    id="sap-ui-bootstrap"
    src="resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-resourceroots='{"com.demo.myapp":"./"}'
    data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"
    data-sap-ui-compatversion="edge"
    data-sap-ui-async="true"
    data-sap-ui-frameoptions="trusted">
  </script>
</head>
<body class="sapUiBody sapUiSizeCompact">
  <div
    data-sap-ui-component
    data-name="com.demo.myapp"
    data-id="container"
    data-settings='{"id":"myApp"}'>
  </div>
</body>
</html>
```

Key attributes:
- `data-sap-ui-resourceroots` — maps namespace to `./` (the `webapp/` folder at serve time)
- `data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"` — auto-mounts the `<div data-sap-ui-component>` tag
- `data-sap-ui-async="true"` — required for modern async loading

---

### `webapp/manifest.json`
Application descriptor. Declares metadata, UI5 lib dependencies, the i18n model, the root view, and the client-side router.

```json
{
  "_version": "1.68.0",
  "sap.app": {
    "id": "com.demo.myapp",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "applicationVersion": { "version": "1.0.0" }
  },
  "sap.ui": {
    "technology": "UI5",
    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
  },
  "sap.ui5": {
    "rootView": {
      "viewName": "com.demo.myapp.view.App",
      "type": "XML",
      "id": "rootView",
      "async": true
    },
    "dependencies": {
      "minUI5Version": "1.116.0",
      "libs": {
        "sap.ui.core": {},
        "sap.m": {},
        "sap.ui.layout": {}
      }
    },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "com.demo.myapp.i18n.i18n"
        }
      }
    },
    "routing": {
      "config": {
        "routerClass": "sap.m.routing.Router",
        "viewType": "XML",
        "viewPath": "com.demo.myapp.view",
        "controlId": "app",
        "controlAggregation": "pages",
        "async": true
      },
      "routes": [
        { "pattern": "",        "name": "home",   "target": "home" },
        { "pattern": "detail",  "name": "detail", "target": "detail" }
      ],
      "targets": {
        "home":   { "viewName": "Home",   "viewId": "home" },
        "detail": { "viewName": "Detail", "viewId": "detail" }
      }
    }
  }
}
```

Key points:
- `rootView.viewName` must match the file at `webapp/view/App.view.xml`
- `routing.config.controlId` must match the `id` of the `<App>` control in `App.view.xml`
- `routing.config.controlAggregation: "pages"` — routed views are inserted into `sap.m.App`'s `pages` aggregation
- The `i18n` model is auto-wired via manifest; no code needed in `Component.ts`

---

### `webapp/Component.ts`
Application component. Reads `manifest: "json"`, initialises any named models, and starts the router. The `@namespace` JSDoc comment is required by the transpiler to emit the correct AMD module name.

```typescript
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace com.demo.myapp
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json"
  };

  public init(): void {
    super.init();                          // must be first — loads manifest

    // Register any named models before the router starts
    this.setModel(new JSONModel({ items: [] }), "app");

    this.getRouter().initialize();         // must be last
  }
}
```

Rules:
- `super.init()` must run before any `this.getModel()` / routing calls
- `this.getRouter().initialize()` must be the last call in `init()`
- `metadata.manifest = "json"` triggers loading of `manifest.json` automatically

---

### `webapp/view/App.view.xml`
Shell view. Contains only `<App id="app" />` — the router targets inject page views into this control's `pages` aggregation. No controller needed.

```xml
<mvc:View
  xmlns:mvc="sap.ui.core.mvc"
  xmlns="sap.m"
  displayBlock="true">
  <App id="app" />
</mvc:View>
```

The `id="app"` value must match `routing.config.controlId` in `manifest.json`.

---

### `webapp/view/Home.view.xml` + `webapp/controller/Home.controller.ts`
Minimal routed page view and its TS controller. The `controllerName` attribute must use dot-notation matching the namespace.

**View (`webapp/view/Home.view.xml`)**

```xml
<mvc:View
  controllerName="com.demo.myapp.controller.Home"
  xmlns:mvc="sap.ui.core.mvc"
  xmlns="sap.m">
  <Page title="{i18n>homeTitle}">
    <content>
      <Text text="{i18n>welcomeMessage}" />
    </content>
  </Page>
</mvc:View>
```

**Controller (`webapp/controller/Home.controller.ts`)**

```typescript
import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace com.demo.myapp.controller
 */
export default class Home extends Controller {

  public onInit(): void {
    // Set a view-local model if needed
    this.getView()?.setModel(new JSONModel({ title: "Home" }), "view");
  }

  public onNavToDetail(): void {
    this.getOwnerComponent().getRouter().navTo("detail");
  }
}
```

Rules:
- The `@namespace` JSDoc comment must match the folder path under `webapp/`
- Access the component-level model via `this.getOwnerComponent().getModel("modelName")`
- Attach to a route's `patternMatched` event in `onInit()` to refresh data when navigating back

---

### `webapp/i18n/i18n.properties`
Default resource bundle. Keys referenced in XML views as `{i18n>key}`. The manifest's `i18n` model declaration wires this file automatically — no code needed.

```properties
appTitle=My App
appDescription=A SAPUI5 Freestyle TypeScript application
homeTitle=Home
welcomeMessage=Welcome to My App
```

---

## Bootstrapping checklist

1. `npm install` (installs `@ui5/cli`, `ui5-tooling-transpile`, `@sapui5/types`, `typescript`)
2. Verify `ui5.yaml` namespace matches `data-sap-ui-resourceroots` in `index.html`
3. Verify `manifest.json` `sap.app.id` matches the namespace in every file
4. Verify `routing.config.controlId` = `id` on `<App>` in `App.view.xml`
5. Each controller class must have `/** @namespace com.demo.myapp.controller */` — the transpiler uses this to emit the correct module ID
6. `Component.init()` order: `super.init()` → set models → `getRouter().initialize()`
7. `npm start` → opens `index.html` via `ui5 serve`

---

## Common pitfalls

| Symptom | Cause |
|---|---|
| Blank page, no errors | `data-sap-ui-resourceroots` namespace typo or mismatch with `sap.app.id` |
| Router never navigates | `getRouter().initialize()` not called, or `controlId` doesn't match `<App id>` |
| TypeScript can't resolve imports | `paths` in `tsconfig.json` missing or `baseUrl` not set to `.` |
| Transpile middleware missing | `ui5-tooling-transpile-middleware` not added to `ui5.yaml` `server.customMiddleware` |
| `@namespace` JSDoc missing | Transpiled module gets wrong AMD ID; controller not found at runtime |
| `super.init()` skipped | Manifest not loaded; `getModel("i18n")` returns `undefined` |
