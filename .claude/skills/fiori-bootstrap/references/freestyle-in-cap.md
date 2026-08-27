*Part of the fiori-app-bootstrapping skill.*

# Freestyle UI5 inside a CAP project

The same TypeScript freestyle app from `freestyle-standalone.md`, but living under a CAP project's `app/` folder and served by **`cds watch`** through the **`cds-plugin-ui5`** plugin. The CAP server hosts both the OData service and the UI5 app on one origin, so there is **no proxy and no mock server** — the app talks to the real in-memory CAP service.

## Where it lives

```
<cap-root>/
├── db/         schema.cds
├── srv/        service.cds + service.js
├── app/
│   └── myfreestyle/
│       ├── package.json        ← REQUIRED for cds-plugin-ui5 discovery
│       ├── ui5.yaml            ← minimal: no framework/server blocks
│       └── webapp/
│           ├── Component.ts
│           ├── index.html
│           ├── manifest.json
│           ├── controller/  view/  model/  i18n/
└── package.json   (CAP root — depends on cds-plugin-ui5)
```

## How serving works

`cds-plugin-ui5` discovers every app folder that has a `ui5.yaml` + `package.json`, builds it through the UI5 tooling (including TypeScript transpile), and mounts it under the CAP server. Run from the CAP root:

```bash
npm install
cds watch        # serves OData at /odata/v4/... AND the UI5 app at /myfreestyle/webapp/
```

## ⚠️ UI5 runtime resources — the bootstrap and `ui5.yaml` MUST agree (the #1 "blank page in CAP" cause)

`cds-plugin-ui5` serves **your app's own files** (`index.html`, `manifest.json`, `Component`, views) and the OData service on one origin — but it does **NOT** serve the **SAPUI5 runtime** (`sap-ui-core.js`, `sap.m`, `sap.fe.*`, the theme) unless you tell it how. Pick **one** of these two consistent setups and never mix them:

| Setup | `index.html` bootstrap `src` | `ui5.yaml` `framework` block | Startup | Notes |
|---|---|---|---|---|
| **A — CDN bootstrap (recommended; matches the reference starter)** | `https://ui5.sap.com/1.120.0/resources/sap-ui-core.js` (absolute CDN URL) | **omit** it | Fast — CAP server starts immediately | Browser pulls UI5 from the SAP CDN. The reference starter uses this. |
| **B — plugin-served runtime** | `resources/sap-ui-core.js` (relative) | **required** — `name: SAPUI5`, `version`, `libraries` | Slow — first run downloads the full SAPUI5 SDK (~1 GB) into `~/.ui5`, and **every** `cds watch` re-validates it | Use only when you need fully offline UI5. |

**The bug to avoid:** a **relative** `src="resources/sap-ui-core.js"` with **NO** `framework` block → the browser requests `/<app>/resources/sap-ui-core.js`, nothing answers → **404 + blank page** (often reported as "sap-ui-core.js not found"). The reference starter pairs the **CDN URL** with **no framework block** — copy that pairing verbatim; do not hand-roll a relative bootstrap.

