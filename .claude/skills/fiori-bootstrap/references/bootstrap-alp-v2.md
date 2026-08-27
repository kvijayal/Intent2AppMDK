*Part of the fiori-bootstrap skill.*

> Full file-by-file walkthrough for an **Analytical List Page V2** — OData **V2**, `sap.suite.ui.generic.template.AnalyticalListPage`. This is a **different template family** from the Intent2App V4 Fiori Elements ALP. For the V4 `sap.fe.templates.AnalyticalListPage` config, see [`analytical-list-page.md`](analytical-list-page.md).

# SAP UI5 Analytical List Page (ALP) — Bootstrapping Guide

> This document is a training reference for generating a SAP Fiori Elements **Analytical List Page (ALP) V2** application. It captures every bootstrapping file with its exact structure, all configurable fields, and the rules that must be followed to avoid startup failures. Any future ALP app with a similar requirement can be generated using this guide.

---

## Required Bootstrapping Files

| # | File Path | Purpose |
|---|---|---|
| 1 | `package.json` | Node project — declares dev tool dependencies and npm start scripts |
| 2 | `webapp/index.html` | Browser entry point — loads SAPUI5 and triggers component instantiation |
| 3 | `webapp/Component.js` | Application component — connects the app namespace to the Fiori Elements base |
| 4 | `webapp/manifest.json` | Application descriptor — OData source, libraries, models, and ALP page config |
| 5 | `webapp/i18n/i18n.properties` | Translation bundle — required by `manifest.json` to resolve app title and description |
| 6 | `webapp/annotations/annotation.xml` | UI annotations — drives Filter Bar, Chart, and Table rendering in the ALP page |

---

## File 1: `package.json`

### Purpose
Declares the Node.js project and the dev tool packages required to run and build the app. The `scripts` section provides the commands used to launch the app in mock or local mode.

### File Content
```json
{
  "name": "salesorderanalysis",
  "version": "0.0.1",
  "description": "An SAP Fiori application.",
  "keywords": [
    "ui5",
    "openui5",
    "sapui5"
  ],
  "main": "webapp/index.html",
  "dependencies": {},
  "devDependencies": {
    "@ui5/cli": "^4.0.33",
    "@sap/ux-ui5-tooling": "1",
    "@sap-ux/eslint-plugin-fiori-tools": "^10.0.0",
    "eslint": "^10",
    "@sap-ux/ui5-middleware-fe-mockserver": "2"
  },
  "scripts": {
    "start": "echo \"No live server configured. Use npm run start-mock.\"",
    "start-local": "fiori run --config ./ui5-local.yaml --open \"test/flp.html#app-preview\"",
    "start-mock": "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",
    "build": "ui5 build --config=ui5.yaml --clean-dest --dest dist",
    "lint": "eslint ./",
    "deploy": "fiori verify",
    "deploy-config": "fiori add deploy-config"
  },
  "sapuxLayer": "CUSTOMER_BASE",
  "sapux": true
}
```

### Configurable Fields

| Field | Description | Value in This Project |
|---|---|---|
| `name` | Lowercase, hyphenated app name | `salesorderanalysis` |
| `description` | Short description of the app | `An SAP Fiori application.` |
| `sapuxLayer` | SAP extensibility layer | `CUSTOMER_BASE` for customer apps |

### Dev Dependencies Explained

| Package | Purpose |
|---|---|
| `@ui5/cli` | Provides the `ui5 build` command for production builds |
| `@sap/ux-ui5-tooling` | Provides the `fiori run` command and middleware: `fiori-tools-proxy`, `fiori-tools-preview`, `fiori-tools-appreload` |
| `@sap-ux/ui5-middleware-fe-mockserver` | Intercepts OData requests and auto-generates responses from `metadata.xml` |
| `eslint` + `@sap-ux/eslint-plugin-fiori-tools` | Code linting with SAP Fiori Tools rules |

### npm Scripts

| Script | What It Does |
|---|---|
| `start-mock` | Starts the app with auto-generated mock data; UI5 loaded from CDN (`ui5.sap.com`) |
| `start-local` | Starts the app with mock data; UI5 loaded from a locally installed SAPUI5 npm package |
| `build` | Builds the app for production into the `dist/` folder |

