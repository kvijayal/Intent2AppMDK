# Reference App: `freestyle-ui5-ts`

**Type:** Standalone Freestyle UI5 — TypeScript  
**Purpose:** Frontend-only SAPUI5 app in TypeScript with `ui5-tooling-transpile`. No CAP backend. Ships with offline mock server, proxy-to-backend, local-framework variant, OPA5 integration tests, and QUnit unit tests.  
**Run (offline):** `npm install && npm run start:mock`  
**Run (real backend):** `npm run start:proxy`

---

## Project Structure

```text
freestyle-ui5-ts/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── .gitignore
├── ui5.yaml
├── ui5-mock.yaml
├── ui5-local.yaml
└── webapp/
    ├── Component.ts
    ├── manifest.json
    ├── index.html
    ├── controller/
    │   ├── App.controller.ts
    │   └── View1.controller.ts
    ├── view/
    │   ├── App.view.xml
    │   └── View1.view.xml
    ├── model/
    │   └── models.ts
    ├── i18n/
    │   └── i18n.properties
    ├── css/
    │   └── style.css
    ├── localService/
    │   └── mainService/
    │       └── metadata.xml
    └── test/
        ├── testsuite.qunit.html
        ├── testsuite.qunit.ts
        ├── integration/
        │   ├── NavigationJourney.ts
        │   ├── opaTests.qunit.html
        │   ├── opaTests.qunit.ts
        │   └── pages/
        │       ├── AppPage.ts
        │       └── View1Page.ts
        └── unit/
            ├── unitTests.qunit.html
            ├── unitTests.qunit.ts
            └── controller/
                └── View1Page.controller.ts
```

---

## File Contents

### `package.json`

```json
{
  "name": "intent2app-freestyle-ui5-ts",
  "version": "0.0.1",
  "description": "Intent2App reference starter — Freestyle SAPUI5 (TypeScript) with OPA5 + QUnit, an offline mock server, and proxy-to-backend.",
  "keywords": ["ui5", "openui5", "sapui5"],
  "main": "webapp/index.html",
  "dependencies": {},
  "devDependencies": {
    "@ui5/cli": "^4.0.33",
    "@sap/ux-ui5-tooling": "1",
    "@sap-ux/eslint-plugin-fiori-tools": "^9.0.0",
    "eslint": "^9",
    "@sapui5/types": "~1.146.0",
    "ui5-tooling-transpile": "^3.10.0",
    "typescript": "^5.9.3",
    "@sap-ux/ui5-middleware-fe-mockserver": "2"
  },
  "scripts": {
    "start":        "fiori run --open \"index.html\"",
    "start:proxy":  "fiori run --config ./ui5.yaml --open \"index.html\"",
    "start:mock":   "fiori run --config ./ui5-mock.yaml --open \"index.html\"",
    "start-local":  "fiori run --config ./ui5-local.yaml --open \"index.html\"",
    "build":        "ui5 build --config=ui5.yaml --clean-dest --dest dist",
    "lint":         "eslint ./",
    "ts-typecheck": "tsc --noEmit",
    "prebuild":     "npm run ts-typecheck",
    "unit-test":    "fiori run --config ./ui5-mock.yaml --open \"test/unit/unitTests.qunit.html\"",
    "int-test":     "fiori run --config ./ui5-mock.yaml --open \"test/integration/opaTests.qunit.html\""
  },
  "sapuxLayer": "CUSTOMER_BASE"
}
```

`prebuild` runs `ts-typecheck` before every `build` — prevents deploying type-errored code. `@sapui5/types` must be pinned to the UI5 version in use.

