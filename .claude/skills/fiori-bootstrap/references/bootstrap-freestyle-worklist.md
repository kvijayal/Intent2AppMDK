*Part of the fiori-bootstrap skill.*

> Full file-by-file walkthrough for a **standalone Freestyle SAPUI5 (plain JavaScript) worklist** app. Intent2App defaults to **TypeScript** freestyle ([`freestyle-standalone.md`](freestyle-standalone.md) / [`bootstrap-freestyle-typescript.md`](bootstrap-freestyle-typescript.md)); use this JS reference only when plain JS is explicitly required. General JS freestyle reference: [`bootstrap-freestyle-js.md`](bootstrap-freestyle-js.md).

# Bootstrapping a Freestyle SAPUI5 App

A reusable reference for scaffolding a **freestyle** SAPUI5 application — plain JS
controllers + XML views, **not** Fiori Elements. Derived from the "Manage Products"
worklist app.

## Conventions used below

- **App namespace**: `mycompany.myapp.MyApp` (dot-notation for IDs/classes,
  slash-notation `mycompany/myapp/MyApp` for `sap.ui.define` paths). Replace
  everywhere consistently.
- **Source root**: everything the app ships lives under `webapp/`.
- **UI5 tooling**: the app runs via `@ui5/cli` (`ui5 serve` / `ui5 build`).

## File overview

| File | Required | Purpose |
|------|----------|---------|
| `package.json` | ✅ | npm scripts + UI5 CLI dev dependency |
| `webapp/index.html` | ✅ | HTML bootstrap that loads UI5 and the Component |
| `webapp/Component.js` | ✅ | App entry point (`UIComponent`); inits router & models |
| `webapp/manifest.json` | ✅ | App descriptor: IDs, models, routing, dependencies |
| `webapp/view/App.view.xml` | ✅ | Root view — the `App`/`Shell` container for routed pages |
| `webapp/controller/App.controller.js` | ✅ | Root controller (busy handling, content density) |
| `webapp/i18n/i18n.properties` | ✅ | Translatable text bundle |
| `ui5.yaml` | ⭐ optional | UI5 tooling config (framework + libraries) |
| `webapp/Component-preload.js` | ⭐ optional | Build-generated bundle for production; never hand-written |

---

## 1. `package.json` — root

Scripts to serve/build the app and the UI5 CLI dev dependency.

```json
{
  "name": "my-ui5-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "ui5 serve",
    "build": "ui5 build --all --clean-dest"
  },
  "devDependencies": {
    "@ui5/cli": "^4"
  }
}
```

## 2. `webapp/index.html`

HTML bootstrap: loads the UI5 core from a CDN/local resources and instantiates
the Component via `ComponentSupport` (declarative, no inline JS needed).

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>My UI5 App</title>
    <script
        id="sap-ui-bootstrap"
        src="resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resource-roots='{"mycompany.myapp.MyApp": "./"}'
        data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
        data-sap-ui-compat-version="edge"
        data-sap-ui-async="true">
    </script>
</head>
<body class="sapUiBody">
    <div data-sap-ui-component
         data-name="mycompany.myapp.MyApp"
         data-id="container"
         data-settings='{"id": "myapp"}'></div>