> **Note:** `test/flp.html` does not exist as a file. It is dynamically generated and served by the `fiori-tools-preview` middleware to simulate a Fiori Launchpad shell environment.

---

## File 2: `webapp/index.html`

### Purpose
The browser's single entry point. The `<script id="sap-ui-bootstrap">` tag loads the SAPUI5 core library and passes framework configuration via `data-sap-ui-*` attributes. After UI5 loads, the `ComponentSupport` module (set via `data-sap-ui-on-init`) scans the DOM, finds the `<div data-sap-ui-component>` element, and instantiates the application component.

### File Content
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
            "com.demo.alp.salesorderanalysis": "./"
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
        data-name="com.demo.alp.salesorderanalysis"
        data-id="container"
        data-settings='{"id" : "com.demo.alp.salesorderanalysis"}'
        data-handle-validation="true"
    ></div>
</body>
</html>
```

### Configurable Fields

| Attribute | Description | Configurable? |
|---|---|---|
| `src="resources/sap-ui-core.js"` | Path to the SAPUI5 core — served by middleware at runtime, never a physical file in the project | Fixed |
| `data-sap-ui-theme` | SAPUI5 visual theme applied to the app | **Yes** — `sap_horizon` (default), `sap_fiori_3` |
| `data-sap-ui-resource-roots` (key) | Maps the app namespace to its root path `"./"` | **Yes** — key must match `sap.app.id` in `manifest.json` |
| `data-sap-ui-on-init` | Module invoked after UI5 loads | Fixed — always `module:sap/ui/core/ComponentSupport` |
| `data-sap-ui-compat-version` | UI5 compatibility mode | Fixed — always `edge` for new apps |
| `data-sap-ui-async` | Enables asynchronous module loading | Fixed — always `true` |
| `data-sap-ui-frame-options` | Controls iFrame embedding security | Fixed — `trusted` allows the app to be embedded inside FLP |
| `data-name` on `<div>` | The component namespace to instantiate | **Yes** — must match `sap.app.id` in `manifest.json` |
| `data-settings` on `<div>` — `"id"` | ID passed to the component constructor | **Yes** — must match `sap.app.id` in `manifest.json` |
| `data-handle-validation` on `<div>` | Enables automatic input validation handling | Fixed — always `true` |

### Rule: Namespace Must Be Identical in Three Places Within `index.html`
```
data-sap-ui-resource-roots key  →  "<YOUR_APP_NAMESPACE>": "./"
data-name                       →  data-name="<YOUR_APP_NAMESPACE>"
data-settings id                →  data-settings='{"id" : "<YOUR_APP_NAMESPACE>"}'
```
All three must carry the same namespace string, and that string must also match `sap.app.id` in `manifest.json`. A mismatch prevents the component from loading.

---

## File 3: `webapp/Component.js`

### Purpose
The application component class. UI5's `ComponentSupport` module instantiates this class when it reads the `data-name` attribute in `index.html`. The component extends `sap/suite/ui/generic/template/lib/AppComponent` — the Fiori Elements V2 base component — which reads `manifest.json` and handles all framework wiring: OData model creation, routing, shell integration, and ALP page rendering. No custom logic is needed here.

### File Content
```javascript
sap.ui.define(
    ["sap/suite/ui/generic/template/lib/AppComponent"],
    function (Component) {
        "use strict";

        return Component.extend("com.demo.alp.salesorderanalysis.Component", {
            metadata: {
                manifest: "json"
            }
        });
    }
);
```

### Configurable Fields

| Field | Description | Configurable? |
|---|---|---|
| `"sap/suite/ui/generic/template/lib/AppComponent"` | The Fiori Elements V2 base component to extend | Fixed — always this module for ALP V2 |
| `Component.extend("com.demo.alp.salesorderanalysis.Component", ...)` | Fully qualified component class name | **Yes** — format is `<APP_NAMESPACE>.Component` |
| `manifest: "json"` | Instructs UI5 to read `manifest.json` from the same directory | Fixed — always `"json"` |

### Rule: Component Class Name Format
The string passed to `Component.extend()` must follow this format:
```
<APP_NAMESPACE>.Component
```
For example: `com.demo.alp.salesorderanalysis.Component`

The `<APP_NAMESPACE>` part must exactly match `sap.app.id` in `manifest.json`.

---

## File 4: `webapp/manifest.json`

### Purpose
The application descriptor — the central configuration file. The `AppComponent` base class reads this file during startup to create the OData model, load annotations, initialize the i18n model, and configure the ALP page structure. In Fiori Elements ALP, this file replaces custom views, controllers, and routing code entirely.

### File Content
```json
{
  "_version": "1.73.1",
  "sap.app": {
    "id": "com.demo.alp.salesorderanalysis",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "applicationVersion": {
      "version": "0.0.1"
    },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "resources": "resources.json",
    "sourceTemplate": {
      "id": "@sap/generator-fiori:alp",
      "version": "1.28.0",
      "toolsId": "c43cb0f8-1e79-4676-a41d-c0a49dc518e7"
    },
    "dataSources": {
      "annotation": {
        "type": "ODataAnnotation",
        "uri": "annotations/annotation.xml",
        "settings": {
          "localUri": "annotations/annotation.xml"
        }
      },
      "mainService": {
        "uri": "/here/goes/your/serviceurl/",
        "type": "OData",
        "settings": {
          "annotations": [
            "annotation"
          ],
          "localUri": "localService/mainService/metadata.xml",
          "odataVersion": "2.0"
        }
      }
    }
  },
  "sap.ui": {
    "technology": "UI5",
    "icons": {
      "icon": "",
      "favIcon": "",
      "phone": "",
      "phone@2": "",
      "tablet": "",
      "tablet@2": ""
    },
    "deviceTypes": {
      "desktop": true,
      "tablet": true,
      "phone": true
    }
  },
  "sap.ui5": {
    "flexEnabled": true,
    "dependencies": {
      "minUI5Version": "1.136.14",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {},
        "sap.ushell": {},
        "sap.f": {},
        "sap.ui.comp": {},
        "sap.ui.generic.app": {},
        "sap.suite.ui.generic.template": {}
      }
    },
    "contentDensities": {
      "compact": true,
      "cozy": true
    },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "com.demo.alp.salesorderanalysis.i18n.i18n"
        }
      },
      "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
          "defaultBindingMode": "TwoWay",
          "defaultCountMode": "Inline",
          "refreshAfterChange": false,
          "metadataUrlParams": {
            "sap-value-list": "none"
          }
        }
      },
      "@i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "uri": "i18n/i18n.properties"
      }
    },
    "resources": {
      "css": []
    },
    "routing": {
      "config": {},
      "routes": [],
      "targets": {}
    }
  },
  "sap.ui.generic.app": {
    "_version": "1.3.0",
    "settings": {
      "forceGlobalRefresh": false,
      "objectPageHeaderType": "Dynamic",
      "considerAnalyticalParameters": true,
      "showDraftToggle": false
    },
    "pages": {
      "AnalyticalListPage|Z_SEPMRA_SO_SALESORDERANALYSIS": {
        "entitySet": "Z_SEPMRA_SO_SALESORDERANALYSIS",
        "component": {
          "name": "sap.suite.ui.generic.template.AnalyticalListPage",
          "list": true,
          "settings": {
            "condensedTableLayout": true,
            "showGoButtonOnFilterBar": true,
            "autoHide": true,
            "smartVariantManagement": false,
            "tableSettings": {
              "multiSelect": false,
              "type": "AnalyticalTable"
            },
            "keyPerformanceIndicators": {},
            "chartSettings": {
              "showDataLabel": true
            },
            "filterSettings": {
              "dateSettings": {
                "useDateRange": true
              }
            }
          }
        },
        "pages": {
          "ObjectPage|Z_SEPMRA_SO_SALESORDERANALYSIS": {
            "entitySet": "Z_SEPMRA_SO_SALESORDERANALYSIS",
            "defaultLayoutTypeIfExternalNavigation": "MidColumnFullScreen",
            "component": {
              "name": "sap.suite.ui.generic.template.ObjectPage"
            }
          }
        }
      }
    }
  },
  "sap.fiori": {
    "registrationIds": [],
    "archeType": "analytical"
  }
}
```

### Configurable Fields — `sap.app` Section

| Field | Description | Value in This Project |
|---|---|---|
| `id` | Unique app namespace — must match `index.html` and `Component.js` | `com.demo.alp.salesorderanalysis` |
| `title` | App title — resolved from `i18n.properties` via `{{appTitle}}` token | `{{appTitle}}` |
| `description` | App description — resolved from `i18n.properties` via `{{appDescription}}` | `{{appDescription}}` |
| `dataSources.mainService.uri` | OData V2 service URL path on the backend | `/here/goes/your/serviceurl/` |
| `dataSources.mainService.settings.odataVersion` | OData protocol version | `2.0` — fixed for ALP V2 template |
| `dataSources.annotation.uri` | Path to the local annotation file | `annotations/annotation.xml` |

### Configurable Fields — `sap.ui5` Section

| Field | Description | Value in This Project |
|---|---|---|
| `flexEnabled` | Enables UI Adaptation and key user personalization | `true` |
| `dependencies.minUI5Version` | Minimum SAPUI5 version | `1.136.14` |
| `models[""].settings.defaultBindingMode` | OData model binding mode | `TwoWay` — use `OneWay` for read-only scenarios |
| `models.i18n.settings.bundleName` | Full dotted path to the i18n resource bundle | `com.demo.alp.salesorderanalysis.i18n.i18n` |
| `routing` | Route and target definitions | Left empty — the generic template handles routing |

### Required Libraries in `sap.ui5.dependencies.libs`

All seven libraries below are mandatory for an ALP V2 app:

| Library | What It Provides |
|---|---|
| `sap.m` | Core UI controls: buttons, inputs, layouts |
| `sap.ui.core` | SAPUI5 framework core |
| `sap.ushell` | Fiori Launchpad shell integration |
| `sap.f` | Flexible Column Layout |
| `sap.ui.comp` | SmartTable, SmartFilterBar, SmartChart (the three ALP controls) |
| `sap.ui.generic.app` | Generic app framework base layer |
| `sap.suite.ui.generic.template` | Fiori Elements V2 templates — ALP and ObjectPage |

### Configurable Fields — `sap.ui.generic.app` Section (ALP Page Config)

| Field | Description | Value in This Project |
|---|---|---|
| `pages` key | Page identifier — format: `"AnalyticalListPage\|<EntitySet>"` | `AnalyticalListPage\|Z_SEPMRA_SO_SALESORDERANALYSIS` |
| `entitySet` | The OData entity set to load data from | `Z_SEPMRA_SO_SALESORDERANALYSIS` |
| `component.name` | The Fiori Elements template to render | Fixed — always `sap.suite.ui.generic.template.AnalyticalListPage` |
| `tableSettings.type` | Type of table to render | `AnalyticalTable` (default for ALP), `GridTable`, `ResponsiveTable` |
| `tableSettings.multiSelect` | Enables multi-row selection | `false` |
| `condensedTableLayout` | Use compact/condensed row height | `true` |
| `showGoButtonOnFilterBar` | Show an explicit "Go" button — `true` = user triggers search; `false` = live filter | `true` |
| `autoHide` | Hides chart and table sections when no data is loaded | `true` |
| `smartVariantManagement` | Persistent filter bar variant management | `false` — requires a backend variant service to enable |
| `chartSettings.showDataLabel` | Show value labels on chart bars | `true` |
| `filterSettings.dateSettings.useDateRange` | Use a date range picker for date filter fields | `true` |
| `keyPerformanceIndicators` | KPI header tag definitions | `{}` — empty means no KPIs |
| `considerAnalyticalParameters` | Passes analytical parameters with OData requests | Fixed — always `true` for aggregate entity sets |
| `objectPageHeaderType` | Object Page header style | `Dynamic` (collapsing header), `Static` |
| `pages.ObjectPage\|<EntitySet>` | Nested Object Page for row-click navigation | Remove this block if detail navigation is not needed |

---

## File 5: `webapp/i18n/i18n.properties`

### Purpose
The resource bundle for translatable texts. This file is referenced by `manifest.json` in two ways:
- In `sap.app.i18n` — used to resolve the `{{appTitle}}` and `{{appDescription}}` tokens in the manifest itself
- In `sap.ui5.models` — registered as two i18n models (`i18n` and `@i18n`) available throughout the app

Without this file the app fails to start because the manifest cannot resolve its own title and description.

### File Content
```properties
# This is the resource bundle for com.demo.alp.salesorderanalysis

