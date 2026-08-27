# Reference App: `cap-fullstack-listreport`

**Type:** CAP + Fiori Elements — List Report + Object Page (LROP)  
**Purpose:** Full-stack starter with a CAP OData V4 backend and an annotation-driven Fiori Elements List Report / Object Page frontend. Default template for browse-and-edit transactional apps.  
**Run locally:** `npm install && npm run watch-listreportapp` → `http://localhost:4004`

---

## Project Structure

```text
cap-fullstack-listreport/
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
│   └── listreportapp/
│       ├── annotations.cds
│       ├── package.json
│       ├── eslint.config.mjs
│       ├── ui5.yaml
│       └── webapp/
│           ├── Component.js
│           ├── manifest.json
│           ├── index.html
│           ├── i18n/
│           │   └── i18n.properties
│           └── test/
│               ├── flp.html
│               └── integration/
│                   ├── FirstJourney.js
│                   ├── BooksListJourney.js
│                   ├── BooksObjectPageJourney.js
│                   └── pages/
│                       ├── BooksList.js
│                       ├── BooksObjectPage.js
│                       └── JourneyRunner.js
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
  "name": "cap-fullstack-listreport",
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
    "watch-listreportapp": "cds watch --open listreportapp/index.html?sap-ui-xx-viewCache=false --livereload false"
  },
  "private": true,
  "cds": {},
  "workspaces": ["app/*"],
  "sapux": ["app/listreportapp"]
}
```

`cds-plugin-ui5` bridges `cds watch` and the UI5 tooling server so both run on the same port (4004). `sapux` registers the app with SAP Fiori tools (Page Map, Annotation Modeler).

---

### `mta.yaml`

```yaml
_schema-version: 3.3.0
ID: cap-fullstack-listreport
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
  - name: cap-fullstack-listreport-srv
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
      - name: cap-fullstack-listreport-db

  - name: cap-fullstack-listreport-db-deployer
    type: hdb
    path: gen/db
    parameters:
      buildpack: nodejs_buildpack
    requires:
      - name: cap-fullstack-listreport-db

resources:
  - name: cap-fullstack-listreport-db
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
# CAP cap-fullstack-listreport
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
using from './listreportapp/annotations';
```

Pulls the UI annotation file into the CDS compilation so annotation-driven OData metadata is included in `cds build --production`.

---

### `app/listreportapp/annotations.cds`

```cds
using CatalogService as service from '../../srv/cat-service';
annotate service.Books with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'ID',
                Value : ID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'title',
                Value : title,
            },
            {
                $Type : 'UI.DataField',
                Label : 'stock',
                Value : stock,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'ID',
            Value : ID,
        },
        {
            $Type : 'UI.DataField',
            Label : 'title',
            Value : title,
        },
        {
            $Type : 'UI.DataField',
            Label : 'stock',
            Value : stock,
        },
    ],
);
```

`UI.LineItem` → List Report table columns. `UI.FieldGroup` + `UI.Facets` → Object Page body section.

---

### `app/listreportapp/package.json`

```json
{
  "name": "listreportapp",
  "version": "0.0.1",
  "devDependencies": {
    "@ui5/cli": "^4.0.33",
    "@sap/ux-ui5-tooling": "1",
    "@sap-ux/eslint-plugin-fiori-tools": "^10.0.0",
    "eslint": "^10"
  },
  "scripts": {
    "test": "ui5 test --spec webapp/test/flp.html",
    "deploy-config": "npx --yes @sap/ux-ui5-tooling@latest init --addDeployConfig"
  }
}
```

---

### `app/listreportapp/eslint.config.mjs`

```js
import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    ...fioriTools.configs.recommended
];
```

---

### `app/listreportapp/ui5.yaml`

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json

specVersion: "4.0"
metadata:
  name: listreportapp
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

### `app/listreportapp/webapp/Component.js`

```js
sap.ui.define(
    ["sap/fe/core/AppComponent"],
    function (Component) {
        "use strict";

        return Component.extend("listreportapp.Component", {
            metadata: {
                manifest: "json"
            }
        });
    }
);
```