---

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "skipLibCheck": true,
    "allowJs": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "moduleResolution": "node",
    "rootDir": "./webapp",
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "com.intent2app.sample/*": ["./webapp/*"],
      "unit/*":        ["./webapp/test/unit/*"],
      "integration/*": ["./webapp/test/integration/*"]
    },
    "typeRoots": [
      "./node_modules/@types",
      "./node_modules/@sapui5/types"
    ]
  },
  "include": ["./webapp/**/*"]
}
```

`paths` aliases allow test files to import `com.intent2app.sample/controller/View1.controller` without deep relative paths. `strictPropertyInitialization: false` relaxes class field checks common in UI5 controllers.

---

### `eslint.config.mjs`

```js
import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    ...fioriTools.configs.recommended
];
```

---

### `.gitignore`

```gitignore
node_modules/
dist/
.scp/
.env
Makefile*.mta
mta_archives
mta-*
resources
archive.zip
.*_mta_build_tmp
```

---

### `ui5.yaml` (proxy run — `npm run start:proxy`)

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json

specVersion: "4.0"
metadata:
  name: com.intent2app.sample
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
          url: https://ui5.sap.com
        backend:
          - path: /V4
            url: https://services.odata.org
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
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        debug: true
        transformModulesToUI5:
          overridesToOverride: true
        excludePatterns:
          - /Component-preload.js
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        debug: true
        transformModulesToUI5:
          overridesToOverride: true
```

`ui5-tooling-transpile-middleware` intercepts `.ts` requests and serves transpiled AMD JS on the fly. `ui5-tooling-transpile-task` runs the same step during `ui5 build` for the production `dist/`.

---

### `ui5-mock.yaml` (offline mock — `npm run start:mock`)

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json

specVersion: "4.0"
metadata:
  name: com.intent2app.sample
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
          url: https://ui5.sap.com
        backend:
          - path: /V4
            url: https://services.odata.org
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
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        debug: true
        transformModulesToUI5:
          overridesToOverride: true
        excludePatterns:
          - /Component-preload.js
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /V4/(S(4appsbv3cusayoxwflo3rhn1))/TripPinServiceRW
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: true
        annotations: []
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        debug: true
        transformModulesToUI5:
          overridesToOverride: true
```

`generateMockData: true` — auto-generates entity data from the EDMX when no JSON files exist in `mockdataPath`. `urlPath` must exactly match the `dataSource uri` in `manifest.json`.

---

### `ui5-local.yaml` (local framework — `npm run start-local`)

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json

specVersion: "4.0"
metadata:
  name: com.intent2app.sample
type: application
framework:
  name: SAPUI5
  version: 1.146.0
  libraries:
    - name: sap.m
    - name: sap.ui.core
    - name: sap.ushell
    - name: themelib_sap_horizon
server:
  customMiddleware:
    - name: fiori-tools-appreload
      afterMiddleware: compression
      configuration:
        port: 35729
        path: webapp
        delay: 300
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        debug: true
        transformModulesToUI5:
          overridesToOverride: true
        excludePatterns:
          - /Component-preload.js
    - name: fiori-tools-preview
      afterMiddleware: fiori-tools-appreload
      configuration:
        flp:
          theme: sap_horizon
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ignoreCertErrors: false
        backend:
          - path: /V4
            url: https://services.odata.org
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /V4/(S(4appsbv3cusayoxwflo3rhn1))/TripPinServiceRW
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: true
        annotations: []
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        debug: true
        transformModulesToUI5:
          overridesToOverride: true
```

Adds a `framework` block so SAPUI5 1.146.0 is downloaded and served locally — no CDN needed.

---

### `webapp/Component.ts`

```typescript
import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";

/**
 * @namespace com.intent2app.sample
 */
export default class Component extends BaseComponent {

    public static metadata = {
        manifest: "json",
        interfaces: [
            "sap.ui.core.IAsyncContentCreation"
        ]
    };

    public init(): void {
        // call the base component's init function
        super.init();

        // set the device model
        this.setModel(createDeviceModel(), "device");

        // enable routing
        this.getRouter().initialize();
    }
}
```

The `@namespace` JSDoc tag is required by `ui5-tooling-transpile` to generate the correct AMD module name `com/intent2app/sample/Component`.

---

### `webapp/manifest.json`