#Texts for manifest.json

#XTIT: Application name
appTitle=App Title

#YDES: Application description
appDescription=An SAP Fiori application.
```

### Configurable Fields

| Key | Description | Value in This Project |
|---|---|---|
| `appTitle` | Application title displayed in the browser tab and FLP tile | `App Title` |
| `appDescription` | Application description used in metadata and FLP | `An SAP Fiori application.` |

### Comment Prefix Conventions

| Prefix | Meaning |
|---|---|
| `#XTIT:` | UI title text |
| `#YDES:` | Description text |
| `#XBUT:` | Button label |
| `#XFLD:` | Field label |
| `#XMSG:` | Message text |

---

## File 6: `webapp/annotations/annotation.xml`

### Purpose
Contains the OData V4 UI annotations that drive the ALP page rendering. The file is declared as a `dataSources` entry of type `ODataAnnotation` in `manifest.json`. During bootstrap, the `AppComponent` loads these annotations and merges them with the OData service metadata. The Fiori Elements ALP template then reads them to:
- Render the **Filter Bar** fields from `UI.SelectionFields`
- Render the **Chart** from `UI.Chart`
- Render the **Table** columns from `UI.LineItem`
- Link chart and table and set default sort from `UI.PresentationVariant`

Without this file the ALP page loads but the filter bar, chart, and table have no configuration and remain empty.

