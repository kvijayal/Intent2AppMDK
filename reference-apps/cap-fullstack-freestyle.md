# Reference App: `cap-fullstack-freestyle`

**Type:** CAP + Freestyle UI5 (JavaScript)  
**Purpose:** Full-stack starter with a CAP OData V4 backend and a hand-crafted UI5 frontend in JavaScript. Use when UX requirements cannot be expressed via Fiori Elements annotations.  
**Run locally:** `npm install && npm run watch-freestyleapp` → `http://localhost:4004`

---

## Project Structure

```text
cap-fullstack-freestyle/
├── package.json
├── mta.yaml
├── eslint.config.mjs
├── .gitignore
├── db/
│   ├── schema.cds
│   ├── data/
│   │   └── my.bookshop-Books.csv
│   └── src/
│       └── .hdiconfig
│   └── undeploy.json
├── srv/
│   └── cat-service.cds
├── app/
│   ├── services.cds
│   └── freestyleapp/
│       ├── annotations.cds
│       ├── package.json
│       ├── eslint.config.mjs
│       ├── ui5.yaml
│       └── webapp/
│           ├── Component.js
│           ├── manifest.json
│           ├── index.html
│           ├── controller/
│           │   ├── App.controller.js
│           │   └── V1000.controller.js
│           ├── view/
│           │   ├── App.view.xml
│           │   └── V1000.view.xml
│           ├── model/
│           │   └── models.js
│           ├── i18n/
│           │   └── i18n.properties
│           └── css/
│               └── style.css
└── .vscode/
    ├── extensions.json
    ├── launch.json
    └── tasks.json
```

---

## File Contents

### `package.json`

```json
{
  "name": "cap-fullstack-freestyle",
  "version": "1.0.0",
  "description": "A simple CAP project.",
  "dependencies": {
    "@cap-js/hana": "^3",
    "@sap/cds": "^10",
    "express": "^4"
  },
  "devDependencies": {
    "@cap-js/sqlite": "^3",
    "@sap/cds-dk": "^10",
    "cds-plugin-ui5": "^0.17.0"
  },
  "scripts": {
    "start": "cds-serve",
    "watch-freestyleapp": "cds watch --open freestyleapp/index.html?sap-ui-xx-viewCache=false --livereload false"
  },
  "private": true,
  "cds": {},
  "workspaces": ["app/*"]
}
```

`cds-plugin-ui5` makes `cds watch` serve both CAP OData and the UI5 app on a single port (4004). No `sapux` entry — freestyle apps don't use the Fiori tools Page Map or Annotation Modeler.

---

### `mta.yaml`

```yaml
_schema-version: 3.3.0
ID: cap-fullstack-freestyle
version: 1.0.0
description: "A simple CAP project."
parameters:
  enable-parallel-deployments: true
build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npx cds build --production
modules:
  - name: cap-fullstack-freestyle-srv
    type: nodejs
    path: gen/srv
    parameters:
      instances: 1
      buildpack: nodejs_buildpack
    build-parameters:
      builder: npm-ci
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}
    requires:
      - name: cap-fullstack-freestyle-db

  - name: cap-fullstack-freestyle-db-deployer
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
    requires:
      - name: cap-fullstack-freestyle-db

resources:
  - name: cap-fullstack-freestyle-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared
```

---

### `eslint.config.mjs`

```js
import cds from '@sap/cds/eslint.config.mjs'
export default [ ...cds.recommended ]
```

---

### `.gitignore`

```gitignore
# CAP cap-fullstack-freestyle
_out
*.db
*.sqlite
connection.properties
default-*.json
.cdsrc-private.json
gen/
node_modules/
target/

# Web IDE, App Studio
.che/
.gen/

# MTA
*_mta_build_tmp
*.mtar
mta_archives/

# Other
.DS_Store
*.orig
*.log

*.iml
*.flattened-pom.xml

# IDEs
# .vscode
# .idea

# @cap-js/cds-typer
@cds-models
```

---

### `db/schema.cds`

```cds
namespace my.bookshop;

entity Books {
  key ID    : Integer;
      title : String;
      stock : Integer;
}
```

---

### `db/data/my.bookshop-Books.csv`

```csv
ID,title,stock
1,Wuthering Heights,100
2,Jane Eyre,500
```

---

### `db/src/.hdiconfig`