```json
{
  "_version": "1.83.0",
  "sap.app": {
    "id": "com.intent2app.sample",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "applicationVersion": { "version": "0.0.1" },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "resources": "resources.json",
    "sourceTemplate": {
      "id": "@sap/generator-fiori:basic",
      "version": "1.22.0",
      "toolsId": "b5962d4f-b07b-4cec-ac36-0492bdc5b273"
    },
    "dataSources": {
      "mainService": {
        "uri": "/V4/(S(4appsbv3cusayoxwflo3rhn1))/TripPinServiceRW/",
        "type": "OData",
        "settings": {
          "annotations": [],
          "localUri": "localService/mainService/metadata.xml",
          "odataVersion": "4.01"
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
      "minUI5Version": "1.146.0",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {}
      }
    },
    "contentDensities": { "compact": true, "cozy": true },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": { "bundleName": "com.intent2app.sample.i18n.i18n" }
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
        "path": "com.intent2app.sample.view",
        "async": true,
        "viewPath": "com.intent2app.sample.view"
      },
      "routes": [
        {
          "name": "RouteView1",
          "pattern": ":?query:",
          "target": ["TargetView1"]
        }
      ],
      "targets": {
        "TargetView1": {
          "id": "View1",
          "name": "View1"
        }
      }
    },
    "rootView": {
      "viewName": "com.intent2app.sample.view.App",
      "type": "XML",
      "id": "App",
      "async": true
    }
  }
}
```

`localUri` points the OData model to the local EDMX for offline mock validation. `odataVersion: "4.01"` matches the TripPin service; use `"4.0"` for standard V4 services.

---

### `webapp/index.html`

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
        src="resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resource-roots='{
            "com.intent2app.sample": "./"
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
        data-name="com.intent2app.sample"
        data-id="container"
        data-settings='{"id" : "com.intent2app.sample"}'
        data-handle-validation="true"
    ></div>
</body>
</html>
```

Loads UI5 from `resources/sap-ui-core.js` (served locally by the UI5 tooling dev server — not the CDN). The resource root maps `com.intent2app.sample` to `./` (the `webapp/` folder).

---

### `webapp/controller/App.controller.ts`

```typescript
import Controller from "sap/ui/core/mvc/Controller";

/**
 * @namespace com.intent2app.sample.controller
 */
export default class App extends Controller {

    public onInit(): void {

    }
}
```

---

### `webapp/controller/View1.controller.ts`

```typescript
import Controller from "sap/ui/core/mvc/Controller";

/**
 * @namespace com.intent2app.sample.controller
 */
export default class View1 extends Controller {

    public onInit(): void {

    }
}
```

---

### `webapp/view/App.view.xml`

```xml
<mvc:View controllerName="com.intent2app.sample.controller.App"
    displayBlock="true"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m">
    <App id="app">
    </App>
</mvc:View>
```

---

### `webapp/view/View1.view.xml`

```xml
<mvc:View controllerName="com.intent2app.sample.controller.View1"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m">
    <Page id="page" title="{i18n>title}">
    </Page>
</mvc:View>
```

---

### `webapp/model/models.ts`

```typescript
import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";

export function createDeviceModel() {
    const model = new JSONModel(Device);
    model.setDefaultBindingMode("OneWay");
    return model;
}
```

---

### `webapp/i18n/i18n.properties`

```properties
# This is the resource bundle for com.intent2app.sample

#XTIT: Application name
appTitle=App Title