Extends `sap/fe/core/AppComponent`. No custom logic needed — Fiori Elements handles routing, OData model wiring, and draft lifecycle.

---

### `app/listreportapp/webapp/manifest.json`

```json
{
  "_version": "1.85.0",
  "sap.app": {
    "id": "listreportapp",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "applicationVersion": { "version": "0.0.1" },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "resources": "resources.json",
    "sourceTemplate": {
      "id": "@sap/generator-fiori:lrop",
      "version": "1.27.0",
      "toolsId": "43539c2f-cf95-46c7-a85c-5f7592462598"
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
        "sap.ui.core": {},
        "sap.fe.templates": {}
      }
    },
    "contentDensities": { "compact": true, "cozy": true },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": { "bundleName": "listreportapp.i18n.i18n" }
      },
      "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
          "operationMode": "Server",
          "autoExpandSelect": true,
          "earlyRequests": true
        }
      },
      "@i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "uri": "i18n/i18n.properties"
      }
    },
    "resources": { "css": [] },
    "routing": {
      "config": {},
      "routes": [
        { "pattern": ":?query:",             "name": "BooksList",       "target": "BooksList"       },
        { "pattern": "Books({key}):?query:", "name": "BooksObjectPage", "target": "BooksObjectPage" }
      ],
      "targets": {
        "BooksList": {
          "type": "Component",
          "id": "BooksList",
          "name": "sap.fe.templates.ListReport",
          "options": {
            "settings": {
              "contextPath": "/Books",
              "variantManagement": "Page",
              "navigation": {
                "Books": { "detail": { "route": "BooksObjectPage" } }
              },
              "controlConfiguration": {
                "@com.sap.vocabularies.UI.v1.LineItem": {
                  "tableSettings": { "type": "ResponsiveTable" }
                }
              }
            }
          }
        },
        "BooksObjectPage": {
          "type": "Component",
          "id": "BooksObjectPage",
          "name": "sap.fe.templates.ObjectPage",
          "options": {
            "settings": {
              "editableHeaderContent": false,
              "contextPath": "/Books"
            }
          }
        }
      }
    }
  },
  "sap.fiori": {
    "registrationIds": [],
    "archeType": "transactional"
  },
  "sap.fe": {
    "app": { "enableLazyLoading": true }
  }
}
```

---

### `app/listreportapp/webapp/index.html`

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
            "listreportapp": "./"
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
        data-name="listreportapp"
        data-id="container"
        data-settings='{"id" : "listreportapp"}'
        data-handle-validation="true"
    ></div>
</body>
</html>
```

---

### `app/listreportapp/webapp/i18n/i18n.properties`

```properties
appTitle=App Title
appDescription=An SAP Fiori application.
```

---

### `app/listreportapp/webapp/test/flp.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FLP Sandbox — OPA5 Tests</title>
    <script>
        window["sap-ushell-config"] = {
            defaultRenderer: "fiori2",
            applications: {
                "app-preview": {
                    additionalInformation: "SAPUI5.Component=listreportapp",
                    applicationType: "URL",
                    url: "../"
                }
            }
        };
    </script>
    <script
        id="sap-ui-bootstrap"
        src="https://ui5.sap.com/resources/sap-ui-core.js"
        data-sap-ui-libs="sap.m,sap.ushell,sap.fe.templates"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resourceroots='{"listreportapp": "../"}'
        data-sap-ui-compatVersion="edge"
        data-sap-ui-async="true"
        data-sap-ui-frameOptions="trusted"
        data-sap-ui-xx-waitForTheme="true">
    </script>
    <link rel="stylesheet" href="https://ui5.sap.com/resources/sap/ui/thirdparty/qunit-2.css">
    <script src="https://ui5.sap.com/resources/sap/ui/thirdparty/qunit-2.js"></script>
    <script src="https://ui5.sap.com/resources/sap/ui/qunit/qunit-junit.js"></script>
    <script>
        sap.ui.getCore().attachInit(function () {
            sap.ui.require(["listreportapp/test/integration/FirstJourney"]);
        });
    </script>