### File Content
```xml
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml">
        <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common" />
    </edmx:Reference>
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
        <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI" />
    </edmx:Reference>
    <edmx:Reference Uri="/here/goes/your/serviceurl/$metadata">
        <edmx:Include Namespace="TECHED_ALP_SOA_SRV" />
    </edmx:Reference>
    <edmx:DataServices>
        <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local">
            <Annotations Target="TECHED_ALP_SOA_SRV.Z_SEPMRA_SO_SALESORDERANALYSISType">

                <Annotation Term="UI.Chart" Qualifier="revenue">
                    <Record Type="UI.ChartDefinitionType">
                        <PropertyValue Property="Description" String="revenue by customer" />
                        <PropertyValue Property="Title" String="revenue by customer" />
                        <PropertyValue Property="ChartType" EnumMember="UI.ChartType/Column" />
                        <PropertyValue Property="Dimensions">
                            <Collection>
                                <PropertyPath>SoldToParty</PropertyPath>
                            </Collection>
                        </PropertyValue>
                        <PropertyValue Property="DimensionAttributes">
                            <Collection>
                                <Record Type="UI.ChartDimensionAttributeType">
                                    <PropertyValue Property="Dimension" PropertyPath="SoldToParty" />
                                    <PropertyValue Property="Role" EnumMember="UI.ChartDimensionRoleType/Category" />
                                </Record>
                            </Collection>
                        </PropertyValue>
                        <PropertyValue Property="Measures">
                            <Collection>
                                <PropertyPath>NetAmount</PropertyPath>
                            </Collection>
                        </PropertyValue>
                        <PropertyValue Property="MeasureAttributes">
                            <Collection>
                                <Record Type="UI.ChartMeasureAttributeType">
                                    <PropertyValue Property="Measure" PropertyPath="NetAmount" />
                                    <PropertyValue Property="Role" EnumMember="UI.ChartMeasureRoleType/Axis1" />
                                </Record>
                            </Collection>
                        </PropertyValue>
                    </Record>
                </Annotation>

                <Annotation Term="UI.PresentationVariant">
                    <Record Type="UI.PresentationVariantType">
                        <PropertyValue Property="Text" String="Default" />
                        <PropertyValue Property="SortOrder">
                            <Collection>
                                <Record Type="Common.SortOrderType">
                                    <PropertyValue Property="Property" PropertyPath="NetAmount" />
                                    <PropertyValue Property="Descending" Bool="false" />
                                </Record>
                            </Collection>
                        </PropertyValue>
                        <PropertyValue Property="IncludeGrandTotal" Bool="false" />
                        <PropertyValue Property="InitialExpansionLevel" Int="0" />
                        <PropertyValue Property="Visualizations">
                            <Collection>
                                <AnnotationPath>@UI.LineItem</AnnotationPath>
                                <AnnotationPath>@UI.Chart#revenue</AnnotationPath>
                            </Collection>
                        </PropertyValue>
                    </Record>
                </Annotation>

                <Annotation Term="UI.LineItem">
                    <Collection>
                        <Record Type="UI.DataField">
                            <PropertyValue Property="Value" Path="Quantity" />
                        </Record>
                        <Record Type="UI.DataField">
                            <PropertyValue Property="Value" Path="DeliveryCalendarMonth" />
                        </Record>
                        <Record Type="UI.DataField">
                            <PropertyValue Property="Value" Path="GrossAmount" />
                        </Record>
                        <Record Type="UI.DataField">
                            <PropertyValue Property="Value" Path="SoldToPartyCompanyName" />
                        </Record>
                    </Collection>
                </Annotation>

                <Annotation Term="UI.SelectionFields">
                    <Collection>
                        <PropertyPath>SalesOrder</PropertyPath>
                        <PropertyPath>Supplier</PropertyPath>
                        <PropertyPath>OrderDate</PropertyPath>
                    </Collection>
                </Annotation>

            </Annotations>
        </Schema>
    </edmx:DataServices>
</edmx:Edmx>
```

