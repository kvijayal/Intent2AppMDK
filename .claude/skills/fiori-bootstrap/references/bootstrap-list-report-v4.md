*Part of the fiori-bootstrap skill.*

> Full file-by-file walkthrough for a List Report + Object Page app on **OData V4 / RAP**. For the concise Intent2App wiring, see [`list-report-op.md`](list-report-op.md).

# SAP Fiori Elements — List Report Page Bootstrapping Guide
## OData V4 (RAP-Based)

---

## Overview

This guide documents the bootstrapping structure of an SAP Fiori Elements **List Report Page** application built on **OData V4** with an **SAP RAP (RESTful ABAP Programming Model)** backend. It serves as a reusable reference for building similar List Report applications in the future.

### What is Bootstrapping?
Bootstrapping is the process by which the browser loads and initializes the SAPUI5 application — from the HTML page loading in the browser to the List Report page being fully rendered.

### Application Pattern
- **Template**: SAP Fiori Elements List Report Page V4 (`@sap/generator-fiori:lrop`)
- **Backend**: SAP RAP — OData V4
- **Framework**: SAPUI5 with `sap.fe.templates` (no custom XML views or controllers needed)
- **Pages**: List Report Page + Object Page (standard navigation)

---

## Bootstrapping Flow

```
Browser loads index.html
    └── SAPUI5 core (sap-ui-core.js) is loaded with bootstrap attributes
        └── ComponentSupport reads <div data-sap-ui-component>
            └── Component.js is instantiated
                └── manifest.json is read
                    ├── OData V4 model initialized  →  connects to RAP service
                    ├── annotation.xml loaded        →  OData annotation datasource
                    ├── i18n model initialized       →  i18n.properties
                    └── Router initialized
                        ├── List Report target  →  sap.fe.templates.ListReport renders
                        └── Object Page target  →  sap.fe.templates.ObjectPage renders
```

---

## Bootstrapping File Structure

```
webapp/
├── index.html                    → Bootstrap entry point
├── Component.js                  → Root UI5 Component
├── manifest.json                 → App descriptor (datasource, models, routing)
├── annotations/
│   └── annotation.xml            → OData annotation datasource
└── i18n/
    └── i18n.properties           → Resource bundle (app title, labels)
package.json                      → Project setup (dev dependencies, run scripts)
```

---

## File Details

---

### 1. `webapp/index.html`

**Purpose:** The HTML entry point that loads the SAPUI5 framework and mounts the root Component into the DOM. This is where bootstrapping begins.

**Key Bootstrap Attributes:**

| Attribute | Value | Purpose |
|---|---|---|
| `id` | `sap-ui-bootstrap` | Required fixed ID for the SAPUI5 bootstrap script tag |
| `src` | `resources/sap-ui-core.js` | Loads SAPUI5 core from the resources folder |
| `data-sap-ui-theme` | `sap_horizon` | Current SAP standard theme |
| `data-sap-ui-resourceroots` | `{"{APP_NAMESPACE}": "./"}` | Maps app namespace to the webapp root path |
| `data-sap-ui-oninit` | `module:sap/ui/core/ComponentSupport` | Triggers Component mounting on SAPUI5 init |
| `data-sap-ui-compatVersion` | `edge` | Always use `edge` for latest SAPUI5 behavior |
| `data-sap-ui-async` | `true` | Async resource loading — required for performance |
| `data-sap-ui-frameOptions` | `trusted` | Frame embedding security policy |

**Body:**
- `class="sapUiBody sapUiSizeCompact"` — applies SAP body styles and compact content density
- `data-sap-ui-component` div — ComponentSupport reads this to instantiate the Component
- `data-handle-validation="true"` — enables built-in form validation handling

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{APP_TITLE}</title>
    <style>
        html, body, body > div, #container, #container-uiarea {
            height: 100%;
        }
    </style>
    <script
        id="sap-ui-bootstrap"
        src="resources/sap-ui-core.js"
        data-sap-ui-theme="sap_horizon"
        data-sap-ui-resourceroots='{
            "{APP_NAMESPACE}": "./"
        }'
        data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"
        data-sap-ui-compatVersion="edge"
        data-sap-ui-async="true"
        data-sap-ui-frameOptions="trusted"
    ></script>
</head>
<body class="sapUiBody sapUiSizeCompact" id="content">
    <div
        data-sap-ui-component
        data-name="{APP_NAMESPACE}"
        data-id="container"
        data-settings='{"id" : "{APP_NAMESPACE}"}'
        data-handle-validation="true"
    ></div>
