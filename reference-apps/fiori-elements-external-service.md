# Reference App: `fiori-elements-external-service`

**Type:** Fiori Elements — List Report + Object Page bound to an External / RAP OData V4 Service  
**Purpose:** Frontend-only Fiori Elements app consuming an existing OData V4 service (ABAP RAP, S/4HANA API, or any 3rd-party endpoint). Ships with a sample `Products` EDMX, local UI annotations in XML, 4 mock records with criticality colouring, offline mock server, and proxy-to-backend mode.  
**Run (offline):** `npm install && npm run start:mock`  
**Run (real backend):** `npm run start:proxy`

---

## Project Structure

```text
fiori-elements-external-service/
├── package.json
├── eslint.config.mjs
├── ui5.yaml
├── ui5-mock.yaml
└── webapp/
    ├── Component.js
    ├── manifest.json
    ├── index.html
    ├── annotations/
    │   └── annotation.xml
    ├── i18n/
    │   └── i18n.properties
    └── localService/
        └── mainService/
            ├── metadata.xml
            └── data/
                └── Products.json
```

---

## File Contents

### `package.json`

```json
{
  "name": "intent2app-fiori-elements-external-service",
  "version": "1.0.0",
  "description": "Intent2App reference starter — Fiori Elements bound to an external/RAP OData service via EDMX, with an offline mock and proxy-to-backend.",
  "keywords": ["ui5", "sapui5", "fiori-elements", "odata"],
  "main": "webapp/index.html",
  "dependencies": {},
  "devDependencies": {
    "@ui5/cli": "^4.0.33",
    "@sap/ux-ui5-tooling": "1",
    "@sap-ux/eslint-plugin-fiori-tools": "^9.0.0",
    "eslint": "^9",
    "@sapui5/types": "~1.146.0",
    "@sap-ux/ui5-middleware-fe-mockserver": "2"
  },
  "scripts": {
    "start":       "fiori run --config ./ui5-mock.yaml --open \"index.html\"",
    "start:mock":  "fiori run --config ./ui5-mock.yaml --open \"index.html\"",
    "start:proxy": "fiori run --config ./ui5.yaml --open \"index.html\"",
    "build":       "ui5 build --config=ui5.yaml --clean-dest --dest dist",
    "lint":        "eslint ./"
  },
  "sapuxLayer": "CUSTOMER_BASE"
}
```

Default `start` runs mock mode — safe for new developers with no backend access. No TypeScript tooling — this is a JavaScript Fiori Elements app.

---

### `eslint.config.mjs`

```js
import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    ...fioriTools.configs.recommended
];
```

---

### `ui5.yaml` (proxy run — `npm run start:proxy`)

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json
# Real-backend run (npm run start:proxy). Set the backend url/destination via
# mcp__intent2app__configure_service. In BAS, replace `url` with `destination: <NAME>`.
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
          - path: /odata/v4/external
            url: https://REPLACE-WITH-BACKEND-HOST   # or: destination: <DESTINATION_NAME> (BAS)
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

`path: /odata/v4/external` must match the `dataSource uri` in `manifest.json`. In SAP BAS replace `url:` with `destination: <DESTINATION_NAME>`.

---

### `ui5-mock.yaml` (offline mock — `npm run start:mock` / default `npm start`)

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json
# Offline run (npm run start:mock) — sap-fe-mockserver serves the service from the local EDMX + data.
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
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /odata/v4/external
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: true
        annotations: []