### Structure Explained

**Header References** — always required, always the same:
```xml
<edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml">
    <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common" />
</edmx:Reference>
<edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
    <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI" />
</edmx:Reference>
```

**Service Reference** — links this annotation file to the OData service metadata. Replace `<YOUR_SERVICE_URL>` and `<ODATA_SERVICE_NAMESPACE>` with your app's values:
```xml
<edmx:Reference Uri="<YOUR_SERVICE_URL>/$metadata">
    <edmx:Include Namespace="<ODATA_SERVICE_NAMESPACE>" />
</edmx:Reference>
```

**Annotations Target** — the `Target` attribute must point to the **entity type** (not the entity set). Replace with your app's OData namespace and entity type name:
```xml
<Annotations Target="<ODATA_SERVICE_NAMESPACE>.<YOUR_ENTITY_TYPE>">
```
Format: `<ODataServiceNamespace>.<EntityTypeName>` — find the entity type name in `metadata.xml` under `EntityType Name="..."`

### Configurable Fields

| Element | Field | Description | Value in This Project |
|---|---|---|---|
| `edmx:Reference` (service) | `Uri` | Must be `<backend service URL>/$metadata` | `/here/goes/your/serviceurl/$metadata` |
| `edmx:Include` | `Namespace` | The OData service namespace from `metadata.xml` | `TECHED_ALP_SOA_SRV` |
| `Annotations` | `Target` | `<Namespace>.<EntityTypeName>` — the entity type to annotate | `TECHED_ALP_SOA_SRV.Z_SEPMRA_SO_SALESORDERANALYSISType` |
| `UI.Chart` | `Qualifier` | A unique name for this chart annotation | `revenue` |
| `UI.Chart` | `ChartType` | The chart visual type | `Column`, `Bar`, `Line`, `Pie`, `Donut` |
| `UI.Chart` | `Dimensions → PropertyPath` | Entity property used as the chart category axis | `SoldToParty` |
| `UI.Chart` | `Measures → PropertyPath` | Entity property used as the chart value axis | `NetAmount` |
| `UI.PresentationVariant` | `SortOrder → PropertyPath` | Default sort property for the table | `NetAmount` |
| `UI.PresentationVariant` | `Descending` | Sort direction | `false` = ascending, `true` = descending |
| `UI.PresentationVariant` | `Visualizations → AnnotationPath` | References to the chart and table annotations to display | `@UI.LineItem`, `@UI.Chart#revenue` |
| `UI.LineItem` | `DataField → Value → Path` | Entity properties to display as table columns | `Quantity`, `GrossAmount`, etc. |
| `UI.SelectionFields` | `PropertyPath` | Entity properties to display as filter fields | `SalesOrder`, `Supplier`, `OrderDate` |