#YDES: Application description
appDescription=An SAP Fiori application.
#XTIT: Main view title
title=App Title
```

---

### `webapp/css/style.css`

```css
/* Enter your custom styles here */
```

---

### `webapp/localService/mainService/metadata.xml`

Sample OData V4 EDMX for the TripPin service. Replace with the target service's `$metadata` when adapting to a real backend.

```xml
<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Microsoft.OData.SampleService.Models.TripPin"
            xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EnumType Name="PersonGender">
        <Member Name="Male"   Value="0"/>
        <Member Name="Female" Value="1"/>
        <Member Name="Unknown" Value="2"/>
      </EnumType>
      <ComplexType Name="City">
        <Property Name="CountryRegion" Type="Edm.String" Nullable="false"/>
        <Property Name="Name"          Type="Edm.String" Nullable="false"/>
        <Property Name="Region"        Type="Edm.String" Nullable="false"/>
      </ComplexType>
      <ComplexType Name="Location" OpenType="true">
        <Property Name="Address" Type="Edm.String"                                                       Nullable="false"/>
        <Property Name="City"    Type="Microsoft.OData.SampleService.Models.TripPin.City" Nullable="false"/>
      </ComplexType>
      <ComplexType Name="EventLocation" BaseType="Microsoft.OData.SampleService.Models.TripPin.Location" OpenType="true">
        <Property Name="BuildingInfo" Type="Edm.String"/>
      </ComplexType>
      <ComplexType Name="AirportLocation" BaseType="Microsoft.OData.SampleService.Models.TripPin.Location" OpenType="true">
        <Property Name="Loc" Type="Edm.GeographyPoint" Nullable="false" SRID="4326"/>
      </ComplexType>
      <EntityType Name="Photo" HasStream="true">
        <Key><PropertyRef Name="Id"/></Key>
        <Property Name="Id"   Type="Edm.Int64"  Nullable="false"/>
        <Property Name="Name" Type="Edm.String"/>
      </EntityType>
      <EntityType Name="Person" OpenType="true">
        <Key><PropertyRef Name="UserName"/></Key>
        <Property Name="UserName"    Type="Edm.String"  Nullable="false"/>
        <Property Name="FirstName"   Type="Edm.String"  Nullable="false"/>
        <Property Name="LastName"    Type="Edm.String"  Nullable="false"/>
        <Property Name="Emails"      Type="Collection(Edm.String)"/>
        <Property Name="AddressInfo" Type="Collection(Microsoft.OData.SampleService.Models.TripPin.Location)"/>
        <Property Name="Gender"      Type="Microsoft.OData.SampleService.Models.TripPin.PersonGender"/>
        <Property Name="Concurrency" Type="Edm.Int64"   Nullable="false"/>
        <NavigationProperty Name="Friends"   Type="Collection(Microsoft.OData.SampleService.Models.TripPin.Person)"/>
        <NavigationProperty Name="Trips"     Type="Collection(Microsoft.OData.SampleService.Models.TripPin.Trip)"/>
        <NavigationProperty Name="Photo"     Type="Microsoft.OData.SampleService.Models.TripPin.Photo"/>
      </EntityType>
      <EntityType Name="Airline">
        <Key><PropertyRef Name="AirlineCode"/></Key>
        <Property Name="AirlineCode" Type="Edm.String" Nullable="false"/>
        <Property Name="Name"        Type="Edm.String" Nullable="false"/>
      </EntityType>
      <EntityType Name="Airport">
        <Key><PropertyRef Name="IcaoCode"/></Key>
        <Property Name="IcaoCode"  Type="Edm.String"  Nullable="false"/>
        <Property Name="Name"      Type="Edm.String"  Nullable="false"/>
        <Property Name="IataCode"  Type="Edm.String"  Nullable="false"/>
        <Property Name="Location"  Type="Microsoft.OData.SampleService.Models.TripPin.AirportLocation" Nullable="false"/>
      </EntityType>
      <EntityType Name="PlanItem">
        <Key><PropertyRef Name="PlanItemId"/></Key>
        <Property Name="PlanItemId"    Type="Edm.Int32"          Nullable="false"/>
        <Property Name="ConfirmationCode" Type="Edm.String"/>
        <Property Name="StartsAt"      Type="Edm.DateTimeOffset"/>
        <Property Name="EndsAt"        Type="Edm.DateTimeOffset"/>
        <Property Name="Duration"      Type="Edm.Duration"        Nullable="false"/>
      </EntityType>
      <EntityType Name="PublicTransportation" BaseType="Microsoft.OData.SampleService.Models.TripPin.PlanItem">
        <Property Name="SeatNumber" Type="Edm.String"/>
      </EntityType>
      <EntityType Name="Flight" BaseType="Microsoft.OData.SampleService.Models.TripPin.PublicTransportation">
        <Property Name="FlightNumber" Type="Edm.String" Nullable="false"/>
        <NavigationProperty Name="Airline" Type="Microsoft.OData.SampleService.Models.TripPin.Airline"/>
        <NavigationProperty Name="From"    Type="Microsoft.OData.SampleService.Models.TripPin.Airport"/>
        <NavigationProperty Name="To"      Type="Microsoft.OData.SampleService.Models.TripPin.Airport"/>
      </EntityType>
      <EntityType Name="Event" BaseType="Microsoft.OData.SampleService.Models.TripPin.PlanItem" OpenType="true">
        <Property Name="Description" Type="Edm.String"/>
        <Property Name="OccursAt"    Type="Microsoft.OData.SampleService.Models.TripPin.EventLocation" Nullable="false"/>
      </EntityType>
      <EntityType Name="Trip">
        <Key><PropertyRef Name="TripId"/></Key>
        <Property Name="TripId"      Type="Edm.Int32"           Nullable="false"/>
        <Property Name="ShareId"     Type="Edm.Guid"            Nullable="false"/>
        <Property Name="Description" Type="Edm.String"/>
        <Property Name="Name"        Type="Edm.String"          Nullable="false"/>
        <Property Name="Budget"      Type="Edm.Single"          Nullable="false"/>
        <Property Name="StartsAt"    Type="Edm.DateTimeOffset"  Nullable="false"/>
        <Property Name="EndsAt"      Type="Edm.DateTimeOffset"  Nullable="false"/>
        <Property Name="Tags"        Type="Collection(Edm.String)" Nullable="false"/>
        <NavigationProperty Name="Photos"    Type="Collection(Microsoft.OData.SampleService.Models.TripPin.Photo)"/>
        <NavigationProperty Name="PlanItems" Type="Collection(Microsoft.OData.SampleService.Models.TripPin.PlanItem)"/>
      </EntityType>
      <Action Name="ResetDataSource" IsBound="false"/>
      <Action Name="ShareTrip" IsBound="true">
        <Parameter Name="bindingParameter" Type="Microsoft.OData.SampleService.Models.TripPin.Person"/>
        <Parameter Name="userName"         Type="Edm.String"  Nullable="false"/>
        <Parameter Name="tripId"           Type="Edm.Int32"   Nullable="false"/>
      </Action>
      <Function Name="GetFavoriteAirline" IsBound="true" IsComposable="false">
        <Parameter Name="bindingParameter" Type="Microsoft.OData.SampleService.Models.TripPin.Person" Nullable="false"/>
        <ReturnType Type="Microsoft.OData.SampleService.Models.TripPin.Airline" Nullable="false"/>
      </Function>
      <Function Name="GetInvolvedPeople" IsBound="true" IsComposable="false">
        <Parameter Name="bindingParameter" Type="Microsoft.OData.SampleService.Models.TripPin.Trip" Nullable="false"/>
        <ReturnType Type="Collection(Microsoft.OData.SampleService.Models.TripPin.Person)" Nullable="false"/>
      </Function>
      <Function Name="GetFriendsTrips" IsBound="true" IsComposable="false">
        <Parameter Name="bindingParameter" Type="Microsoft.OData.SampleService.Models.TripPin.Person" Nullable="false"/>
        <Parameter Name="userName"         Type="Edm.String" Nullable="false"/>
        <ReturnType Type="Collection(Microsoft.OData.SampleService.Models.TripPin.Trip)" Nullable="false"/>
      </Function>
      <Function Name="GetNearestAirport" IsBound="false" IsComposable="false">
        <Parameter Name="lat" Type="Edm.Double" Nullable="false"/>
        <Parameter Name="lon" Type="Edm.Double" Nullable="false"/>
        <ReturnType Type="Microsoft.OData.SampleService.Models.TripPin.Airport" Nullable="false"/>
      </Function>
      <EntityContainer Name="DefaultContainer">
        <EntitySet Name="Photos"   EntityType="Microsoft.OData.SampleService.Models.TripPin.Photo"/>
        <EntitySet Name="People"   EntityType="Microsoft.OData.SampleService.Models.TripPin.Person">
          <NavigationPropertyBinding Path="Friends" Target="People"/>
          <NavigationPropertyBinding Path="Trips"   Target="Trips" />
          <NavigationPropertyBinding Path="Photo"   Target="Photos"/>
        </EntitySet>
        <EntitySet Name="Airlines" EntityType="Microsoft.OData.SampleService.Models.TripPin.Airline"/>
        <EntitySet Name="Airports" EntityType="Microsoft.OData.SampleService.Models.TripPin.Airport"/>
        <Singleton  Name="Me"      Type="Microsoft.OData.SampleService.Models.TripPin.Person">
          <NavigationPropertyBinding Path="Friends" Target="People"/>
          <NavigationPropertyBinding Path="Trips"   Target="Trips"/>
          <NavigationPropertyBinding Path="Photo"   Target="Photos"/>
        </Singleton>
        <FunctionImport Name="GetNearestAirport" Function="Microsoft.OData.SampleService.Models.TripPin.GetNearestAirport" EntitySet="Airports"/>
        <ActionImport  Name="ResetDataSource"    Action="Microsoft.OData.SampleService.Models.TripPin.ResetDataSource"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

