*Part of the fiori-bootstrap skill.*

# Flexible Programming Model (FPM)

FPM lets you extend or replace Fiori Elements pages with **your own XML using SAP building blocks** (`sap.fe.macros`) while keeping the FE runtime, lifecycle, and OData handling. Reach for FPM only when annotations cannot express the UI you need — annotations first, extension second. Two patterns:

1. **Custom section / column** added to a standard List Report or Object Page via the manifest `content` block + an XML fragment.
2. **Custom page** — a fully custom page driven by `sap.fe.core.fpm.Page` with your own root view, still embedded in the FE app.

The `purchaseOrder` app demonstrates pattern 1: a custom Object Page section rendering a semantic `ObjectStatus` badge that annotations can't produce.

## Pattern 1a — custom Object Page section (real example)

Register the section under the Object Page target in `manifest.json`. The `template` is the dotted path to an XML fragment; `position` anchors it relative to an existing facet by its annotation `ID`.

```jsonc
"PODetail": {
  "type": "Component",
  "name": "sap.fe.templates.ObjectPage",
  "options": {
    "settings": {
      "contextPath": "/PurchaseOrders",
      "editableHeaderContent": false,
      "content": {
        "body": {
          "sections": {
            "CustomPOStatusSection": {
              "template": "purchase.order.list.ext.customSection.POStatusSection",
              "title": "{i18n>poStatusSectionTitle}",
              "position": { "placement": "After", "anchor": "PODetailsFacet" }
            }
          }
        }
      }
    }
  }
}
```

The fragment lives at `webapp/ext/customSection/POStatusSection.fragment.xml`. Fiori Elements injects the Object Page entity context automatically, so **relative bindings resolve against `/PurchaseOrders(<key>)`** — no controller needed for a display-only section:

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns:m="sap.m" xmlns:l="sap.ui.layout">
  <m:VBox class="sapUiSmallMargin">
    <!-- ObjectStatus the annotation DataPoint cannot render (inverted badge) -->
    <m:ObjectStatus
      title="Current Status"
      text="{POStatus}"
      state="{= %{POStatusCriticality} === 3 ? 'Success'
               : %{POStatusCriticality} === 2 ? 'Warning'
               : %{POStatusCriticality} === 1 ? 'Error' : 'None' }"
      icon="{= %{POStatusCriticality} === 3 ? 'sap-icon://accept'
               : %{POStatusCriticality} === 2 ? 'sap-icon://alert'
               : %{POStatusCriticality} === 1 ? 'sap-icon://error' : 'sap-icon://pending' }"
      inverted="true" />
  </m:VBox>
</core:FragmentDefinition>
```

Note the criticality mapping mirrors the SAP enum (3 Positive→Success, 2 Critical→Warning, 1 Negative→Error, 0 Neutral→None). Prefer annotations for pure-data sections; use a fragment only for the semantic UI annotations can't control.

## Pattern 1b — building blocks in a custom section

Inside a custom fragment you can drop FE **macros** that behave like the standard table/chart/filter but are placed wherever you want. They need a `metaPath` (annotation term) and a `contextPath`:

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns:macros="sap.fe.macros">
  <!-- A fully functional FE table bound to a navigation property -->
  <macros:Table id="itemsTable"
                metaPath="Items/@com.sap.vocabularies.UI.v1.LineItem"
                contextPath="/PurchaseOrders" />

  <!-- An FE chart -->
  <macros:Chart id="trendChart"
                metaPath="@com.sap.vocabularies.UI.v1.Chart#alp"
                contextPath="/PurchaseOrders" />

  <!-- A filter bar building block -->
  <macros:FilterBar id="customFilterBar"
                    metaPath="@com.sap.vocabularies.UI.v1.SelectionFields"
                    contextPath="/PurchaseOrders" />
</core:FragmentDefinition>
```

`sap.fe.macros` must be in `dependencies.libs`. Building blocks keep FE's data binding, value helps, and variant handling — you do not re-implement OData calls.

## Pattern 2 — custom page (sap.fe.core.fpm)

For a page that is not a ListReport/ObjectPage at all, target the FPM component and supply your own root view:

```jsonc
"targets": {
  "MyCustomPage": {
    "type": "Component",
    "id": "MyCustomPage",
    "name": "sap.fe.core.fpm",
    "options": {
      "settings": {
        "viewName": "purchase.order.list.ext.main.Main",
        "contextPath": "/PurchaseOrders"
      }
    }
  }
}
```

The view `webapp/ext/main/Main.view.xml` is an `sap.fe.core.fpm.Page` (or a plain `sap.ui.core.mvc.View`) hosting macros and standard `sap.m` controls. A controller extending `sap.fe.core.PageController` gives access to `this.getExtensionAPI()` for routing, edit flow, and messages — without bypassing the FE lifecycle.

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:macros="sap.fe.macros"
          xmlns:fpm="sap.fe.core.fpm"
          controllerName="purchase.order.list.ext.main.Main">
  <fpm:Page>
    <macros:Table metaPath="@com.sap.vocabularies.UI.v1.LineItem"
                  contextPath="/PurchaseOrders" />
  </fpm:Page>