</body>
</html>
```

**Placeholders to replace for a new app:**

| Placeholder | Description |
|---|---|
| `{APP_TITLE}` | Application display title shown in the browser tab |
| `{APP_NAMESPACE}` | Full app namespace (e.g., `com.example.myapp`) — must be unique |

---

### 2. `webapp/Component.js`

**Purpose:** Defines the root UI5 Component. It is instantiated by `ComponentSupport` during bootstrap and reads all configuration from `manifest.json`.

**Key Points:**
- Must always extend `sap/fe/core/AppComponent` — **not** `sap/ui/core/UIComponent`
- `sap/fe/core/AppComponent` provides Fiori Elements lifecycle management, OData V4 model handling, and routing integration
- `manifest: "json"` instructs SAPUI5 to load all configuration from `manifest.json`
- No custom `init()` logic is needed for a standard List Report application

```javascript
sap.ui.define(
    ["sap/fe/core/AppComponent"],
    function (Component) {
        "use strict";

        return Component.extend("{APP_NAMESPACE}.Component", {
            metadata: {
                manifest: "json"
            }
        });
    }
);
```

**Placeholders to replace for a new app:**

| Placeholder | Description |
|---|---|
| `{APP_NAMESPACE}` | Must exactly match the namespace defined in `index.html` and `manifest.json` |

---

### 3. `webapp/manifest.json`

**Purpose:** The central application descriptor. Wires the OData V4 datasource, i18n models, routing targets, and FLP integration. Read by `Component.js` during bootstrap.

---

#### 3a. `sap.app` — Application Identity and Data Sources

```json
"sap.app": {
    "id": "{APP_NAMESPACE}",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "applicationVersion": {
        "version": "0.0.1"
    },
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "sourceTemplate": {
        "id": "@sap/generator-fiori:lrop",
        "version": "1.18.4"
    },
    "dataSources": {
        "mainService": {
            "uri": "{ODATA_SERVICE_PATH}",
            "type": "OData",
            "settings": {
                "annotations": ["annotation"],
                "localUri": "localService/mainService/metadata.xml",
                "odataVersion": "4.0"
            }
        },
        "annotation": {
            "type": "ODataAnnotation",
            "uri": "annotations/annotation.xml",
            "settings": {
                "localUri": "annotations/annotation.xml"
            }
        }
    },
    "crossNavigation": {
        "inbounds": {
            "{SEMANTIC_OBJECT}-{ACTION}": {
                "semanticObject": "{SEMANTIC_OBJECT}",
                "action": "{ACTION}",
                "title": "{{{SEMANTIC_OBJECT}-{ACTION}.flpTitle}}",
                "signature": {
                    "parameters": {},
                    "additionalParameters": "allowed"
                }
            }
        }
    }
}
```

**Key points:**
- `odataVersion: "4.0"` — mandatory for all RAP-based services
- `annotations` array value must match the annotation datasource key (`"annotation"`)
- `localUri` under `mainService` — path to the local OData metadata copy used for mock/offline mode
- `crossNavigation.inbounds` — registers the app tile on the SAP Fiori Launchpad

---

#### 3b. `sap.ui` — UI Technology Settings

```json
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
}
```

---

#### 3c. `sap.ui5` — Framework and Routing Configuration

```json
"sap.ui5": {
    "flexEnabled": true,
    "dependencies": {
        "minUI5Version": "{RECOMMENDED_UI5_VERSION}",
        "libs": {
            "sap.m": {},
            "sap.ui.core": {},
            "sap.fe.templates": {}
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
                "bundleName": "{APP_NAMESPACE}.i18n.i18n"
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
                "pattern": ":?query:",
                "name": "{ENTITY_NAME}List",
                "target": "{ENTITY_NAME}List"
            },
            {
                "pattern": "{ENTITY_NAME}({key}):?query:",
                "name": "{ENTITY_NAME}ObjectPage",
                "target": "{ENTITY_NAME}ObjectPage"
            }
        ],
        "targets": {
            "{ENTITY_NAME}List": {
                "type": "Component",
                "id": "{ENTITY_NAME}List",
                "name": "sap.fe.templates.ListReport",
                "options": {
                    "settings": {
                        "contextPath": "/{ENTITY_NAME}",
                        "variantManagement": "Page",
                        "navigation": {
                            "{ENTITY_NAME}": {
                                "detail": {
                                    "route": "{ENTITY_NAME}ObjectPage"
                                }
                            }
                        },
                        "controlConfiguration": {
                            "@com.sap.vocabularies.UI.v1.LineItem": {
                                "tableSettings": {
                                    "type": "ResponsiveTable"
                                }
                            }
                        }
                    }
                }
            },
            "{ENTITY_NAME}ObjectPage": {
                "type": "Component",
                "id": "{ENTITY_NAME}ObjectPage",
                "name": "sap.fe.templates.ObjectPage",
                "options": {
                    "settings": {
                        "contextPath": "/{ENTITY_NAME}",
                        "editableHeaderContent": false
                    }
                }
            }
        }
    }
}
```

**OData V4 Model Settings Explained:**

| Setting | Value | Why |
|---|---|---|
| `operationMode` | `Server` | Filtering and sorting handled server-side — mandatory for RAP |
| `autoExpandSelect` | `true` | FE framework auto-optimizes `$select` and `$expand` in OData requests |
| `earlyRequests` | `true` | Metadata and annotation requests fired early — improves page load time |
| `preload` | `true` | Model is initialized before routing starts |

**Routing Explained:**

| Setting | Value | Why |
|---|---|---|
| List route pattern | `:?query:` | Optional query parameters only — no fixed path segment |
| Object Page route pattern | `{ENTITY_NAME}({key}):?query:` | Key-based navigation to the detail record |
| List template | `sap.fe.templates.ListReport` | Standard FE template — no custom view needed |
| Object Page template | `sap.fe.templates.ObjectPage` | Standard FE template — no custom view needed |
| `variantManagement` | `Page` | Filter bar and table variants saved at page level |
| `tableSettings.type` | `ResponsiveTable` | Standard table; use `GridTable` for large datasets |
| `editableHeaderContent` | `false` | Object Page header is read-only |
| `flexEnabled` | `true` | Required for UI adaptation and key user adaptation |

**sap.fiori section:**

```json
"sap.fiori": {
    "registrationIds": [],
    "archeType": "transactional"
}
```

**Placeholders to replace for a new app:**

| Placeholder | Description |
|---|---|
| `{APP_NAMESPACE}` | Full app namespace |
| `{ODATA_SERVICE_PATH}` | OData V4 service URI (e.g., `/sap/opu/odata4/...`) |
| `{ENTITY_NAME}` | Main RAP entity set name from the service |
| `{SEMANTIC_OBJECT}` | FLP semantic object name |
| `{ACTION}` | FLP action (typically `display`) |

---

### 4. `webapp/annotations/annotation.xml`

**Purpose:** Declares standard OData vocabulary namespace references and links to the RAP service. Registered as a datasource in `manifest.json` and loaded by the OData V4 model during initialization.

**Key Points:**
- For RAP-based services, UI annotations (LineItem, SelectionFields, HeaderInfo, Facets) are defined directly in CDS views on the backend — this file's `<Schema>` section is typically empty
- This file **must exist** — it is declared as a datasource in `manifest.json`. If missing, the OData model initialization fails and the app will not start
- The three standard vocabulary references (Common, UI, Communication) must always be included

```xml
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml">
        <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
    </edmx:Reference>
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
        <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
    </edmx:Reference>
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Communication.xml">
        <edmx:Include Namespace="com.sap.vocabularies.Communication.v1" Alias="Communication"/>
    </edmx:Reference>
    <edmx:Reference Uri="{ODATA_SERVICE_PATH}/$metadata">
        <edmx:Include Namespace="{SERVICE_NAMESPACE}" Alias="SAP__self"/>
    </edmx:Reference>
    <edmx:DataServices>
        <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local">
            <!-- Local UI annotations go here if not already defined in RAP CDS views -->
        </Schema>
    </edmx:DataServices>