### Role of Each Annotation in the ALP Page

| Annotation | Renders in the Page As |
|---|---|
| `UI.SelectionFields` | Filter Bar — the fields the user filters by |
| `UI.Chart` | Smart Chart — visual analytics area |
| `UI.PresentationVariant` | Links the chart and table; sets default sort and expansion level |
| `UI.LineItem` | Smart Table — the tabular data area |

> **Rule:** The `Qualifier` in `UI.Chart` (e.g. `revenue`) must exactly match the `AnnotationPath` in `UI.PresentationVariant.Visualizations` (e.g. `@UI.Chart#revenue`). A mismatch causes the chart to not render.

---

## Critical Consistency Rules

> **Important:** These rules do NOT mean every app must use the same values. Each new app will have its **own** namespace, service URL, and entity set. The rule is: **whatever values you choose for your app, those same values must appear identically in every file listed below**. A mismatch between files — even one character difference — causes the app to fail silently or not load at all.

---

### Rule 1 — App Namespace Must Be Identical Across All Files

Each app has a unique namespace in reverse-domain format (e.g. `com.<company>.<project>.<appname>`). Once you decide the namespace, the **exact same string** must appear in all these locations:

| File | Location | Required Value |
|---|---|---|
| `webapp/index.html` | `data-sap-ui-resource-roots` JSON key | `<YOUR_APP_NAMESPACE>` |
| `webapp/index.html` | `data-name` attribute on `<div>` | `<YOUR_APP_NAMESPACE>` |
| `webapp/index.html` | `data-settings` — `"id"` value | `<YOUR_APP_NAMESPACE>` |
| `webapp/Component.js` | First argument to `Component.extend()` | `<YOUR_APP_NAMESPACE>.Component` |
| `webapp/manifest.json` | `sap.app.id` | `<YOUR_APP_NAMESPACE>` |
| `webapp/manifest.json` | `sap.ui5.models.i18n.settings.bundleName` | `<YOUR_APP_NAMESPACE>.i18n.i18n` |