```

`urlPath` must match the `dataSource uri` in `manifest.json`. `generateMockData: true` auto-generates data for entity sets with no JSON file in `mockdataPath`.

---

### `webapp/Component.js`

```js
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
    "use strict";

    return AppComponent.extend("com.intent2app.sample.Component", {
        metadata: { manifest: "json" }
    });
});
```

Extends `sap/fe/core/AppComponent` — Fiori Elements handles routing, OData model wiring, and draft lifecycle.

---

### `webapp/manifest.json`

```json
{
  "_version": "1.59.0",
  "sap.app": {
    "id": "com.intent2app.sample",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "applicationVersion": { "version": "1.0.0" },
    "dataSources": {
      "mainService": {
        "uri": "/odata/v4/external/",
        "type": "OData",
        "settings": {
          "odataVersion": "4.0",
          "localUri": "localService/mainService/metadata.xml",
          "annotations": ["localAnnotations"]
        }
      },
      "localAnnotations": {
        "type": "ODataAnnotation",
        "uri": "annotations/annotation.xml",
        "settings": { "localUri": "annotations/annotation.xml" }
      }
    }
  },
  "sap.ui": {
    "technology": "UI5",
    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
  },
  "sap.ui5": {
    "flexEnabled": true,
    "contentDensities": { "compact": true, "cozy": true },
    "dependencies": {
      "minUI5Version": "1.136.0",
      "libs": {
        "sap.ui.core": {},
        "sap.m": {},
        "sap.fe.core": {},
        "sap.fe.templates": {},
        "sap.fe.macros": {},
        "sap.uxap": {},
        "sap.ui.layout": {}
      }
    },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": { "bundleName": "com.intent2app.sample.i18n.i18n" }
      },
      "": {
        "dataSource": "mainService",
        "type": "sap.ui.model.odata.v4.ODataModel",
        "settings": {
          "operationMode": "Server",
          "autoExpandSelect": true,
          "earlyRequests": true,
          "groupId": "$auto",
          "updateGroupId": "$auto"
        }
      }
    },
    "routing": {
      "routes": [
        { "name": "ProductsList",       "pattern": ":?query:",               "target": "ProductsList"       },
        { "name": "ProductsObjectPage", "pattern": "Products({key}):?query:", "target": "ProductsObjectPage" }
      ],
      "targets": {
        "ProductsList": {
          "type": "Component",
          "id": "ProductsList",
          "name": "sap.fe.templates.ListReport",
          "options": {
            "settings": {
              "contextPath": "/Products",
              "variantManagement": "Page",
              "initialLoad": "Enabled",
              "navigation": { "Products": { "detail": { "route": "ProductsObjectPage" } } }
            }
          }
        },
        "ProductsObjectPage": {
          "type": "Component",
          "id": "ProductsObjectPage",
          "name": "sap.fe.templates.ObjectPage",
          "options": {
            "settings": {
              "contextPath": "/Products",
              "editableHeaderContent": false
            }
          }
        }
      }
    }
  }
}
```

`localUri` points the OData model to the local EDMX for offline validation and IDE completion. `annotations: ["localAnnotations"]` instructs the OData model to merge `annotation.xml` with the service metadata. `initialLoad: "Enabled"` auto-loads data on first render — only suitable when the default filter yields a manageable result set.

---

### `webapp/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>External Service App</title>
    <style>
        html, body, body > div, #container, #container-uiarea { height: 100%; }
    </style>
    <script
        id="sap-ui-bootstrap"
        src="resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resource-roots='{"com.intent2app.sample": "./"}'
        data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
        data-sap-ui-compat-version="edge"
        data-sap-ui-async="true"
        data-sap-ui-frame-options="trusted">
    </script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content">
    <div
        data-sap-ui-component
        data-name="com.intent2app.sample"
        data-id="container"
        data-settings='{"id": "com.intent2app.sample"}'>
    </div>
</body>
</html>
```

Loads UI5 from `resources/sap-ui-core.js` (served by the UI5 tooling dev server).

---

### `webapp/i18n/i18n.properties`

```properties
appTitle=Products
appDescription=Fiori Elements app bound to an external (RAP / existing) OData service.
```

---

### `webapp/annotations/annotation.xml`

Local UI annotation overlay in OData XML Annotation format. Defines the full Fiori Elements UI structure for the `ExternalService.Product` entity.

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- LOCAL UI annotations for the external service. For RAP, prefer backend CDS metadata-extension
     annotations (Clean Core); use this local file only for app-specific UI. Criticality enum:
     0 Neutral, 1 Negative, 2 Critical, 3 Positive. -->
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
    <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
  </edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml">
    <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
  </edmx:Reference>
  <edmx:DataServices>
    <Schema Namespace="local" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Annotations Target="ExternalService.Product">

        <Annotation Term="UI.HeaderInfo">
          <Record>
            <PropertyValue Property="TypeName" String="Product"/>
            <PropertyValue Property="TypeNamePlural" String="Products"/>
            <PropertyValue Property="Title">
              <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Name"/></Record>
            </PropertyValue>
            <PropertyValue Property="Description">
              <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Category"/></Record>
            </PropertyValue>
          </Record>
        </Annotation>

        <Annotation Term="UI.DataPoint" Qualifier="StatusDP">
          <Record>
            <PropertyValue Property="Value" Path="Status"/>
            <PropertyValue Property="Criticality" Path="StatusCriticality"/>
            <PropertyValue Property="CriticalityRepresentation" EnumMember="UI.CriticalityRepresentationType/WithIcon"/>
          </Record>
        </Annotation>

        <Annotation Term="UI.SelectionFields">
          <Collection>
            <PropertyPath>Status</PropertyPath>
            <PropertyPath>Category</PropertyPath>
          </Collection>
        </Annotation>

        <Annotation Term="UI.LineItem">
          <Collection>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Name"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Category"/></Record>
            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="UnitPrice"/></Record>
            <Record Type="UI.DataFieldForAnnotation">
              <PropertyValue Property="Target" AnnotationPath="@UI.DataPoint#StatusDP"/>
              <PropertyValue Property="Label" String="Status"/>
            </Record>
          </Collection>
        </Annotation>

        <Annotation Term="UI.FieldGroup" Qualifier="Main">
          <Record>
            <PropertyValue Property="Data">
              <Collection>
                <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Name"/></Record>
                <Record Type="UI.DataField"><PropertyValue Property="Value" Path="Category"/></Record>
                <Record Type="UI.DataField"><PropertyValue Property="Value" Path="UnitPrice"/></Record>
                <Record Type="UI.DataFieldForAnnotation">
                  <PropertyValue Property="Target" AnnotationPath="@UI.DataPoint#StatusDP"/>
                  <PropertyValue Property="Label" String="Status"/>
                </Record>
              </Collection>
            </PropertyValue>
          </Record>
        </Annotation>

        <Annotation Term="UI.Facets">
          <Collection>
            <Record Type="UI.ReferenceFacet">
              <PropertyValue Property="Label" String="General Information"/>
              <PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#Main"/>
            </Record>
          </Collection>
        </Annotation>

      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

**Annotation → UI effect mapping:**

| Annotation | Effect |
| --- | --- |
| `UI.HeaderInfo` | Object Page header — title = `Name`, description = `Category` |
| `UI.DataPoint#StatusDP` | Maps `Status` string to a semantic icon via integer `StatusCriticality` |
| `UI.SelectionFields` | Adds `Status` and `Category` to the List Report filter bar |
| `UI.LineItem` | 4 List Report table columns; Status column uses the DataPoint icon |
| `UI.FieldGroup#Main` | Groups the same 4 fields for the Object Page body |
| `UI.Facets` | Creates one Object Page section pointing to `FieldGroup#Main` |