---

### `webapp/test/integration/NavigationJourney.ts`

```typescript
/*global QUnit*/
import opaTest from "sap/ui/test/opaQunit";
import AppPage from "./pages/AppPage";
import ViewPage from "./pages/View1Page";

import Opa5 from "sap/ui/test/Opa5";

QUnit.module("Navigation Journey");

const onTheAppPage = new AppPage();
const onTheViewPage = new ViewPage();
Opa5.extendConfig({
    viewNamespace: "com.intent2app.sample.view.",
    autoWait: true
});

opaTest("Should see the initial page of the app", function () {
    // Arrangements
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    onTheAppPage.iStartMyUIComponent({
        componentConfig: {
            name: "com.intent2app.sample"
        }
    });

    // Assertions
    onTheAppPage.iShouldSeeTheApp();
    onTheViewPage.iShouldSeeThePageView();

    // Cleanup
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    onTheAppPage.iTeardownMyApp();
});
```

---

### `webapp/test/integration/opaTests.qunit.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Integration tests for Basic Template</title>

    <script
        id="sap-ui-bootstrap"
        src="../../resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resource-roots='{
            "com.intent2app.sample": "../../",
            "integration": "./"
        }'
        data-sap-ui-animation-mode="none"
        data-sap-ui-compat-version="edge"
        data-sap-ui-async="true"
        data-sap-ui-preload="async">
    </script>
    <link rel="stylesheet" type="text/css" href="../../resources/sap/ui/thirdparty/qunit-2.css">
    <script src="../../resources/sap/ui/thirdparty/qunit-2.js"></script>
    <script src="../../resources/sap/ui/qunit/qunit-junit.js"></script>
    <script src="opaTests.qunit.js"></script>