**Example** — if your namespace is `com.mycompany.finance.revenueanalysis`:
```
index.html   → data-sap-ui-resource-roots key  : "com.mycompany.finance.revenueanalysis"
index.html   → data-name                        : "com.mycompany.finance.revenueanalysis"
index.html   → data-settings "id"               : "com.mycompany.finance.revenueanalysis"
Component.js → Component.extend(...)            : "com.mycompany.finance.revenueanalysis.Component"
manifest.json → sap.app.id                      : "com.mycompany.finance.revenueanalysis"
manifest.json → bundleName                      : "com.mycompany.finance.revenueanalysis.i18n.i18n"
```

---

### Rule 2 — Backend Service URL Must Be Identical Across All Files

Each app points to its own OData service. The service URL you set in `manifest.json` must also appear (with `/$metadata` appended) in `annotation.xml`:

| File | Location | Required Value |
|---|---|---|
| `webapp/manifest.json` | `sap.app.dataSources.mainService.uri` | `<YOUR_SERVICE_URL>/` |
| `webapp/annotations/annotation.xml` | `edmx:Reference Uri` (service reference) | `<YOUR_SERVICE_URL>/$metadata` |

**Example** — if your OData service is at `/sap/opu/odata/sap/REVENUE_SRV`:
```
manifest.json   → mainService.uri  : "/sap/opu/odata/sap/REVENUE_SRV/"
annotation.xml  → Reference Uri    : "/sap/opu/odata/sap/REVENUE_SRV/$metadata"
```

---

### Rule 3 — Entity Set and Entity Type Must Be Identical Across All Files

Each app uses a specific OData entity set as its data source. The entity set name comes from the OData service metadata. Set it consistently in both files:

| File | Location | Required Value |
|---|---|---|
| `webapp/manifest.json` | `sap.ui.generic.app.pages` key | `AnalyticalListPage\|<YOUR_ENTITY_SET>` |
| `webapp/manifest.json` | `pages.<key>.entitySet` | `<YOUR_ENTITY_SET>` |
| `webapp/manifest.json` | Nested `ObjectPage` key | `ObjectPage\|<YOUR_ENTITY_SET>` |
| `webapp/annotations/annotation.xml` | `Annotations Target` | `<ODATA_NAMESPACE>.<YOUR_ENTITY_TYPE>` |

**Entity Type vs Entity Set:** The entity **set** name (e.g. `RevenueAnalysis`) and entity **type** name (e.g. `RevenueAnalysisType`) are different. The entity type name is found in the OData `metadata.xml` — look for `EntityType Name="..."`. Typically the entity type name is the entity set name with a `Type` suffix, but always confirm from the actual metadata.

