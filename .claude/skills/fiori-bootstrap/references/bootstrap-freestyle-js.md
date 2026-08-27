*Part of the fiori-bootstrap skill.*

> Full file-by-file walkthrough for a **standalone Freestyle SAPUI5 (plain JavaScript)** app. Intent2App defaults to **TypeScript** freestyle ([`freestyle-standalone.md`](freestyle-standalone.md) / [`bootstrap-freestyle-typescript.md`](bootstrap-freestyle-typescript.md)); use this JS reference only when plain JS is explicitly required. The JS worklist variant is in [`bootstrap-freestyle-worklist.md`](bootstrap-freestyle-worklist.md).

# Freestyle SAPUI5 App — Bootstrap Reference

Bootstrapping a standalone SAPUI5 app with JS controllers and XML views (not Fiori Elements).
Derived from `app/enterprisebrain` and `app/inarachatbot`.

---

## Required Files

### `package.json`
One-line purpose: declares dev toolchain and build scripts; no runtime deps needed.

```json
{
  "name": "my-app",
  "version": "0.0.1",
  "main": "webapp/index.html",
  "dependencies": {},
  "devDependencies": {
    "@ui5/cli": "^4.0.33",
    "@sap/ux-ui5-tooling": "1",
    "ui5-task-zipper": "^3.4.x"
  },
  "scripts": {
    "build:cf": "ui5 build preload --clean-dest --config ui5-deploy.yaml --include-task=generateCachebusterInfo",
    "build": "npm run build:cf"
  }
}
```

---

### `webapp/index.html`
One-line purpose: HTML entry point that bootstraps the UI5 runtime and mounts the component.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>My App</title>
    <style>
        html, body, body > div, #container, #container-uiarea { height: 100%; }
    </style>
    <script
        id="sap-ui-bootstrap"
        src="https://sapui5.hana.ondemand.com/1.148.0/resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resource-roots='{ "my.namespace": "./" }'
        data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
        data-sap-ui-compat-version="edge"
        data-sap-ui-async="true"
        data-sap-ui-frame-options="trusted"
    ></script>
    <!-- Optional: vendor scripts loaded before the component -->
    <!-- <script src="scripts/showdown.min.js"></script> -->
</head>
<body class="sapUiBody sapUiSizeCompact" id="content">
    <div
        data-sap-ui-component
        data-name="my.namespace"
        data-id="container"
        data-settings='{"id": "my.namespace"}'
        data-handle-validation="true"
    ></div>