</mvc:View>
```

## Walkthrough A — External-service / RAP FPM (standalone: proxy + local metadata)

> Use this ONLY when the FPM app is **not** inside a CAP project (external OData / RAP backend).
> For a CAP backend, skip to **Walkthrough B — CAP-embedded FPM** below.

The end-to-end version of Pattern 2: a complete custom FPM page with a Filter Bar and Table built from `sap.fe.macros` building blocks. Building blocks read OData V4 annotations to render filter fields and table columns automatically — you only define the layout and the annotations.

### Required Files

| File | Role |
|---|---|
| `webapp/manifest.json` | App descriptor — data sources, models, FPM routing |
| `webapp/Component.js` | App component (must extend `sap/fe/core/AppComponent`) |
| `webapp/ext/view/Main.view.xml` | Custom XML view with FilterBar and Table building blocks |
| `webapp/ext/view/Main.controller.js` | Page controller (must extend `sap/fe/core/PageController`) |
| `webapp/annotations/annotation.xml` | Local OData annotations for filter fields and table columns |
| `webapp/localService/mainService/metadata.xml` | Local copy of OData V4 service metadata |
| `webapp/i18n/i18n.properties` | Translatable texts |
| `ui5.yaml` | UI5 tooling — proxy and server configuration |
| `package.json` | Project dependencies and scripts |

### Step 1 — `package.json`

```json
{
  "name": "<app-technical-name>",
  "version": "0.0.1",
  "description": "An SAP Fiori application.",
  "keywords": ["ui5", "openui5", "sapui5"],
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
    "start": "fiori run --open \"test/flp.html#app-preview\"",
    "start-local": "fiori run --config ./ui5-local.yaml --open \"test/flp.html#app-preview\"",
    "start-mock": "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",
    "start-noflp": "fiori run --open \"/index.html?sap-ui-xx-viewCache=false\"",
    "build": "ui5 build --config=ui5.yaml --clean-dest --dest dist",
    "lint": "eslint ./",
    "deploy": "fiori verify",
    "deploy-config": "fiori add deploy-config",
    "int-test": "fiori run --config ./ui5-mock.yaml --open \"/test/integration/opaTests.qunit.html\"",
    "start-variants-management": "fiori run --open \"/preview.html#app-preview\""
  },
  "sapuxLayer": "CUSTOMER_BASE",
  "sapux": true
}
```

### Step 2 — `ui5.yaml`

```yaml
specVersion: "4.0"
metadata:
  name: <app-id>          # Must match sap.app.id in manifest.json
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
          - path: /sap
            url: <backend-url>
            destination: <destination-name>
            authenticationType: reentranceTicket
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
builder:
  resources:
    excludes:
      - /test/**
      - /localService/**
```

Replace `<backend-url>` and `<destination-name>` with the actual BTP ABAP backend URL and destination configured in your SAP BTP subaccount.

### Step 3 — `webapp/manifest.json`

```json
{
  "_version": "1.73.1",
  "sap.app": {
    "id": "<your.app.id>",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "applicationVersion": { "version": "0.0.1" },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "resources": "resources.json",
    "dataSources": {
      "annotation": {
        "type": "ODataAnnotation",
        "uri": "annotations/annotation.xml",
        "settings": {
          "localUri": "annotations/annotation.xml"
        }
      },
      "mainService": {
        "uri": "<odata-v4-service-uri>",
        "type": "OData",
        "settings": {
          "annotations": ["annotation"],
          "localUri": "localService/mainService/metadata.xml",
          "odataVersion": "4.0"
        }
      }
    }
  },
  "sap.ui": {
    "technology": "UI5",
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
        "sap.fe.core": {},
        "sap.fe.macros": {}
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
          "bundleName": "<your.app.id>.i18n.i18n"
        }
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
    "routing": {
      "config": {},
      "routes": [
        {
          "name": "<RouteName>",
          "pattern": ":?query:",
          "target": "<RouteName>"
        }
      ],
      "targets": {
        "<RouteName>": {
          "type": "Component",
          "id": "<RouteName>",
          "name": "sap.fe.core.fpm",
          "options": {
            "settings": {
              "navigation": {},
              "contextPath": "/<EntitySetName>",
              "viewName": "<your.app.id>.ext.view.Main"
            }
          }
        }
      }
    }
  },
  "sap.fe": {
    "app": {
      "enableLazyLoading": true
    }
  }
}
```

**Rules — routing target (most critical section):**

| Property | Required Value | Explanation |
|---|---|---|
| `type` | `"Component"` | Always `"Component"` for FPM pages |
| `name` | `"sap.fe.core.fpm"` | Exactly this string — loads the FPM page component |
| `contextPath` | `"/<EntitySetName>"` | Must start with `/`; entity set name from OData service |
| `viewName` | `"<appId>.ext.view.Main"` | Fully qualified view name; must match the controller's class name |
| `navigation` | `{}` | Defines navigation to other pages (e.g., detail). Leave as empty object `{}` when there is no navigation from this page |

**Required top-level flags:**
- `"flexEnabled": true` — **Mandatory for FPM.** Enables SAPUI5 flexibility services. Without this, FPM page lifecycle and building blocks will not initialize correctly.

**Required libraries:**
- `sap.fe.core` — FPM runtime
- `sap.fe.macros` — Provides the building blocks

**OData model settings:**
- `operationMode: "Server"` — filtering and sorting happen server-side (required for OData V4)
- `autoExpandSelect: true` — automatically generates `$select` and `$expand`
- `earlyRequests: true` — sends metadata request before the view is rendered (performance)

**Note on `@i18n` model:** The `"@i18n"` model (with `@` prefix) is used internally by FPM building blocks for their own translations. It must point to the same `i18n.properties` file. Do not omit it.

### Step 4 — `webapp/Component.js`

```javascript
sap.ui.define(
    ["sap/fe/core/AppComponent"],
    function (Component) {
        "use strict";

        return Component.extend("<your.app.id>.Component", {
            metadata: {
                manifest: "json"
            }
        });
    }
);
```

**Rule:** Must extend `sap/fe/core/AppComponent`. Using `sap/ui/core/UIComponent` will break FPM initialization.

### Step 5 — `webapp/ext/view/Main.controller.js`

```javascript
sap.ui.define(
    ["sap/fe/core/PageController"],
    function (PageController) {
        "use strict";

        return PageController.extend("<your.app.id>.ext.view.Main", {
            // onInit: function () {
            //     PageController.prototype.onInit.apply(this, arguments);
            // }
        });
    }
);
```

**Rules:**
- Must extend `sap/fe/core/PageController`.
- The string passed to `.extend(...)` must exactly match the `controllerName` in the XML view.
- If `onInit` is overridden, always call `PageController.prototype.onInit.apply(this, arguments)` first.

### Step 6 — `webapp/ext/view/Main.view.xml`

```xml
<mvc:View
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m"
    xmlns:macros="sap.fe.macros"
    controllerName="<your.app.id>.ext.view.Main">

    <Page id="Main" title="{i18n>MainTitle}">
        <content>
            <macros:FilterBar
                id="FilterBar"
                metaPath="/<EntitySetName>/@com.sap.vocabularies.UI.v1.SelectionFields#<Qualifier>"/>

            <macros:Table
                id="Table"
                metaPath="/<EntitySetName>/@com.sap.vocabularies.UI.v1.LineItem"
                filterBar="FilterBar"/>
        </content>
    </Page>
</mvc:View>
```

**Rules:**

| Attribute | Rule |
|---|---|
| `xmlns:macros="sap.fe.macros"` | Required on the root `<mvc:View>` element |
| `controllerName` | Must match the `.extend(...)` string in `Main.controller.js` exactly |
| `macros:FilterBar id` | Any unique ID within the view; referenced by the Table |
| `metaPath` on FilterBar | `/<EntitySetName>/@com.sap.vocabularies.UI.v1.SelectionFields#<Qualifier>` — include `#Qualifier` only if the annotation uses a qualifier |
| `metaPath` on Table | `/<EntitySetName>/@com.sap.vocabularies.UI.v1.LineItem` |
| `filterBar` on Table | Must exactly match the `id` of the `macros:FilterBar` — this links filtering between the two controls |

**Qualifier in `metaPath`:**
- If `UI.SelectionFields` is defined with `Qualifier="myQualifier"` in annotation.xml → `metaPath` must end with `#myQualifier`.
- If no qualifier → omit the `#...` suffix.

### Step 7 — `webapp/annotations/annotation.xml`

Local annotations define which properties appear as filter fields and which as table columns.

```xml
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">

    <!-- Reference the SAP UI vocabulary -->
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
        <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
    </edmx:Reference>

    <!-- Reference the OData service to resolve the entity type namespace -->
    <edmx:Reference Uri="<odata-v4-service-uri>$metadata">
        <edmx:Include Namespace="<service-schema-namespace>" Alias="SAP__self"/>
    </edmx:Reference>

    <edmx:DataServices>
        <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local">

            <!-- Target = <ServiceSchemaNamespace>.<EntityTypeName> -->
            <Annotations Target="SAP__self.<EntityTypeName>">

                <!-- Filter Bar fields — use a Qualifier to avoid conflicting with backend annotations -->
                <Annotation Term="UI.SelectionFields" Qualifier="<Qualifier>">
                    <Collection>
                        <PropertyPath>FilterProperty1</PropertyPath>
                        <PropertyPath>FilterProperty2</PropertyPath>
                        <PropertyPath>FilterProperty3</PropertyPath>
                    </Collection>
                </Annotation>

                <!-- Table columns -->
                <Annotation Term="UI.LineItem">
                    <Collection>
                        <Record Type="UI.DataField">
                            <PropertyValue Property="Label" String="Column 1"/>
                            <PropertyValue Property="Value" Path="Property1"/>
                        </Record>
                        <Record Type="UI.DataField">
                            <PropertyValue Property="Label" String="Column 2"/>
                            <PropertyValue Property="Value" Path="Property2"/>
                        </Record>
                    </Collection>
                </Annotation>

            </Annotations>
        </Schema>
    </edmx:DataServices>
</edmx:Edmx>
```

**Rules:**

1. **Target format:** `<ServiceSchemaNamespace>.<EntityTypeName>` — use the entity **type** name (e.g., `MyEntityType`), not the entity **set** name (e.g., `MyEntities`). The namespace comes from `<Schema Namespace="...">` in `metadata.xml`.

2. **Use a qualifier for `UI.SelectionFields`:** When the backend service already defines `UI.SelectionFields` on the entity, adding a qualifier in the local annotation avoids conflicts. The qualifier is then referenced in the view `metaPath` as `#<Qualifier>`.

3. **`UI.LineItem` overrides:** If the backend defines `UI.LineItem` on the same entity and you also define it locally without a qualifier, the local annotation takes precedence. Use this intentionally when you want to replace backend columns.

4. **`Label` on `DataField` is optional:** If omitted, the label from `@com.sap.vocabularies.Common.v1.Label` on the property (from metadata.xml) is used automatically.

### Step 8 — `webapp/localService/mainService/metadata.xml`

This file is the local copy of the OData V4 CSDL metadata. It is required for local development. For a real backend, download it from `<service-uri>$metadata`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0"
    xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
    xmlns="http://docs.oasis-open.org/odata/ns/edm">
    <edmx:DataServices>
        <Schema Namespace="<service-schema-namespace>" Alias="SAP__self">

            <EntityType Name="<EntityTypeName>">
                <Key>
                    <PropertyRef Name="<KeyProperty>"/>
                </Key>
                <Property Name="<KeyProperty>" Type="Edm.String" Nullable="false" MaxLength="20"/>
                <Property Name="Property2" Type="Edm.String" Nullable="false" MaxLength="4"/>
                <Property Name="Property3" Type="Edm.Date"/>
                <!-- Declare all properties referenced in annotation.xml -->
            </EntityType>

            <EntityContainer Name="Container">
                <EntitySet Name="<EntitySetName>" EntityType="<service-schema-namespace>.<EntityTypeName>"/>
            </EntityContainer>

        </Schema>
    </edmx:DataServices>
</edmx:Edmx>
```

**Rules:**
- `<Schema Namespace="...">` must match the `Namespace` used in `annotation.xml`'s `edmx:Include`.
- `<EntitySet Name="...">` must match `contextPath` in `manifest.json` (without the leading `/`).
- Every property listed in `annotation.xml` (`SelectionFields`, `LineItem`) must be declared here.

### Step 9 — `webapp/i18n/i18n.properties`

```properties
appTitle=<Application Title>
appDescription=<Application Description>
MainTitle=<Page Title>
```

`MainTitle` is bound in the view as `{i18n>MainTitle}`.

### How Everything Connects

```
manifest.json
  contextPath: "/<EntitySetName>"     → Identifies which OData entity to work with
  viewName: "...ext.view.Main"        → Points to Main.view.xml

Main.view.xml
  macros:FilterBar
    metaPath="/<EntitySetName>/@UI.SelectionFields#<Qualifier>"
    → reads from
  annotation.xml → UI.SelectionFields → list of PropertyPaths → rendered as filter fields

  macros:Table
    metaPath="/<EntitySetName>/@UI.LineItem"
    filterBar="FilterBar"             → links Table filter actions to the FilterBar
    → reads from
  annotation.xml → UI.LineItem → list of DataField records → rendered as table columns

  OData V4 requests → backend service → returns filtered data → displayed in Table
```

### Checklist Before Running

- [ ] `Component.js` extends `sap/fe/core/AppComponent`
- [ ] `Main.controller.js` extends `sap/fe/core/PageController`
- [ ] `"flexEnabled": true` is set in `sap.ui5` in `manifest.json`
- [ ] `sap.fe.core` and `sap.fe.macros` declared in `manifest.json` `sap.ui5.dependencies.libs`
- [ ] Routing target `name` is exactly `"sap.fe.core.fpm"` (no typos, no variation)
- [ ] `contextPath` starts with `/` and matches the entity set name
- [ ] `viewName` in routing matches `controllerName` in `Main.view.xml`
- [ ] `navigation` key is present in routing target settings (empty `{}` if no navigation needed)
- [ ] `xmlns:macros="sap.fe.macros"` declared on the root `<mvc:View>` element
- [ ] `macros:FilterBar id` matches `filterBar` attribute on `macros:Table`
- [ ] FilterBar `metaPath` includes `#<Qualifier>` if the annotation uses a qualifier
- [ ] `annotation.xml` `Target` uses `<ServiceNamespace>.<EntityTypeName>` (type, not set)
- [ ] All properties in `annotation.xml` exist in `metadata.xml`

### Common Mistakes

| Mistake | Effect | Fix |
|---|---|---|
| Routing target `name` is not `"sap.fe.core.fpm"` | Blank page or routing error | Use exactly `"sap.fe.core.fpm"` |
| `Component.js` extends `sap/ui/core/UIComponent` | Building blocks fail to initialize | Extend `sap/fe/core/AppComponent` |
| `"flexEnabled": true` missing from `sap.ui5` | FPM page lifecycle does not initialize | Add `"flexEnabled": true` to the `sap.ui5` block |
| `sap.fe.macros` missing from manifest libs | `macros:FilterBar` and `macros:Table` not resolved | Add to `sap.ui5.dependencies.libs` |
| FilterBar `metaPath` missing `#Qualifier` | FilterBar renders with no fields | Append `#<Qualifier>` matching the annotation |
| `filterBar` on Table points to wrong ID | Table and FilterBar are not linked | Match the exact `id` of `macros:FilterBar` |
| `Target` in annotation.xml uses entity set name | Annotations are not applied | Use entity type name: `<Namespace>.<EntityTypeName>` |
| `contextPath` missing leading `/` | FPM context binding fails | Must be `"/<EntitySetName>"` |

### `metaPath` Pattern Reference

```
Filter Bar → SelectionFields with qualifier:
  /<EntitySetName>/@com.sap.vocabularies.UI.v1.SelectionFields#<Qualifier>

Filter Bar → SelectionFields without qualifier:
  /<EntitySetName>/@com.sap.vocabularies.UI.v1.SelectionFields

Table → LineItem (standard):
  /<EntitySetName>/@com.sap.vocabularies.UI.v1.LineItem

Table → LineItem with qualifier:
  /<EntitySetName>/@com.sap.vocabularies.UI.v1.LineItem#<Qualifier>
```

The `<EntitySetName>` in `metaPath` must match the `contextPath` value (without the leading `/`) configured in `manifest.json` routing.

## Walkthrough B — CAP-embedded FPM (served by `cds watch` / `cds-plugin-ui5`)

The FPM app lives **inside** the CAP project under `app/<module>/`, is served by `cds watch`
(via `cds-plugin-ui5`), and reads its annotations from CAP CDS.

### B.0 — Folder structure

```text
<app>/                          # CAP root
├── package.json                # cds-plugin-ui5 in devDeps; watch-<module> script; "workspaces": ["app/*"]
├── db/schema.cds
├── srv/<svc>-service.cds        # service @(path:'/<path>')
├── app/
│   ├── <module>-ui.cds          # SHIM: `using from './<module>/annotations';`  (see B.7 — required)
│   └── <module>/                # the FPM Fiori app
│       ├── package.json         # ui5 serve / ui5 build
│       ├── ui5.yaml             # metadata.name = <ns> (lowercase); NO proxy, NO mockserver
│       ├── annotations.cds      # UI.SelectionFields / LineItem / HeaderInfo / Facets / Chart
│       └── webapp/
│           ├── manifest.json    # FPM descriptor (B.3)
│           ├── Component.js     # extends sap/fe/core/AppComponent (B.4)
│           ├── index.html       # CDN bootstrap; resource-roots key = <ns>
│           ├── i18n/i18n.properties
│           └── ext/
│               ├── main/Main.view.xml        # root FPM view: macros:FilterBar + macros:Table (B.5)
│               ├── main/Main.controller.js   # extends sap/fe/core/PageController (B.6)
│               └── fragment/CustomSection.fragment.xml   # macros:Chart + macros:Table (B.8)
```

### B.1 — CAP root `package.json`

```jsonc
{
  "devDependencies": {
    "@cap-js/sqlite": "^3",
    "@ui5/cli": "^4",
    "cds-plugin-ui5": "^0.17.0"      // WITHOUT this, cds watch serves only OData — blank UI
  },
  "dependencies": {
    "@sap/cds": "^10"
  },
  "scripts": {
    // --open path MUST equal <ui5.yaml metadata.name>/index.html
    "watch-<module>": "cds watch --open <ns>/index.html?sap-ui-xx-viewCache=false"
  },
  "workspaces": ["app/*"]
}
```

### B.2 — App `ui5.yaml` (minimal — CAP serves it, no proxy/mockserver)

```yaml
specVersion: "3.0"
metadata:
  name: <ns>          # lowercase; MUST equal manifest sap.app.id and index.html resource-roots key
type: application
resources:
  configuration:
    paths:
      webapp: webapp
```

### B.3 — `webapp/manifest.json`

```jsonc
{
  "sap.app": {
    "id": "<ns>",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "dataSources": {
      "mainService": {
        "uri": "/<cap-service-path>/",   // e.g. "/processor/" for @(path:'/processor')
        "type": "OData",                 // NO localUri, NO annotation dataSource
        "settings": { "odataVersion": "4.0" }
      }
    }
  },
  "sap.ui5": {
    "flexEnabled": true,                 // MANDATORY for FPM — page lifecycle won't init without it
    "dependencies": {
      "minUI5Version": "1.136.1",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {},
        "sap.fe.core": {},               // FPM runtime
        "sap.fe.macros": {},             // building blocks
        "sap.fe.templates": {}           // needed if you keep a standard Object Page target
      }
    },
    "rootView": { "viewName": "sap.fe.core.rootView.Fcl", "type": "XML", "id": "fcl" },
    "models": {
      "i18n": { "type": "sap.ui.model.resource.ResourceModel",
                "settings": { "bundleName": "<ns>.i18n.i18n" } },
      "": {
        "dataSource": "mainService",
        "preload": true,
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
      "config": { "routerClass": "sap.f.routing.Router",
                  "controlAggregation": "beginColumnPages", "controlId": "fcl" },
      "routes": [
        { "name": "<Entity>Main",  "pattern": ":?query:",               "target": "<Entity>Main" },
        { "name": "<Entity>OP",    "pattern": "<Entity>({key}):?query:", "target": ["<Entity>Main", "<Entity>OP"] }
      ],
      "targets": {
        "<Entity>Main": {
          "type": "Component",
          "id": "<Entity>Main",
          "name": "sap.fe.core.fpm",                 // EXACTLY this string — loads the FPM page
          "controlAggregation": "beginColumnPages",
          "options": {
            "settings": {
              "viewName": "<ns>.ext.main.Main",       // → ext/main/Main.view.xml
              "contextPath": "/<Entity>",
              "navigation": { "<Entity>": { "detail": { "route": "<Entity>OP" } } }
            }
          }
        },
        "<Entity>OP": {
          "type": "Component",
          "id": "<Entity>OP",
          "name": "sap.fe.templates.ObjectPage",
          "controlAggregation": "midColumnPages",
          "contextPattern": "/<Entity>({key})"
        }
      }
    }
  }
}
```

> **`contextPath` vs `entitySet`.** Use `contextPath: "/<Entity>"` (matches the project hard rule).
> The `navigation` block routes a table-row press to the Object Page.

### B.4 — `webapp/Component.js` (extend AppComponent, not UIComponent)

```javascript
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
    "use strict";
    return AppComponent.extend("<ns>.Component", {
        metadata: { manifest: "json" }
    });
});
```

**Rule:** Must extend `sap/fe/core/AppComponent`. Using `sap/ui/core/UIComponent` breaks FPM initialization.

### B.5 — `webapp/ext/main/Main.view.xml` (root FPM view; FilterBar + Table)

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns="sap.m" xmlns:f="sap.f"
          xmlns:macros="sap.fe.macros"
          controllerName="<ns>.ext.main.Main">
    <f:DynamicPage id="FilterBarDefault" class="sapUiResponsiveContentPadding">
        <f:title>
            <f:DynamicPageTitle>
                <f:heading><Title text="{i18n>MainTitle}" level="H2"/></f:heading>
            </f:DynamicPageTitle>
        </f:title>
        <f:header>
            <f:DynamicPageHeader pinnable="true">
                <macros:FilterBar id="FilterBar"
                    metaPath="@com.sap.vocabularies.UI.v1.SelectionFields"
                    filterChanged=".onFiltersChanged"/>
            </f:DynamicPageHeader>
        </f:header>
        <f:content>
            <macros:Table id="LineItemTable"
                metaPath="@com.sap.vocabularies.UI.v1.LineItem"
                filterBar="FilterBar"/>
        </f:content>
    </f:DynamicPage>
</mvc:View>
```

**Rules:** `xmlns:macros="sap.fe.macros"` on root `<mvc:View>` · `controllerName` must exactly match the controller's `.extend(...)` string · `filterBar` on Table must match the `id` of `macros:FilterBar`.

### B.6 — `webapp/ext/main/Main.controller.js` (extend PageController)

```javascript
sap.ui.define([
    "sap/fe/core/PageController",
    "sap/ui/model/json/JSONModel"
], function (PageController, JSONModel) {
    "use strict";
    return PageController.extend("<ns>.ext.main.Main", {
        onAfterRendering: function () {
            const filterBar = this.byId("FilterBar");
            this.getView().setModel(
                new JSONModel({ filtersTextInfo: filterBar.getActiveFiltersText() }),
                "fbConditions"
            );
            filterBar.triggerSearch();
        },
        onFiltersChanged: function () {
            const m = this.getView().getModel("fbConditions");
            if (m) { m.setProperty("/filtersTextInfo", this.byId("FilterBar").getActiveFiltersText()); }
        },
        onPressed: function (event) {
            const ctx = event.getSource().getBindingContext();
            // Route via the FE extension API — never a raw router
            if (ctx) { this.getExtensionAPI().getRouting().navigate(ctx); }
        }
    });
});
```

**Rules:** Must extend `sap/fe/core/PageController`. The string passed to `.extend(...)` must exactly match `controllerName` in the XML view. Use `this.getExtensionAPI()` for routing — never a raw router.

### B.7 — CAP annotation shim (the #1 CAP-embedded FPM failure)

CAP auto-loads top-level `app/*.cds` but **NOT** CDS nested under `app/<module>/`. Without a shim
the FPM building blocks render **empty** (no columns, no filters). Create `app/<module>-ui.cds`:

```cds
using from './<module>/annotations';
```

This one line makes CAP load `app/<module>/annotations.cds` at startup so building blocks can
resolve `@com.sap.vocabularies.UI.v1.SelectionFields`, `UI.LineItem`, etc.

### B.8 — Custom Object Page section with building blocks

`webapp/ext/fragment/CustomSection.fragment.xml`:

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns="sap.m"
                         xmlns:macros="sap.fe.macros"
                         core:require="{handler: '<ns>/ext/fragment/CustomSection'}">
    <!-- Chart bound to a navigation via contextPath -->
    <macros:Chart id="flightsChart"
        metaPath="@com.sap.vocabularies.UI.v1.Chart#<Q>"
        contextPath="/<Entity>/<to_Nav>"
        selectionMode="Single"
        selectionChange="handler.onChartSelectionChanged"/>
    <!-- Table on a navigation property, qualifier-scoped LineItem -->
    <macros:Table id="bookingTable"
        metaPath="<to_Child>/@com.sap.vocabularies.UI.v1.LineItem#<Q>"/>
</core:FragmentDefinition>
```

Register it under the Object Page target's `content.body.sections` (see B.3). `position.anchor`
must equal an existing `UI.Facets` entry `ID`.

### B.9 — FPM building blocks (macros) catalog

| Building block | `metaPath` term | `contextPath`? |
|---|---|---|
| `macros:FilterBar` | `@…UI.v1.SelectionFields[#Q]` | — |
| `macros:Table` | `@…UI.v1.LineItem[#Q]` (opt. `nav/`-qualified) | for nav tables |
| `macros:Chart` | `@…UI.v1.Chart#Q` | yes (`/Entity/to_Nav`) |
| `macros:FormContainer` / `macros:FormElement` | property path | — |
| `macros:Field` | property path | — |
| `macros:Paginator` | — (navigation driven by `contextPath`) | yes |
| `macros:MicroChart` | `@…UI.v1.Chart#<Qualifier>` | yes |

- **`metaPath`** selects the `@com.sap.vocabularies.UI.v1.*` term (optionally `#Qualifier`, optionally `nav/`-prefixed).
- **`contextPath`** sets the data binding context (root entity set, or a navigation like `/Travel/to_BookedFlights`).
- Annotation authoring (how to write `UI.SelectionFields` / `LineItem` / `Chart`) lives in `fiori-elements/references/fpm-annotations.md` — do not duplicate here.

### B.10 — Converting the `cap-fullstack-listreport` starter into an FPM app

1. In `manifest.json`, change the list target `name` from `sap.fe.templates.ListReport` → `sap.fe.core.fpm`.
2. Add `options.settings.viewName: "<ns>.ext.main.Main"` (+ `contextPath`, `navigation`).
3. Create `ext/main/Main.view.xml` (B.5) and `ext/main/Main.controller.js` (B.6).
4. Ensure `flexEnabled: true` and `sap.fe.macros` in libs (B.3).
5. Keep the Object Page target; add the annotation shim (B.7).

### B.11 — Hard rules (CAP-embedded FPM)

- Namespace identical in 4 places: `manifest sap.app.id` = `ui5.yaml metadata.name` = `index.html resource-roots key` = `Component`/`viewName`/`controllerName` namespace. Run `validate_namespace`.
- `dataSources.mainService.uri` = the CAP service path; **no** local `metadata.xml`, **no** `fiori-tools-proxy`, **no** `sap-fe-mockserver`.
- Bootstrap consistent: CDN `src` URL + no `framework:` block in `ui5.yaml` (see CAP serving rule in `fiori-bootstrap/SKILL.md`).
- `dataSources.mainService` must have **no** `localUri` and **no** `annotations` array entry — annotations come from CAP CDS, not a local XML file.

### B.12 — Building block attribute reference

Full attribute tables sourced from the [SAP FPM Explorer](https://ui5.sap.com/test-resources/sap/fe/core/fpmExplorer/fpm/index.html#/buildingBlocks/buildingBlockOverview).
All building blocks share the XML namespace `xmlns:macros="sap.fe.macros"`.

#### `macros:FilterBar`

```xml
<macros:FilterBar
    id="FilterBar"                                            <!-- Required -->
    metaPath="@com.sap.vocabularies.UI.v1.SelectionFields"   <!-- Required -->
    contextPath="/Entity"                                     <!-- Optional: entity set path -->
    readOnly="false"                                          <!-- Optional, default false -->
    showAdaptFilters="true"                                   <!-- Optional, default true -->
    liveMode="false"                                          <!-- Optional; triggers search on every change -->
    filterChanged=".onFiltersChanged"                         <!-- Event: any filter value changes -->
    search=".onSearch"/>                                      <!-- Event: Go/Search button pressed -->
```

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `id` | ✅ | — | Unique ID; referenced by `macros:Table filterBar` |
| `metaPath` | ✅ | — | `@UI.SelectionFields` (optionally `#Qualifier`) |
| `contextPath` | — | inferred | Entity set path; inferred from routing target when omitted |
| `readOnly` | — | `false` | Hides all filter inputs |
| `showAdaptFilters` | — | `true` | Shows the "Adapt Filters" button |
| `liveMode` | — | `false` | Triggers search automatically on every filter value change |
| `filterChanged` | — | — | Event handler; fired whenever any filter value changes |
| `search` | — | — | Event handler; fired when the Go button is pressed |

---

#### `macros:Table`

```xml
<macros:Table
    id="LineItemTable"                                        <!-- Required -->
    metaPath="@com.sap.vocabularies.UI.v1.LineItem"           <!-- Required -->
    contextPath="/Entity"                                     <!-- Optional -->
    filterBar="FilterBar"                                     <!-- Optional: ID of a linked FilterBar -->
    readOnly="false"                                          <!-- Optional, default false -->
    selectionMode="Auto"                                      <!-- Optional: None | Single | Multi | Auto -->
    isSearchable="true"                                       <!-- Optional, default true -->
    variantManagement="None"                                  <!-- Optional: None | Control | Page -->
    showCreate="true"                                         <!-- Optional, default true -->
    showDelete="true"                                         <!-- Optional, default true -->
    header="Table Header"                                     <!-- Optional: table title text -->
    headerVisible="true"                                      <!-- Optional, default true -->
    threshold="30"                                            <!-- Optional: rows pre-fetched -->
    enableAutoScroll="false"                                  <!-- Optional, default false -->
    onChange=".onTableChange"                                 <!-- Event: data changes -->
    onContextChange=".onContextChange"/>                      <!-- Event: binding context changes -->
```

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `id` | ✅ | — | Unique ID |
| `metaPath` | ✅ | — | `@UI.LineItem` (optionally `#Qualifier` or `nav/@UI.LineItem`) |
| `contextPath` | — | inferred | Entity set path |
| `filterBar` | — | — | Must exactly match the `id` of a `macros:FilterBar` |
| `readOnly` | — | `false` | Hides Create/Delete, disables inline edit |
| `selectionMode` | — | `Auto` | `None` · `Single` · `Multi` · `Auto` |
| `isSearchable` | — | `true` | Shows the search input in the toolbar |
| `variantManagement` | — | `None` | `None` · `Control` (table-level) · `Page` (page-level) |
| `showCreate` | — | `true` | Shows the Create button |
| `showDelete` | — | `true` | Shows the Delete button |
| `header` | — | — | Plain string or i18n binding for the table title |
| `headerVisible` | — | `true` | Hides the header row entirely when `false` |
| `threshold` | — | `30` | OData `$top` for the initial fetch |
| `enableAutoScroll` | — | `false` | Scrolls to newly created rows |
| `onChange` | — | — | Event: any row data change |
| `onContextChange` | — | — | Event: binding context switch |

---

#### `macros:Chart`

```xml
<macros:Chart
    id="Chart"                                               <!-- Required -->
    contextPath="/Entity"                                     <!-- Required -->
    metaPath="@com.sap.vocabularies.UI.v1.Chart"             <!-- Required -->
    filterBar="FilterBar"                                     <!-- Optional: ID of a linked FilterBar -->
    selectionMode="Single"                                    <!-- Optional: None | Single | Multiple -->
    selectionChange=".onChartSelectionChanged"                <!-- Event: selection changes -->
    renderCount=".onRenderCount"/>                            <!-- Event: visible data points counted -->
```

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `id` | ✅ | — | Unique ID |
| `contextPath` | ✅ | — | Entity set path (e.g. `/Entity/to_Nav`) |
| `metaPath` | ✅ | — | `@UI.Chart` (optionally `#Qualifier`) |
| `filterBar` | — | — | Links Chart to a FilterBar for coordinated filtering |
| `selectionMode` | — | `None` | `None` · `Single` · `Multiple` |
| `selectionChange` | — | — | Event: called with selected chart data points |
| `renderCount` | — | — | Event: called with count of rendered data points |

> **Library requirement:** Add `sap.chart` and `sap.viz` to `manifest.json` `sap.ui5.dependencies.libs`.

---

#### `macros:Field`

```xml
<macros:Field
    metaPath="ProductID"                                     <!-- Required: property path -->
    id="myField"                                              <!-- Optional -->
    contextPath="/Products"                                   <!-- Optional -->
    readOnly="false"                                          <!-- Optional, default false -->
    semanticObject="Product"                                  <!-- Optional: smart link target -->
    semanticObjectMapping="..."                               <!-- Optional: property → SO mapping -->
    onChange=".onFieldChange"/>                               <!-- Event: value changes -->
```

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `metaPath` | ✅ | — | Property path relative to `contextPath` (e.g. `ProductID`) |
| `id` | — | — | Optional unique ID |
| `contextPath` | — | inferred | Entity set path |
| `readOnly` | — | `false` | Renders as display text (no input) |
| `semanticObject` | — | — | Enables smart link navigation |
| `semanticObjectMapping` | — | — | Maps OData property to semantic object property |
| `onChange` | — | — | Event: new value after user edits |

---

#### `macros:FormContainer` and `macros:FormElement`

```xml
<macros:FormContainer
    id="FormContainer"
    metaPath="@com.sap.vocabularies.UI.v1.FieldGroup#Overview"  <!-- Required; qualifier is mandatory -->
    readOnly="true">                                              <!-- Optional, default false -->
    <macros:FormElement metaPath="ProductID"   label="Product ID"/>
    <macros:FormElement metaPath="ProductName" label="Product Name"/>
</macros:FormContainer>
```

| Element | Attribute | Required | Notes |
|---|---|---|---|
| `FormContainer` | `id` | — | Optional unique ID |
| `FormContainer` | `metaPath` | ✅ | `@UI.FieldGroup#Qualifier` — qualifier is mandatory |
| `FormContainer` | `readOnly` | — | Renders all child fields as display-only |
| `FormElement` | `metaPath` | ✅ | Property path relative to `contextPath` |
| `FormElement` | `label` | — | Overrides the property label from annotations |

---

#### `macros:MicroChart`

```xml
<macros:MicroChart
    id="MicroChart"                                          <!-- Required -->
    metaPath="@com.sap.vocabularies.UI.v1.Chart#Micro"       <!-- Required -->
    contextPath="/Entity"/>                                   <!-- Required -->
```

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `id` | ✅ | — | Unique ID |
| `metaPath` | ✅ | — | `@UI.Chart#Qualifier` — always use a qualifier to distinguish from the main chart |
| `contextPath` | ✅ | — | Entity set path |

> **Library requirement:** Add `sap.suite.ui.microchart` to `manifest.json` `sap.ui5.dependencies.libs`.

---

#### `macros:Paginator`

```xml
<macros:Paginator
    id="Paginator"                                           <!-- Required -->
    contextPath="/Entity"/>                                   <!-- Required -->
```

| Attribute | Required | Default | Notes |
|---|---|---|---|
| `id` | ✅ | — | Unique ID |
| `contextPath` | ✅ | — | Entity set path; navigates between instances of this entity |

> Use `macros:Paginator` inside an Object Page custom section to let users step through records without going back to the list.

---

#### Common patterns

**Link FilterBar → Table → Chart (coordinated view):**
```xml
<macros:FilterBar id="FB" metaPath="@UI.SelectionFields" filterChanged=".onFiltersChanged"/>
<macros:Table id="T" metaPath="@UI.LineItem" filterBar="FB"/>
<macros:Chart id="C" contextPath="/Entity" metaPath="@UI.Chart" filterBar="FB"/>
```

**MicroChart inside a custom column fragment:**
```xml
<macros:MicroChart id="mc" metaPath="@UI.Chart#Spend" contextPath="/Suppliers"/>
```

**Field in a custom Object Page section (display-only):**
```xml
<macros:Field metaPath="StatusCode" readOnly="true"/>
```

**FormContainer for a custom Object Page section:**
```xml
<macros:FormContainer metaPath="@UI.FieldGroup#KeyData" readOnly="false">
    <macros:FormElement metaPath="Priority" label="{i18n>priority}"/>
    <macros:FormElement metaPath="DueDate"  label="{i18n>dueDate}"/>
</macros:FormContainer>
```

---

## Required libraries

Add `sap.fe.macros` (and `sap.fe.core`) on top of the standard FE libs; add `sap.chart`/`sap.viz` if you embed `<macros:Chart>`.

## Hard rules

- **Annotations first.** Only extend when a requirement is genuinely beyond annotations (custom badge, bespoke layout, control not covered by a term).
- **Never call OData actions from controller code** — surface them as `UI.DataFieldForAction`; FE invokes them through its edit flow.
- Fragment/view files live under `webapp/ext/...`; the `template`/`viewName` path is dotted and namespace-prefixed.
- Use `this.getExtensionAPI()` (not raw router/model access) inside FPM controllers so FE stays in control.

## Checklist

Custom section registered under `content.body.sections` with `template` + `position.anchor` (an existing facet `ID`) · fragment under `webapp/ext/` · relative bindings rely on the injected context · macros carry `metaPath` + `contextPath` · `sap.fe.macros` in libs · annotations preferred, extension justified · actions stay as `DataFieldForAction`.