</head>
<body>
    <div id="qunit"></div>
    <div id="qunit-fixture"></div>
</body>
</html>
```

---

### `webapp/test/integration/opaTests.qunit.ts`

```typescript
/* global QUnit */
sap.ui.require(["integration/NavigationJourney"
], function () {
    QUnit.config.autostart = false;
    QUnit.start();
});
```

---

### `webapp/test/integration/pages/AppPage.ts`

```typescript
import Opa5 from "sap/ui/test/Opa5";

const sViewName = "App";

export default class AppPage extends Opa5 {
    // Actions

    // Assertions
    iShouldSeeTheApp() {
        return this.waitFor({
            id: "app",
            viewName: sViewName,
            success: function () {
                Opa5.assert.ok(true, "The " + sViewName + " view is displayed");
            },
            errorMessage: "Did not find the " + sViewName + " view"
        });
    }
}
```

---

### `webapp/test/integration/pages/View1Page.ts`

```typescript
import Opa5 from "sap/ui/test/Opa5";

const sViewName = "View1";

export default class View1Page extends Opa5 {
    // Actions

    // Assertions
    iShouldSeeThePageView() {
        return this.waitFor({
            id: "page",
            viewName: sViewName,
            success: function () {
                Opa5.assert.ok(true, "The " + sViewName + " view is displayed");
            },
            errorMessage: "Did not find the " + sViewName + " view"
        });
    }
}
```

---

### `webapp/test/unit/unitTests.qunit.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Unit tests for com.intent2app.sample</title>
    <script
        id="sap-ui-bootstrap"
        src="../../resources/sap-ui-core.js"
        data-sap-ui-resource-roots='{
            "com.intent2app.sample": "../../",
            "unit": "."
        }'
        data-sap-ui-async="true"
        data-sap-ui-compat-version="edge">
    </script>
    <link rel="stylesheet" type="text/css" href="../../resources/sap/ui/thirdparty/qunit-2.css">
    <script src="../../resources/sap/ui/thirdparty/qunit-2.js"></script>
    <script src="../../resources/sap/ui/qunit/qunit-junit.js"></script>
    <script src="../../resources/sap/ui/qunit/qunit-coverage.js"></script>
    <script src="../../resources/sap/ui/thirdparty/sinon.js"></script>
    <script src="../../resources/sap/ui/thirdparty/sinon-qunit.js"></script>
    <script src="unitTests.qunit.js"></script>