</edmx:Edmx>
```

**Placeholders to replace for a new app:**

| Placeholder | Description |
|---|---|
| `{ODATA_SERVICE_PATH}` | Same service path as declared in `manifest.json` |
| `{SERVICE_NAMESPACE}` | OData service namespace from the service `$metadata` |

---

### 5. `webapp/i18n/i18n.properties`

**Purpose:** Resource bundle providing translatable text keys. Referenced by two separate i18n model registrations in `manifest.json` — the `i18n` model (via `bundleName`) and the `@i18n` model (via `uri`). Keys are resolved during app startup.

**Key Points:**
- `appTitle` and `appDescription` are referenced in `manifest.json` via `{{appTitle}}` and `{{appDescription}}`
- The FLP title key pattern must exactly match the crossNavigation inbound key in `manifest.json`
- This file must exist — both i18n model registrations in `manifest.json` point to it

```properties
# Application title — referenced in manifest.json via {{appTitle}}
appTitle={APP_TITLE}

# Application description — referenced in manifest.json via {{appDescription}}
appDescription={APP_DESCRIPTION}

# FLP tile title — key must match the crossNavigation inbound key in manifest.json
{SEMANTIC_OBJECT}-{ACTION}.flpTitle={FLP_TITLE}
```

**Placeholders to replace for a new app:**

| Placeholder | Description |
|---|---|
| `{APP_TITLE}` | Application display name |
| `{APP_DESCRIPTION}` | Short application description |
| `{SEMANTIC_OBJECT}` | Must match crossNavigation inbound in `manifest.json` |
| `{ACTION}` | Must match crossNavigation inbound action in `manifest.json` |
| `{FLP_TITLE}` | Title shown on the Fiori Launchpad tile |

---

### 6. `package.json` — Bootstrapping-Relevant Sections

**Purpose:** Declares the tooling dependencies required to serve the app and the scripts to launch it locally.

**Bootstrapping-relevant devDependencies:**

| Package | Purpose |
|---|---|
| `@ui5/cli` | UI5 tooling — provides `ui5 serve` and `ui5 build` commands |
| `@sap/ux-ui5-tooling` | Provides the `fiori run` command to launch the local dev server |
| `@sap-ux/ui5-middleware-fe-mockserver` | Mock OData server — runs app locally without a real backend |

**Bootstrapping-relevant scripts:**

| Script | Purpose |
|---|---|
| `start` | Launch app against real backend via FLP sandbox |
| `start-mock` | Launch app with generated mock OData data — no backend needed |
| `start-noflp` | Launch app directly via `index.html` without FLP sandbox |

```json
{
    "name": "{APP_ID}",
    "version": "0.0.1",
    "description": "An SAP Fiori application.",
    "keywords": ["ui5", "openui5", "sapui5"],
    "main": "webapp/index.html",
    "dependencies": {},
    "devDependencies": {
        "@ui5/cli": "^4.0.16",
        "@sap/ux-ui5-tooling": "1",
        "@sap-ux/ui5-middleware-fe-mockserver": "2"
    },
    "scripts": {
        "start": "fiori run --open \"test/flp.html#app-preview\"",
        "start-mock": "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",
        "start-noflp": "fiori run --open \"/index.html?sap-ui-xx-viewCache=false\""
    },
    "sapuxLayer": "CUSTOMER_BASE",
    "sapux": true
}
```

> **Note:** Build and deployment dependencies (`ui5-task-zipper`, `mbt`, `rimraf`) and scripts (`build:cf`, `build:mta`, `deploy`, `undeploy`) are covered separately in the Deployment Guide.

**Placeholders to replace for a new app:**

| Placeholder | Description |
|---|---|
| `{APP_ID}` | Short app identifier — lowercase, no namespace (e.g., `myapp`) |

---

## Placeholder Checklist

When creating a new List Report OData V4 RAP app, replace all of these across the bootstrapping files:

| Placeholder | Description | Files |
|---|---|---|
| `{APP_NAMESPACE}` | Full app namespace (e.g., `com.example.myapp`) | `index.html`, `Component.js`, `manifest.json` |
| `{APP_ID}` | Short app name — lowercase, no namespace | `package.json` |
| `{APP_TITLE}` | Application display title | `index.html`, `i18n.properties` |
| `{APP_DESCRIPTION}` | Short application description | `i18n.properties` |
| `{ODATA_SERVICE_PATH}` | Full OData V4 service URI path | `manifest.json`, `annotation.xml` |
| `{ENTITY_NAME}` | RAP entity set name from the service | `manifest.json` |
| `{SERVICE_NAMESPACE}` | OData service namespace from `$metadata` | `annotation.xml` |
| `{SEMANTIC_OBJECT}` | FLP semantic object name | `manifest.json`, `i18n.properties` |
| `{ACTION}` | FLP action — typically `display` | `manifest.json`, `i18n.properties` |
| `{FLP_TITLE}` | Title displayed on the FLP tile | `i18n.properties` |

---

## Standard Patterns — Do Not Change

These are fixed patterns consistent across all List Report OData V4 RAP apps:

| Pattern | Fixed Value | Reason |
|---|---|---|
| Component base class | `sap/fe/core/AppComponent` | Required for Fiori Elements — not `sap/ui/core/UIComponent` |
| OData version | `4.0` | Mandatory for all RAP services |
| Operation mode | `Server` | RAP handles filtering and sorting server-side — never `Client` |
| `autoExpandSelect` | `true` | FE framework auto-optimizes OData requests |
| `earlyRequests` | `true` | Metadata and annotations fetched early for performance |
| `preload` | `true` | Model initialized before routing |
| `flexEnabled` | `true` | Required for UI adaptation |
| `compatVersion` | `edge` | Always use latest SAPUI5 behavior |
| `async` | `true` | Required for performance — never set to `false` |
| `variantManagement` | `Page` | Standard for List Report — page-level variant saving |
| List template | `sap.fe.templates.ListReport` | No custom view or controller needed |
| Object Page template | `sap.fe.templates.ObjectPage` | No custom view or controller needed |
| Theme | `sap_horizon` | Current SAP standard theme |
| Default table type | `ResponsiveTable` | Standard; switch to `GridTable` for large datasets |
| Required libs | `sap.m`, `sap.ui.core`, `sap.fe.templates` | Minimum required for Fiori Elements List Report |