</body>
</html>
```

**Key bootstrap attributes:**

| Attribute | Purpose |
|---|---|
| `data-sap-ui-resource-roots` | Maps the app namespace to `./` (the webapp folder). Must match the `id` in `manifest.json`. |
| `data-sap-ui-on-init` | `module:sap/ui/core/ComponentSupport` — lets the `<div data-sap-ui-component>` tag auto-mount the component. |
| `data-sap-ui-async` | Loads modules asynchronously; required for `IAsyncContentCreation`. |
| `data-sap-ui-compat-version` | `"edge"` — opts into latest non-breaking default behaviours. |

**CDN vs local:** The CDN URL (`sapui5.hana.ondemand.com/1.148.0/resources/sap-ui-core.js`) is the simplest choice. For offline/BTP deployments, vendor the core to `webapp/scripts/sap-ui-core.js` and point `src` there instead.

---

### `webapp/Component.js`
One-line purpose: the root UIComponent that wires up manifest, models, and the router.

```javascript
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device"
], (UIComponent, Device) => {
    "use strict";

    return UIComponent.extend("my.namespace.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"  // enables async view creation
            ]
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);
            // Set up any custom models here before calling getRouter().initialize()
            this.getRouter().initialize();
        },

        getContentDensityClass() {
            return Device.support.touch ? "sapUiSizeCozy" : "sapUiSizeCompact";
        }
    });
});
```

**Notes:**
- `manifest: "json"` tells the framework to load `manifest.json` automatically.
- Declare `IAsyncContentCreation` when `data-sap-ui-async="true"` is set in `index.html`; omit it only if you need synchronous view creation.
- Call `getRouter().initialize()` last in `init()`, after all models are attached.
- Add service/state objects as instance properties (`this._oMyService`) so any controller can reach them via `this.getOwnerComponent().getService("My")`.

---

### `webapp/manifest.json`
One-line purpose: declarative app descriptor — registers the app, data sources, models, routing, and FLP navigation.

```json
{
  "_version": "1.72.0",
  "sap.app": {
    "id": "my.namespace",
    "type": "application",
    "i18n": {
      "bundleUrl": "i18n/i18n.properties",
      "supportedLocales": [""],
      "fallbackLocale": ""
    },
    "applicationVersion": { "version": "1.0.0" },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "dataSources": {
      "mainService": {
        "uri": "srv-api/odata/v2/my-service/",
        "type": "OData",
        "settings": { "odataVersion": "2.0" }
      }
    },
    "crossNavigation": {
      "inbounds": {
        "my-namespace-Display": {
          "semanticObject": "myNamespace",
          "action": "Display",
          "title": "{{myNamespace-Display.flpTitle}}",
          "icon": "sap-icon://home"
        }
      }
    }
  },
  "sap.ui": {
    "technology": "UI5",
    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
  },
  "sap.ui5": {
    "rootView": {
      "viewName": "my.namespace.view.App",
      "type": "XML",
      "async": true,
      "id": "app"
    },
    "dependencies": {
      "minUI5Version": "1.148.0",
      "libs": { "sap.m": {}, "sap.ui.core": {} }
    },
    "contentDensities": { "compact": true, "cozy": true },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "my.namespace.i18n.i18n",
          "supportedLocales": [""],
          "fallbackLocale": ""
        }
      },
      "": {
        "dataSource": "mainService",
        "type": "sap.ui.model.odata.v2.ODataModel",
        "preload": true,
        "settings": { "useBatch": false, "defaultBindingMode": "TwoWay" }
      }
    },
    "resources": {
      "css": [{ "uri": "css/style.css" }]
    },
    "routing": {
      "config": {
        "routerClass": "sap.m.routing.Router",
        "viewType": "XML",
        "viewPath": "my.namespace.view",
        "controlId": "app",
        "controlAggregation": "pages",
        "async": true
      },
      "routes": [
        { "pattern": "",     "name": "home",   "target": "home" },
        { "pattern": "detail/{id}", "name": "detail", "target": "detail" }
      ],
      "targets": {
        "home":   { "viewName": "Home",   "viewId": "homePage" },
        "detail": { "viewName": "Detail", "viewId": "detailPage" }
      }
    }
  },
  "sap.cloud": { "public": true, "service": "MyService" }
}
```

**Key sections:**

| Section | Purpose |
|---|---|
| `sap.app.id` | Must match `data-name` in `index.html` and the namespace in `Component.js`. |
| `sap.app.dataSources` | Named OData (or REST) endpoints; referenced by model entries below. |
| `sap.ui5.rootView` | The first view the framework renders; keep it a bare `sap.m.App` shell. |
| `sap.ui5.models` | Declares the default model (`""`), named OData models, and the i18n resource model. |
| `sap.ui5.routing` | Router config + route/target pairs; targets reference view names under `viewPath`. |
| `sap.cloud.service` | Required for BTP/CF deployment via MTA. |

---

### `webapp/view/App.view.xml` (root view)
One-line purpose: minimal shell containing the `sap.m.App` control that the router fills with pages.

```xml
<mvc:View
    controllerName="my.namespace.controller.App"
    displayBlock="true"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m">
    <App id="app">
        <!-- Router injects pages here via controlAggregation="pages" -->
    </App>
</mvc:View>
```

The `id="app"` must match `controlId` in the manifest routing config.

---

### `webapp/controller/App.controller.js` (root controller)
One-line purpose: root controller for the App shell — typically minimal; real logic lives in page controllers.

```javascript
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("my.namespace.controller.App", {
        onInit() {
            // Wire model-ready guards here if needed, e.g.:
            // const oModel = this.getView().getModel();
            // if (oModel) oModel.metadataLoaded().then(() => { ... });
        }
    });
});
```

For page controllers, extend the same pattern and add `onInit`, `onRouteMatched` (via `this.getOwnerComponent().getRouter().getRoute("name").attachPatternMatched`), and any event handlers.

---

### `webapp/i18n/i18n.properties`
One-line purpose: default locale resource bundle; keys referenced in XML views via `{i18n>key}` binding.

```properties
# Resource bundle for my.namespace

#XTIT: Application name (shown in FLP tile)
appTitle=My App