</head>
<body class="sapUiBody" id="content">
    <div id="qunit"></div>
    <div id="qunit-fixture"></div>
</body>
</html>
```

---

### `app/listreportapp/webapp/test/integration/FirstJourney.js`

```js
sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();
            Then.onTheBooksList.iSeeThisPage();
        });

        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            When.onTheBooksList.onFilterBar().iExecuteSearch();
            Then.onTheBooksList.onTable().iCheckRows();
            When.onTheBooksList.onTable().iPressRow(0);
            Then.onTheBooksObjectPage.iSeeThisPage();
        });

        opaTest("Teardown", function (Given, When, Then) {
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});
```

---

### `app/listreportapp/webapp/test/integration/BooksListJourney.js`

```js
sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("BooksListListReport journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();
            Then.onTheBooksList.iSeeThisPage();
        });

        // opaTest("Perform a global search and check the result", function (Given, When, Then) {
        //     When.onTheBooksList.onFilterBar().iChangeSearchField("Search Term");
        //     When.onTheBooksList.onFilterBar().iExecuteSearch();
        //     Then.onTheBooksList.onTable().iCheckRows();
        // });

        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            When.onTheBooksList.onFilterBar().iExecuteSearch();
            Then.onTheBooksList.onTable().iCheckRows();
            When.onTheBooksList.onTable().iPressRow(0);
            Then.onTheBooksObjectPage.iSeeThisPage();
        });

        opaTest("Teardown", function (Given, When, Then) {
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});
```

---

### `app/listreportapp/webapp/test/integration/BooksObjectPageJourney.js`

```js
sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("BooksObjectPageObjectPage journey");

        opaTest("Navigate to BooksObjectPageObjectPage", function (Given, When, Then) {
            Given.iStartMyApp();

            When.onTheBooksList.onFilterBar().iExecuteSearch();
            Then.onTheBooksList.onTable().iCheckRows();
            When.onTheBooksList.onTable().iPressRow(0);
            Then.onTheBooksObjectPage.iSeeThisPage();
        });

        opaTest("Teardown", function (Given, When, Then) {
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});
```

---

### `app/listreportapp/webapp/test/integration/pages/BooksList.js`

```js
sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'listreportapp',
            componentId: 'BooksList',
            contextPath: '/Books'
        },
        CustomPageDefinitions
    );
});
```

---

### `app/listreportapp/webapp/test/integration/pages/BooksObjectPage.js`

```js
sap.ui.define(['sap/fe/test/ObjectPage', 'sap/ui/test/actions/Press'], function(ObjectPage, Press) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {
            iPressSectionIconTabFilterButton: function (section) {
                return this.waitFor({
                    id: new RegExp(`.*--fe::FacetSection::${section}-anchor$`),
                    actions: new Press()
                });
            }
        },
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'listreportapp',
            componentId: 'BooksObjectPage',
            contextPath: '/Books'
        },
        CustomPageDefinitions
    );
});
```

---

### `app/listreportapp/webapp/test/integration/pages/JourneyRunner.js`

```js
sap.ui.define([
    "sap/fe/test/JourneyRunner",
    "listreportapp/test/integration/pages/BooksList",
    "listreportapp/test/integration/pages/BooksObjectPage"
], function (JourneyRunner, BooksList, BooksObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('listreportapp') + '/test/flp.html#app-preview',
        pages: {
            onTheBooksList: BooksList,
            onTheBooksObjectPage: BooksObjectPage
        },
        async: true
    });

    return runner;
});
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
| Dev (CAP + UI5) | `npm run watch-listreportapp` | `http://localhost:4004` |
| CAP only | `npm start` | `http://localhost:4004/odata/v4/catalog/` |
| OPA5 tests | `npm test` (in `app/listreportapp`) | Opens `webapp/test/flp.html` |