```json
{
  "file_suffixes": {
    "csv":                      { "plugin_name": "com.sap.hana.di.tabledata.source" },
    "hdbafllangprocedure":      { "plugin_name": "com.sap.hana.di.afllangprocedure" },
    "hdbanalyticprivilege":     { "plugin_name": "com.sap.hana.di.analyticprivilege" },
    "hdbcalculationview":       { "plugin_name": "com.sap.hana.di.calculationview" },
    "hdbcollection":            { "plugin_name": "com.sap.hana.di.collection" },
    "hdbconstraint":            { "plugin_name": "com.sap.hana.di.constraint" },
    "hdbdropcreatetable":       { "plugin_name": "com.sap.hana.di.dropcreatetable" },
    "hdbflowgraph":             { "plugin_name": "com.sap.hana.di.flowgraph" },
    "hdbfunction":              { "plugin_name": "com.sap.hana.di.function" },
    "hdbgraphworkspace":        { "plugin_name": "com.sap.hana.di.graphworkspace" },
    "hdbhadoopmrjob":           { "plugin_name": "com.sap.hana.di.virtualfunctionpackage.hadoop" },
    "hdbindex":                 { "plugin_name": "com.sap.hana.di.index" },
    "hdblibrary":               { "plugin_name": "com.sap.hana.di.library" },
    "hdbmigrationtable":        { "plugin_name": "com.sap.hana.di.table.migration" },
    "hdbprocedure":             { "plugin_name": "com.sap.hana.di.procedure" },
    "hdbprojectionview":        { "plugin_name": "com.sap.hana.di.projectionview" },
    "hdbprojectionviewconfig":  { "plugin_name": "com.sap.hana.di.projectionview.config" },
    "hdbreptask":               { "plugin_name": "com.sap.hana.di.reptask" },
    "hdbresultcache":           { "plugin_name": "com.sap.hana.di.resultcache" },
    "hdbrole":                  { "plugin_name": "com.sap.hana.di.role" },
    "hdbroleconfig":            { "plugin_name": "com.sap.hana.di.role.config" },
    "hdbsearchruleset":         { "plugin_name": "com.sap.hana.di.searchruleset" },
    "hdbsequence":              { "plugin_name": "com.sap.hana.di.sequence" },
    "hdbstatistics":            { "plugin_name": "com.sap.hana.di.statistics" },
    "hdbstructuredprivilege":   { "plugin_name": "com.sap.hana.di.structuredprivilege" },
    "hdbsynonym":               { "plugin_name": "com.sap.hana.di.synonym" },
    "hdbsynonymconfig":         { "plugin_name": "com.sap.hana.di.synonym.config" },
    "hdbsystemversioning":      { "plugin_name": "com.sap.hana.di.systemversioning" },
    "hdbtable":                 { "plugin_name": "com.sap.hana.di.table" },
    "hdbtabledata":             { "plugin_name": "com.sap.hana.di.tabledata" },
    "hdbtabletype":             { "plugin_name": "com.sap.hana.di.tabletype" },
    "hdbtrigger":               { "plugin_name": "com.sap.hana.di.trigger" },
    "hdbview":                  { "plugin_name": "com.sap.hana.di.view" },
    "hdbvirtualfunction":       { "plugin_name": "com.sap.hana.di.virtualfunction" },
    "hdbvirtualfunctionconfig": { "plugin_name": "com.sap.hana.di.virtualfunction.config" },
    "hdbvirtualpackagehadoop":  { "plugin_name": "com.sap.hana.di.virtualpackage.hadoop" },
    "hdbvirtualpackagesparksql":{ "plugin_name": "com.sap.hana.di.virtualpackage.sparksql" },
    "hdbvirtualprocedure":      { "plugin_name": "com.sap.hana.di.virtualprocedure" },
    "hdbvirtualprocedureconfig":{ "plugin_name": "com.sap.hana.di.virtualprocedure.config" },
    "hdbvirtualtable":          { "plugin_name": "com.sap.hana.di.virtualtable" },
    "hdbvirtualtableconfig":    { "plugin_name": "com.sap.hana.di.virtualtable.config" },
    "properties":               { "plugin_name": "com.sap.hana.di.tabledata.properties" },
    "tags":                     { "plugin_name": "com.sap.hana.di.tabledata.properties" },
    "txt":                      { "plugin_name": "com.sap.hana.di.copyonly" },
    "hdbeshconfig":             { "plugin_name": "com.sap.hana.di.eshconfig" }
  }
}
```