#YDES: Application description
appDescription=An SAP Fiori application.

#XTIT: FLP tile title
myNamespace-Display.flpTitle=My App

# Page titles
homeTitle=Home
detailTitle=Detail

# Common actions
save=Save
cancel=Cancel
delete=Delete
```

**Comment conventions:**
- `#XTIT` — short UI text (title, label, button)
- `#YDES` — description text
- `#YMSG` — message / dialog text

Bind in XML: `title="{i18n>homeTitle}"`. Access in JS: `this.getResourceBundle().getText("homeTitle")`.

**Two declaration styles** (both used across the apps, both valid):
- Simple string — `"i18n": "i18n/i18n.properties"` (shortest; auto-resolves locales).
- Object form — `"i18n": { "bundleUrl": "i18n/i18n.properties", "supportedLocales": [""], "fallbackLocale": "" }`. Use this to pin a single locale and skip probing for `i18n_xx.properties` variants that don't exist.

---

## Optional Files

### `webapp/model/models.js`
One-line purpose: small factory module for app-wide client models — most commonly the read-only Device model.

```javascript
sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], (JSONModel, Device) => {
    "use strict";

    return {
        // Runtime device info (orientation, system, media) as a OneWay JSONModel.
        createDeviceModel() {
            const oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };
});
```

Wire it in `Component.init()` before `getRouter().initialize()`:

```javascript
this.setModel(models.createDeviceModel(), "device");
```

Bind against it in XML for responsive behaviour, e.g. `visible="{device>/system/phone}"`.

---

### `ui5.yaml`
One-line purpose: configures the `ui5 serve` dev server — local proxy to CAP backend + live reload.

```yaml
specVersion: "4.0"
metadata:
  name: my.namespace
type: application
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        backend:
          - path: /srv-api
            url: http://localhost:4004
        ui5:
          path: [/resources, /test-resources]
          url: https://sapui5.hana.ondemand.com
    - name: fiori-tools-appreload
      afterMiddleware: compression
      configuration:
        port: 35729
        path: webapp
        delay: 300
```

The `backend` entry proxies `/srv-api` to the local CAP server (`cds watch`, port 4004). The `ui5` entry proxies CDN resources so the dev server works without internet once cached.

A companion `ui5-deploy.yaml` overrides `metadata.name` and adds deploy tasks; it mirrors this file's structure with `builder.customTasks` replacing `server.customMiddleware`.

---

### `dist/Component-preload.js`
One-line purpose: build artifact that bundles all app modules into one file for faster production startup.

Generated by `ui5 build preload`; never hand-edited. It is included automatically when `index.html` is served from `dist/`. Header format:

```
//@ui5-bundle my.namespace/Component-preload.js
```

The bundle inlines every JS module, all XML views and fragments, the manifest, i18n, and CSS. A `-dbg.js` (readable) and `.map` file are emitted alongside it.

---

## Directory Layout Summary

```
webapp/
├── index.html              → bootstrap entry point
├── Component.js            → root UIComponent
├── manifest.json           → app descriptor
├── controller/
│   ├── App.controller.js   → shell controller (minimal)
│   └── <Page>.controller.js
├── view/
│   ├── App.view.xml        → shell view (sap.m.App only)
│   └── <Page>.view.xml
├── i18n/
│   └── i18n.properties
├── model/
│   └── models.js           → helper to create JSONModel / Device model
├── css/
│   └── style.css
└── scripts/                → optional: vendored third-party libs
    └── *.min.js
```

---

## Common Pitfalls

- **Namespace mismatch**: `sap.app.id` in manifest, `data-name` in index.html, the `extend()` call in Component.js, and the `data-sap-ui-resource-roots` key must all be the same string.
- **Router not initialized**: always call `this.getRouter().initialize()` at the end of `Component.init()`, after all models are set.
- **`IAsyncContentCreation` + sync views**: if you declare this interface, every view must use `async: true` or be created programmatically; mixing synchronous view loading will throw.
- **`controlId` / `controlAggregation` mismatch**: the `controlId` in routing config must match the `id` attribute on the `<App>` control in `App.view.xml`.
- **i18n bundleName dot notation**: `bundleName` uses dots as separators (`my.namespace.i18n.i18n`), which maps to `webapp/i18n/i18n.properties` given the resource root.