</head>
<body>
    <div id="qunit"></div>
    <div id="qunit-fixture"></div>
</body>
</html>
```

---

### `webapp/test/unit/unitTests.qunit.ts`

```typescript
/* @sapUiRequire */
QUnit.config.autostart = false;

// import all your QUnit tests here
void Promise.all([
    import("sap/ui/core/Core"),
    import("unit/controller/View1Page.controller")
]).then(([{default: Core}]) => Core.ready()).then(() => {
    QUnit.start();
});
```

---

### `webapp/test/unit/controller/View1Page.controller.ts`

```typescript
/*global QUnit*/
import Controller from "com.intent2app.sample/controller/View1.controller";

QUnit.module("View1 Controller");

QUnit.test("I should test the View1 controller", function (assert: Assert) {
    const oAppController = new Controller("View1");
    oAppController.onInit();
    assert.ok(oAppController);
});
```

---

### `webapp/test/testsuite.qunit.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <title>QUnit test suite</title>
    <script src="../resources/sap/ui/qunit/qunit-redirect.js"></script>
    <script src="testsuite.qunit.js" data-sap-ui-testsuite></script>
  </head>
  <body></body>
</html>
```

---

### `webapp/test/testsuite.qunit.ts`

```typescript
/* global window, parent, location */

// @ts-nocheck
window.suite = function() {
    // eslint-disable-next-line
    var oSuite = new parent.jsUnitTestSuite(),
        sContextPath = location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);

    oSuite.addTestPage(sContextPath + "unit/unitTests.qunit.html");
    oSuite.addTestPage(sContextPath + "integration/opaTests.qunit.html");

    return oSuite;
};
```

---

## Runtime Behaviour

| Mode | Command | Backend | TypeScript |
| --- | --- | --- | --- |
| Mock (offline) | `npm run start:mock` | `sap-fe-mockserver` | transpiled on-the-fly |
| Proxy (real backend) | `npm run start:proxy` | live OData service | transpiled on-the-fly |
| Local framework | `npm run start-local` | `sap-fe-mockserver` + local UI5 libs | transpiled on-the-fly |
| Production build | `npm run build` | N/A — static `dist/` | compiled by transpile-task |
| Unit tests | `npm run unit-test` | mock server | transpiled on-the-fly |
| OPA5 tests | `npm run int-test` | mock server | transpiled on-the-fly |

## TypeScript → UI5 AMD Flow

```text
webapp/Component.ts  (ES class + ES import)
  ↓  ui5-tooling-transpile-middleware (dev) / ui5-tooling-transpile-task (build)
Component.js  (AMD: sap.ui.define([...], function(...) { ... }))
  ↓  UI5 module loader
runtime: com.intent2app.sample.Component
```

The `@namespace` JSDoc tag on each class drives the AMD module path. Without it, the transpiler cannot generate `sap.ui.define(["com/intent2app/sample/Component"], ...)` correctly.