---

### `db/undeploy.json`

```json
[
  "src/gen/**/*.hdbview",
  "src/gen/**/*.hdbindex",
  "src/gen/**/*.hdbconstraint",
  "src/gen/**/*_drafts.hdbtable",
  "src/gen/**/*.hdbcalculationview"
]
```

---

### `srv/cat-service.cds`

```cds
using my.bookshop as my from '../db/schema';

service CatalogService {
    @readonly entity Books as projection on my.Books;
}
```

Service path at runtime: `/odata/v4/catalog/`

---

### `app/services.cds`

```cds
using from './freestyleapp/annotations';
```

---

### `app/freestyleapp/annotations.cds`

```cds
using CatalogService as service from '../../srv/cat-service';
```

Imports the service for CDS compilation. No UI annotations are defined here — freestyle apps drive the UI from controller and view code.

---

### `app/freestyleapp/package.json`

```json
{
  "name": "freestyleapp",
  "version": "0.0.1",
  "devDependencies": {
    "@ui5/cli": "^4.0.33",
    "@sap/ux-ui5-tooling": "1",
    "@sap-ux/eslint-plugin-fiori-tools": "^10.0.0",
    "eslint": "^10"
  },
  "scripts": {
    "deploy-config": "npx --yes @sap/ux-ui5-tooling@latest init --addDeployConfig"
  }
}
```

---

### `app/freestyleapp/eslint.config.mjs`

```js
import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    ...fioriTools.configs.recommended
];
```

---

### `app/freestyleapp/ui5.yaml`

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json

specVersion: "4.0"
metadata:
  name: freestyleapp
type: application
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ignoreCertErrors: false
        ui5:
          path:
            - /resources
            - /test-resources
          url: https://sapui5.hana.ondemand.com
    - name: fiori-tools-appreload
      afterMiddleware: compression
      configuration:
        port: 35729
        path: webapp
        delay: 300
    - name: fiori-tools-preview
      afterMiddleware: fiori-tools-appreload
      configuration:
        flp:
          theme: sap_horizon
```

---

### `app/freestyleapp/webapp/Component.js`

```js
sap.ui.define([
    "sap/ui/core/UIComponent",
    "freestyleapp/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("freestyleapp.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});
```

Extends `sap/ui/core/UIComponent` (not `sap/fe/core/AppComponent`) — gives full control over the app lifecycle. `IAsyncContentCreation` enables async root-view creation required for modern UI5.

---

### `app/freestyleapp/webapp/manifest.json`

```json
{
  "_version": "1.85.0",
  "sap.app": {
    "id": "freestyleapp",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "applicationVersion": { "version": "0.0.1" },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "resources": "resources.json",
    "sourceTemplate": {
      "id": "@sap/generator-fiori:basic",
      "version": "1.27.0",
      "toolsId": "9121f0c7-b109-4bb0-98a0-087041dc21fc"
    },
    "dataSources": {
      "mainService": {
        "uri": "/odata/v4/catalog/",
        "type": "OData",
        "settings": {
          "annotations": [],
          "odataVersion": "4.0"
        }
      }
    }
  },
  "sap.ui": {
    "technology": "UI5",
    "icons": { "icon": "", "favIcon": "", "phone": "", "phone@2": "", "tablet": "", "tablet@2": "" },
    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
  },
  "sap.ui5": {
    "flexEnabled": true,
    "dependencies": {
      "minUI5Version": "1.149.0",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {}
      }
    },
    "contentDensities": { "compact": true, "cozy": true },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": { "bundleName": "freestyleapp.i18n.i18n" }
      },
      "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
          "operationMode": "Server",
          "autoExpandSelect": true,
          "earlyRequests": true
        }
      }
    },
    "resources": {
      "css": [{ "uri": "css/style.css" }]
    },
    "routing": {
      "config": {
        "routerClass": "sap.m.routing.Router",
        "controlAggregation": "pages",
        "controlId": "app",
        "transition": "slide",
        "type": "View",
        "viewType": "XML",
        "path": "freestyleapp.view",
        "async": true,
        "viewPath": "freestyleapp.view"
      },
      "routes": [
        {
          "name": "RouteV1000",
          "pattern": ":?query:",
          "target": ["TargetV1000"]
        }
      ],
      "targets": {
        "TargetV1000": {
          "id": "V1000",
          "name": "V1000"
        }
      }
    },
    "rootView": {
      "viewName": "freestyleapp.view.App",
      "type": "XML",
      "id": "App",
      "async": true
    }
  }
}
```

`rootView` is always loaded first; route targets are injected into the `<App>` container inside it. `controlId: "app"` matches the `id="app"` on the `<App>` control in `App.view.xml`.

---

### `app/freestyleapp/webapp/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>App Title</title>
    <style>
        html, body, body > div, #container, #container-uiarea {
            height: 100%;
        }
    </style>
    <script
        id="sap-ui-bootstrap"
        src="https://sapui5.hana.ondemand.com/1.149.0/resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resource-roots='{
            "freestyleapp": "./"
        }'
        data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
        data-sap-ui-compat-version="edge"
        data-sap-ui-async="true"
        data-sap-ui-frame-options="trusted"
    ></script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content">
    <div
        data-sap-ui-component
        data-name="freestyleapp"
        data-id="container"
        data-settings='{"id" : "freestyleapp"}'
        data-handle-validation="true"
    ></div>