The UI5 **CDN bootstrap URL is the one allowed hardcoded URL** (it is the framework loader, present in every SAP-generated app and in this workspace's own reference starter); it is **not** a service/data endpoint and does not violate the "no hardcoded URLs" rule. Service `dataSources` stay relative.

The CAP root `package.json` must include the plugin (and the UI5 toolchain it drives):

```jsonc
"devDependencies": {
  "@sap/cds-dk": "^9",
  "cds-plugin-ui5": "^0.16.3",
  "@ui5/cli": "^4",
  "ui5-tooling-transpile": "^3",
  "typescript": "^5"
}
```

## app/myfreestyle/ui5.yaml — minimal form

Inside CAP you **omit the `server` block** (no standalone middleware/proxy). You may also omit the `framework` block **only when `index.html` bootstraps UI5 from the CDN** (Setup A above — what the reference starter does); if `index.html` uses a relative `resources/` bootstrap, the `framework` block becomes **required** (Setup B). Keep only the transpile task so TypeScript still compiles. `metadata.name` is all lowercase and equals the namespace.

```yaml
specVersion: "3.0"
metadata:
  name: myfreestyle          # all lowercase; identical to the namespace
type: application
resources:
  configuration:
    paths:
      webapp: webapp
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        transformModulesToUI5:
          overridesToOverride: true
```

(If the app is plain JavaScript, the `builder` block can be dropped entirely.)

## app/myfreestyle/package.json — required for discovery

`cds-plugin-ui5` will NOT find the app without a `package.json` here. Keep it small; its `name` matches the namespace.

```jsonc
{
  "name": "myfreestyle",
  "version": "1.0.0",
  "main": "webapp/index.html",
  "scripts": {
    "start": "ui5 serve",
    "build": "ui5 build --clean-dest"
  },
  "devDependencies": {
    "@ui5/cli": "^4.0.0"
  }
}
```

## manifest.json — point the data source at the CAP service

Because CAP serves the UI and the service on the same origin, the data source `uri` is the **relative** service path — no proxy/destination needed.

```jsonc
"sap.app": {
  "id": "myfreestyle",
  "type": "application",
  "i18n": "i18n/i18n.properties",
  "dataSources": {
    "mainService": {
      "uri": "/odata/v4/purchaseorder/",
      "type": "OData",
      "settings": { "odataVersion": "4.0" }
    }
  }
}
```

The default OData V4 model block (`operationMode: "Server"`, `autoExpandSelect`, `earlyRequests`, `$auto` group ids) and the routing (`sap.m.routing.Router`, `rootView`, async) are identical to the standalone case — see `freestyle-standalone.md`.

## Component.ts / index.html

Unchanged from standalone: `Component.ts` extends `sap/ui/core/UIComponent` with `IAsyncContentCreation`, sets the device model, calls `getRouter().initialize()`; `index.html` bootstraps via `ComponentSupport` with `resource-roots` `{"myfreestyle": "./"}`. The namespace must be identical across `Component.ts` `@namespace`, manifest `sap.app.id`, `index.html` resource-roots, and `ui5.yaml metadata.name`.

## Differences vs standalone (at a glance)

| Aspect | Standalone | In-CAP |
|---|---|---|
| Dev server | `fiori run` / `ui5 serve` | `cds watch` (cds-plugin-ui5) |
| `ui5.yaml` | full (`framework` + `server` middleware) | minimal: no `server`; `framework` only if relative bootstrap (Setup B) |
| UI5 resources | CDN via `fiori-tools-proxy` | CDN bootstrap URL in `index.html` (Setup A) **or** plugin-served via `framework` block (Setup B) — must match the bootstrap |
| Data | mock (`sap-fe-mockserver`) or proxied backend | real CAP service, same origin |
| Proxy | yes | none |
| Extra file | — | `app/<name>/package.json` mandatory |

## Common errors

- **Blank page + `sap-ui-core.js not found` (404)** → `index.html` uses a relative `resources/sap-ui-core.js` bootstrap but `ui5.yaml` has no `framework` block. Either switch the bootstrap to the CDN URL (Setup A) or add the `framework` block (Setup B) — see the consistency table above. This is the #1 blank-page cause in CAP.
- **`Unable to find source directory 'webapp'`** → missing `app/<name>/package.json`; add it.
- **App not served by `cds watch`** → `ui5.yaml` missing or `metadata.name` invalid (must be lowercase); plugin skips it. Also confirm `cds-plugin-ui5` is in the **CAP root** `devDependencies` and installed — without it `cds watch` serves only OData, not the UI5 app.
- **`failed to load Component.js`** → namespace mismatch across the four places.

## Checklist

App under `app/<name>/` with both `ui5.yaml` (minimal) and `package.json` · plugin `cds-plugin-ui5 ^0.16.3` in CAP root · **bootstrap ↔ `ui5.yaml` consistent** (CDN URL + no framework block, OR relative `resources/` + framework block — never mixed) · no proxy/mock · data source `uri` relative to CAP · `cds watch` serves both · namespace identical in 4 places · `metadata.name` lowercase.