**Criticality integer scale:**

| Value | Colour | Meaning |
| --- | --- | --- |
| 0 | Grey | Neutral / Draft |
| 1 | Red | Negative / Rejected |
| 2 | Orange | Critical / Submitted |
| 3 | Green | Positive / Approved |

---

### `webapp/localService/mainService/metadata.xml`

Sample OData V4 EDMX for a `Products` entity. Replace with the real service's `$metadata` when adapting. Use `mcp__intent2app__gen_mock_from_edmx` to generate mock data files from a downloaded EDMX.

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Sample OData V4 $metadata for the external-service starter. Replace with the real service
     EDMX (e.g. from a RAP service) using mcp__intent2app__gen_mock_from_edmx. -->
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="ExternalService" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Product">
        <Key>
          <PropertyRef Name="ID"/>
        </Key>
        <Property Name="ID"                Type="Edm.Int32"   Nullable="false"/>
        <Property Name="Name"              Type="Edm.String"  MaxLength="100"/>
        <Property Name="Category"          Type="Edm.String"  MaxLength="40"/>
        <Property Name="UnitPrice"         Type="Edm.Decimal" Precision="15" Scale="2"/>
        <Property Name="Status"            Type="Edm.String"  MaxLength="20"/>
        <Property Name="StatusCriticality" Type="Edm.Int32"/>
      </EntityType>
      <EntityContainer Name="Container">
        <EntitySet Name="Products" EntityType="ExternalService.Product"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

---

### `webapp/localService/mainService/data/Products.json`

4 sample records covering all four criticality states so every semantic colour is visible immediately on startup.

```json
[
  { "ID": 1, "Name": "Widget",   "Category": "Hardware", "UnitPrice": 19.99, "Status": "APPROVED",  "StatusCriticality": 3 },
  { "ID": 2, "Name": "Gadget",   "Category": "Hardware", "UnitPrice": 49.50, "Status": "SUBMITTED", "StatusCriticality": 2 },
  { "ID": 3, "Name": "Gizmo",    "Category": "Software", "UnitPrice": 99.00, "Status": "REJECTED",  "StatusCriticality": 1 },
  { "ID": 4, "Name": "Sprocket", "Category": "Hardware", "UnitPrice":  5.00, "Status": "DRAFT",     "StatusCriticality": 0 }
]
```

---

## Adapting to a Real Service

1. Download the EDMX from `<backend-url>/$metadata` or use `mcp__intent2app__fiori_download_odata_metadata`
2. Replace `webapp/localService/mainService/metadata.xml` with the downloaded EDMX
3. Generate mock data with `mcp__intent2app__gen_mock_from_edmx` — produces `<EntitySet>.json` in `data/`
4. Update `manifest.json` — change `contextPath` to the real entity set name; update route patterns
5. Update `annotation.xml` — replace `ExternalService.Product` with the real entity type and namespace
6. Update `ui5.yaml` — set `url` (or `destination`) to the real backend host; update `path` if the service base path differs from `/odata/v4/external`
7. Update `ui5-mock.yaml` — update `urlPath` to match the new `dataSource uri`

---

## Runtime Behaviour

| Mode | Command | Backend |
| --- | --- | --- |
| Mock (offline, default) | `npm run start:mock` or `npm start` | `sap-fe-mockserver` — `Products.json` (4 records) |
| Proxy (real backend) | `npm run start:proxy` | live OData service — replace URL in `ui5.yaml` |
| Production build | `npm run build` | N/A — static assets in `dist/` |