**Example** — if your entity set is `RevenueAnalysis` with OData namespace `REVENUE_SRV`:
```
manifest.json   → pages key     : "AnalyticalListPage|RevenueAnalysis"
manifest.json   → entitySet     : "RevenueAnalysis"
manifest.json   → ObjectPage key: "ObjectPage|RevenueAnalysis"
annotation.xml  → Target        : "REVENUE_SRV.RevenueAnalysisType"
```

---

## Bootstrap Startup Sequence

The following is the exact sequence from browser load to rendered ALP page:

```
1. Browser loads  webapp/index.html
        │
        │  <script id="sap-ui-bootstrap" src="resources/sap-ui-core.js">
        │  (sap-ui-core.js is served by the dev server middleware — not a physical file)
        ▼
2. SAPUI5 framework initializes
        │
        │  data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
        │  ComponentSupport scans the DOM
        ▼
3. <div data-sap-ui-component data-name="<YOUR_APP_NAMESPACE>"> found
        │
        │  ComponentSupport instantiates the component class
        ▼
4. webapp/Component.js loaded and instantiated
        │
        │  extends sap/suite/ui/generic/template/lib/AppComponent
        │  metadata: { manifest: "json" }  →  reads manifest.json
        ▼
5. webapp/manifest.json read by AppComponent
        │
        ├── sap.app.dataSources.mainService  →  OData V2 model created (bound to "")
        ├── sap.app.dataSources.annotation   →  annotation.xml loaded and merged
        ├── sap.ui5.models.i18n              →  i18n model created from i18n.properties
        └── sap.ui.generic.app.pages         →  ALP template instantiated
                │
                ▼
6. webapp/annotations/annotation.xml read by the ALP template
        │
        ├── UI.SelectionFields     →  SmartFilterBar rendered with declared filter fields
        ├── UI.Chart               →  SmartChart rendered with declared dimension and measure
        ├── UI.PresentationVariant →  Chart and Table linked, default sort order applied
        └── UI.LineItem            →  SmartTable rendered with declared columns
                │
                ▼
7. ALP page fully rendered in the browser
```

---

## Checklist for a New ALP App

Use this checklist when generating a new ALP application:

- [ ] Create `package.json` — set `name`, keep all `devDependencies`, set `sapuxLayer`
- [ ] Create `webapp/index.html` — set `data-sap-ui-resource-roots` key and `data-name` to the new app namespace
- [ ] Create `webapp/Component.js` — update `Component.extend("NEW_NAMESPACE.Component", ...)`
- [ ] Create `webapp/manifest.json`:
  - [ ] Set `sap.app.id` to the new namespace
  - [ ] Set `dataSources.mainService.uri` to the actual backend service URL
  - [ ] Set `dataSources.annotation.uri` to `annotations/annotation.xml`
  - [ ] Set `models.i18n.settings.bundleName` to `NEW_NAMESPACE.i18n.i18n`
  - [ ] Set `sap.ui.generic.app.pages` key to `AnalyticalListPage|<EntitySet>`
  - [ ] Set `entitySet` to the OData entity set name
- [ ] Create `webapp/i18n/i18n.properties` — set `appTitle` and `appDescription`
- [ ] Create `webapp/annotations/annotation.xml`:
  - [ ] Update `edmx:Reference Uri` to `<backendServiceUrl>/$metadata`
  - [ ] Update `edmx:Include Namespace` to the OData service namespace
  - [ ] Update `Annotations Target` to `<Namespace>.<EntityTypeName>`
  - [ ] Define `UI.SelectionFields` with the required filter fields
  - [ ] Define `UI.Chart` with the chart type, dimension, and measure
  - [ ] Define `UI.PresentationVariant` referencing both `@UI.LineItem` and `@UI.Chart#<Qualifier>`
  - [ ] Define `UI.LineItem` with the required table columns
- [ ] Run `npm install` to install dev dependencies
- [ ] Run `npm run start-mock` to verify the app bootstraps and renders correctly

---

*Reference project: `salesorderanalysis` — Fiori Elements ALP V2 generated by SAP Fiori Application Generator v1.28.0, SAPUI5 v1.136.14, SAP Business Application Studio.*