</body>
</html>
```

## 3. `webapp/Component.js`

App entry point. Extends `UIComponent`, loads config from `manifest.json`,
sets shared models, and initializes the router in `init`.

```js
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "./model/models"
], function (UIComponent, Device, models) {
    "use strict";

    return UIComponent.extend("mycompany.myapp.MyApp.Component", {

        metadata: {
            manifest: "json"      // load all config from manifest.json
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            // shared device model (screen size, touch, etc.)
            this.setModel(models.createDeviceModel(), "device");

            // create the views based on the url/hash
            this.getRouter().initialize();
        }
    });
});
```

## 4. `webapp/manifest.json`

The app descriptor — single source of truth for app id, i18n, models, routing,
and library dependencies. `sap.ui5.rootView` names the root XML view.

```json
{
    "_version": "2.0.0",
    "sap.app": {
        "id": "mycompany.myapp.MyApp",
        "type": "application",
        "i18n": "i18n/i18n.properties",
        "title": "{{appTitle}}",
        "applicationVersion": { "version": "1.0.0" }
    },
    "sap.ui": {
        "technology": "UI5",
        "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
    },
    "sap.ui5": {
        "rootView": {
            "viewName": "mycompany.myapp.MyApp.view.App",
            "type": "XML",
            "id": "app"
        },
        "dependencies": {
            "minUI5Version": "1.136.0",
            "libs": { "sap.m": {}, "sap.ui.core": {} }
        },
        "models": {
            "i18n": {
                "type": "sap.ui.model.resource.ResourceModel",
                "settings": { "bundleName": "mycompany.myapp.MyApp.i18n.i18n" }
            }
        },
        "routing": {
            "config": {
                "routerClass": "sap.m.routing.Router",
                "type": "View",
                "viewType": "XML",
                "path": "mycompany.myapp.MyApp.view",
                "controlId": "app",
                "controlAggregation": "pages"
            },
            "routes": [
                { "pattern": "", "name": "worklist", "target": ["worklist"] }
            ],
            "targets": {
                "worklist": { "name": "Worklist", "id": "worklist" }
            }
        }
    }
}
```

## 5. `webapp/view/App.view.xml` — root view

The top-level container. A `Shell` wrapping an `App` control whose `pages`
aggregation is where the router places routed views.

```xml
<mvc:View
    controllerName="mycompany.myapp.MyApp.controller.App"
    displayBlock="true"
    xmlns="sap.m"
    xmlns:mvc="sap.ui.core.mvc">
    <Shell>
        <App id="app"/>
    </Shell>
</mvc:View>
```

## 6. `webapp/controller/App.controller.js` — root controller

The root view's controller. Typically applies the content-density class and any
app-wide busy handling in `onInit`.

```js
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("mycompany.myapp.MyApp.controller.App", {
        onInit: function () {
            // apply compact/cozy density based on device
            this.getView().addStyleClass(
                this.getOwnerComponent().getContentDensityClass()
            );
        }
    });
});
```

> **Tip:** Add a `BaseController` that other controllers extend for shared helpers
> (`getRouter()`, `getModel()`, `getResourceBundle()`), so each screen controller
> stays focused on its own logic.

## 7. `webapp/i18n/i18n.properties` — text bundle

Key/value translatable texts. `{{key}}` references in `manifest.json` and
`{i18n>key}` bindings in views resolve here.

```properties
# App descriptor texts
appTitle=My UI5 App
appDescription=A freestyle SAPUI5 application

# Worklist view
worklistViewTitle=Items
worklistTableTitle=Items
```

---

## Optional files

### `ui5.yaml` (recommended for UI5 tooling)

Declares the framework flavour, version, and the libraries to serve locally.
Required when running with `@ui5/cli`.

```yaml
specVersion: "4.0"
metadata:
  name: my-ui5-app
type: application
framework:
  name: OpenUI5          # or SAPUI5
  version: "1.150.0"
  libraries:
    - name: sap.m
    - name: sap.ui.core
    - name: themelib_sap_horizon
```

### `webapp/Component-preload.js`

**Do not hand-write.** Produced by `ui5 build` — a concatenated/minified bundle of
all app modules for faster production loading. Safe to ignore during development.

---

## Bootstrapping checklist

1. `npm init` — add the scripts + `@ui5/cli` (§1).
2. Create `ui5.yaml` with framework + libs (optional but recommended, §opt).
3. Under `webapp/`: add `index.html`, `Component.js`, `manifest.json` (§2–4).
4. Add root `view/App.view.xml` + `controller/App.controller.js` (§5–6).
5. Add `i18n/i18n.properties` (§7).
6. For each screen: add a route + target in `manifest.json`, then a matching
   `view/<Name>.view.xml` and `controller/<Name>.controller.js`.
7. `npm start` — open `index.html`.