</body>
</html>
```

Loads SAPUI5 1.149.0 from the CDN. The resource root `"freestyleapp": "./"` maps the module namespace to the `webapp/` folder.

---

### `app/freestyleapp/webapp/controller/App.controller.js`

```js
sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  return BaseController.extend("freestyleapp.controller.App", {
      onInit() {
      }
  });
});
```

Root shell controller. Manages the `<App>` container. Add global event listeners or cross-view state here.

---

### `app/freestyleapp/webapp/controller/V1000.controller.js`

```js
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("freestyleapp.controller.V1000", {
        onInit() {
        }
    });
});
```

Main view controller. All business logic — OData reads, button handlers, formatter calls — goes here.

---

### `app/freestyleapp/webapp/view/App.view.xml`

```xml
<mvc:View controllerName="freestyleapp.controller.App"
    displayBlock="true"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m">
    <App id="app">
    </App>
</mvc:View>
```

Root shell view. The `<App>` control is the single-page-app container into which routes inject pages.

---

### `app/freestyleapp/webapp/view/V1000.view.xml`

```xml
<mvc:View controllerName="freestyleapp.controller.V1000"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m">
    <Page id="page" title="{i18n>title}">
    </Page>
</mvc:View>
```

First content view. Add controls, table bindings, and layout inside `<Page>`.

---

### `app/freestyleapp/webapp/model/models.js`

```js
sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime information for the device the UI5 app is running on as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };

});
```

---

### `app/freestyleapp/webapp/i18n/i18n.properties`

```properties
appTitle=App Title
appDescription=An SAP Fiori application.
title=App Title
```

---

### `app/freestyleapp/webapp/css/style.css`

```css
/* Enter your custom styles here */
```

---

### `.vscode/extensions.json`

```json
{
  "recommendations": [
    "SAPSE.vscode-cds",
    "dbaeumer.vscode-eslint",
    "mechatroner.rainbow-csv",
    "qwtel.sqlite-viewer",
    "humao.rest-client"
  ],
  "unwantedRecommendations": []
}
```

---

### `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "cds serve",
      "request": "launch",
      "type": "node",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "cds",
      "args": ["serve", "--with-mocks", "--in-memory?"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

---

### `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "shell",
      "label": "cds watch",
      "command": "cds",
      "args": ["watch"],
      "group": { "kind": "build", "isDefault": true },
      "problemMatcher": []
    },
    {
      "type": "shell",
      "label": "cds serve",
      "command": "cds",
      "args": ["serve", "--with-mocks", "--in-memory?"],
      "problemMatcher": []
    }
  ]
}
```

---

## Runtime Behaviour

| Mode | Command | URL |
| --- | --- | --- |
| Dev (CAP + UI5) | `npm run watch-freestyleapp` | `http://localhost:4004` |
| CAP only | `npm start` | `http://localhost:4004/odata/v4/catalog/` |

**OData:** `GET http://localhost:4004/odata/v4/catalog/Books`  
**App:** `http://localhost:4004/freestyleapp/webapp/index.html`

---

## MVC Wiring

```text
Component.js  →  initialises router from manifest.json
  RouteV1000 matched  →  loads V1000.view.xml
    controllerName="freestyleapp.controller.V1000"
      V1000.controller.js  →  handles events, reads OData via default model ("")
```
