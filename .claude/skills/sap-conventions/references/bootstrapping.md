# Bootstrapping — Working Configs per App Type

Exact, runnable configs for each Intent2App app type, adapted from the real reference apps in this
workspace (`project1` — freestyle UI5 TypeScript; `purchaseOrder` — CAP + Fiori Elements).
**CAP layer:** scaffold with `cds init <app> --add nodejs,sqlite,hana` (primary — see §A); fall back
to `mcp__intent2app__scaffold_app` (copies a starter from `reference-apps/`) only if the CDS CLI is
unavailable. **UI layer:** scaffold with the Fiori (Yeoman) generator, unchanged. After any scaffold
run `validate_namespace` and `run_checks`. Versions: `@sap/cds ^10`, `@cap-js/sqlite ^3`,
`@cap-js/hana ^3`, `@ui5/cli ^4`, `cds-plugin-ui5 ^0.17.0`,
`@sap-ux/ui5-middleware-fe-mockserver 2`, OData V4, theme `sap_horizon`.

> **UI5 version — always resolve dynamically.** Call `mcp__intent2app__ui5_get_version_info` at the
> start of every UI build session and store the result as `{RECOMMENDED_UI5_VERSION}`. Replace every
> occurrence of `{RECOMMENDED_UI5_VERSION}` in `manifest.json` (`minUI5Version`) and `index.html`
> (CDN `src` URL) with the resolved value. Reference apps in `reference-apps/` contain a static
> baseline version as a placeholder — it is **always overwritten** at scaffold time. Never ship a
> generated app with the baseline version unchanged.

## The namespace 4-place rule (applies to every app type)

Identical namespace in: `Component.(js|ts)` (`extend`/`@namespace`), `manifest.json` `sap.app.id`,
`index.html` resource-roots, and `ui5.yaml` `metadata.name` (**all lowercase**). Mismatch →
`failed to load Component.js`. Run `validate_namespace` after scaffold and after any edit to these.

---

## Known Bootstrap Pitfalls

These issues cause a blank page or `FUTURE FATAL` error with no obvious stack trace. Check each
one before debugging anything else.

### P-01 · Manifest v2 routing targets use deprecated `viewName`

**Symptom:** `[FUTURE FATAL] sap.ui5/routing/targets/viewName is deprecated and not supported with
manifest version 2. Use the option 'name' instead` — component fails to load, page is blank.

**Cause:** When `_version` is set to `"2.0.0"` in `manifest.json`, all routing target properties
were renamed. Using the old v1 names causes the Router to throw a fatal error during init.

**Fix — rename every routing target property:**

| Manifest v1 (deprecated in v2) | Manifest v2 (required) |
| --- | --- |
| `viewName` | `name` |
| `viewId` | `id` |
| `viewLevel` | `level` |
| `viewType` | `type` |

```jsonc
// ❌ Breaks with _version 2.0.0
"routing": {
  "config": { "routerClass": "sap.m.routing.Router" },
  "targets": {
    "Main": { "viewName": "com.myapp.view.Main", "viewId": "Main", "viewLevel": 1 }
  }
}

// ✅ Correct for _version 2.0.0
// viewType MUST be in routing.config (global default) — the router cannot infer
// the view technology (XML/JS/HTML) from the target "type": "View" alone.
"routing": {
  "config": { "routerClass": "sap.m.routing.Router", "viewType": "XML" },
  "targets": {
    "Main": { "name": "com.myapp.view.Main", "id": "Main", "level": 1, "type": "View" }
  }
}
```

> **Rule:** Any time you set `"_version": "2.0.0"` (or `minUI5Version ≥ 1.120`), audit ALL
> routing targets and replace every `view*` property with its unprefixed v2 equivalent.
> Also add `"viewType": "XML"` to `routing.config` — without it the router throws
> `No view type specified` even when `"type": "View"` is set on the target.
> Run `ui5lint` — it flags the deprecated property names as errors.

---

### P-02 · `@cap-js/sqlite` version mismatch with CDS 9

**Symptom:** `Failed loading service implementation from @cap-js/sqlite` on `cds watch` start.

**Cause:** `@cap-js/sqlite@1.x` has peer `@sap/cds ">=7.6 <9"` — it does NOT support CDS 9.

**Fix:** Use `@cap-js/sqlite@^2.1.0` which has peer `@sap/cds ">=9"` (no upper bound) and
requires no extra dependencies (2.2.x+ requires `sql.js`).

```json
"dependencies": {
  "@sap/cds": "^9",
  "@cap-js/sqlite": "^2.1.0"
}
```

> **Rule:** Always pin `@cap-js/sqlite` to the same major generation as `@sap/cds`:
> CDS 7–8 → `^1`, CDS 9 → `^2.1.x`, CDS 10 → `^3`.

---

### P-03 · Basic Auth dialog never appears in the browser for `fetch()` calls

**Symptom:** The app loads, but clicking any action button silently fails with 401. No browser
login dialog appears.

**Cause:** CAP's `basic-auth` middleware only sends `WWW-Authenticate` when `login_required: true`
is configured. Without it, anonymous requests pass through (`next()`) and the 401 comes from
CAP's authorization layer — without the `WWW-Authenticate` header that triggers the browser dialog.
The `fetch()` API never auto-prompts for credentials; only top-level page navigation does.

**Fix for local development:** Use `kind: "dummy"` which sets `req.user = privileged` (bypasses
all auth checks) — no login required at all.

```json
// .cdsrc.json
{
  "requires": {
    "auth": { "kind": "dummy" }
  }
}
```

```json
// package.json cds section
"auth": {
  "kind": "ias",
  "[development]": { "kind": "dummy" }
}
```

> **Rule:** Never use `kind: "mocked"` or `kind: "basic"` without also setting
> `login_required: true` unless you have a dedicated login page. For pure local dev
> with no login UI, always use `kind: "dummy"`.

---

### P-04 · `@sap/cds` loaded from two locations (dual-install conflict)

**Symptom:**
```
ERROR: @sap/cds was loaded from different locations:
  ~\<project>\node_modules\@sap\cds
  ~\AppData\Roaming\npm\node_modules\@sap\cds-dk\node_modules\@sap\cds
Ensure a single install to avoid hard-to-resolve errors.
```
`cds watch` may still start, but runtime behaviour is unpredictable (handler registration misses, draft actions silently fail, type-check errors on `cds.Service`).

**Cause:** `cds-plugin-ui5` or `@sap/ux-ui5-tooling` (in the Fiori app's `package.json`) pulls in its own transitive copy of `@sap/cds` that differs from the version in the CAP root. Node resolves both, and the CAP framework detects the split.

**Fix — pin both packages to versions compatible with your CDS major:**

1. **Root `package.json`** — pin `cds-plugin-ui5` to a known-good patch:
   ```json
   "devDependencies": {
     "cds-plugin-ui5": "0.13.6"
   }
   ```

2. **`app/<appname>/package.json`** — pin `@sap/ux-ui5-tooling` to a known-good patch:
   ```json
   "devDependencies": {
     "@sap/ux-ui5-tooling": "1.22.0"
   }
   ```

3. Delete `node_modules` at both levels and re-run `npm install` from the CAP root.

**Verified working combination (CDS 10 / Node 22):**

| Package | Version |
|---------|---------|
| `@sap/cds` | `^10` |
| `@cap-js/hana` | `^3` |
| `@cap-js/sqlite` | `^3` |
| `cds-plugin-ui5` | `0.13.6` |
| `@sap/ux-ui5-tooling` | `1.22.0` |
| Node.js | `>=22` |

> **Rule:** When upgrading `@sap/cds` to a new major, always re-pin `cds-plugin-ui5` and `@sap/ux-ui5-tooling` to their latest patch releases and verify the dual-load error is gone before starting development. The `npm ls @sap/cds` command will show multiple entries if the conflict exists.

---

## A. CAP service init

**Primary method — `cds init --add`.** Scaffold with the CDS CLI so dependency majors are matched to
the installed `@sap/cds-dk` automatically (no stale pins, no `@cap-js/sqlite` peer-dep conflict, no
unwanted `workspaces`):

```bash
cds init <app> --add nodejs,sqlite,hana   # db/ srv/ package.json with version-matched deps
cd <app>
# model + service + handlers + annotations
#   db/schema.cds  srv/service.cds  srv/service.js  srv/annotations.cds
cds watch --in-memory            # serves service + app same-origin at http://localhost:4004
cds compile '*' --to serviceinfo # list service URLs / entity sets
```

Root `package.json` produced by `cds init --add nodejs,sqlite,hana` on the CDS 10 toolchain
(verified against `empapp-poc`):

```json
{
  "name": "<app>", "version": "1.0.0", "type": "module", "private": true,
  "scripts": { "start": "cds-serve" },
  "dependencies": { "@sap/cds": "^10", "@cap-js/hana": "^3" },
  "devDependencies": { "@cap-js/sqlite": "^3" }
}
```

> `cds init` sets **`"type": "module"`** — write `srv/*.js` handlers as ESM
> (`export default (srv) => { … }`), not CommonJS (`module.exports = cds.service.impl(...)`).
> `@sap/cds-dk` is used from the global install; add it locally (`^10`) only if a project-pinned
> CLI is required. `cds-plugin-ui5` is added later by the Fiori UI generator, not by `cds init`.

> **Fallback only (last resort):** if the CDS CLI is unavailable, copy the matching starter from
> `reference-apps/` (`mcp__intent2app__scaffold_app`) and bump its dependency majors to match the
> installed CDS. This applies to the **CAP layer only** — the UI layer is always scaffolded by the
> Fiori (Yeoman) generator.

> If you hit `Cannot find module 'es-errors/type'` on Node 25, pin `express` to `4.18.3` and add
> `es-errors: ^1` to dependencies (see `Troubleshooting.md`).

---

## B. CAP + Fiori Elements (List Report + Object Page)

App lives under `app/<appname>/`, served by `cds watch` (cds-plugin-ui5) — **no proxy, same origin.**

**`app/<appname>/ui5.yaml` — minimal (no `framework`/`server` blocks):**

```yaml
specVersion: '3.0'
metadata:
  name: <appname>          # lowercase; e.g. purchaseorderlist
type: application
resources:
  configuration:
    paths:
      webapp: webapp
```

**`app/<appname>/package.json` — required for cds-plugin-ui5 discovery:**

```json
{
  "name": "<appname>", "version": "1.0.0", "main": "webapp/index.html",
  "scripts": { "start": "ui5 serve", "build": "ui5 build --clean-dest" },
  "devDependencies": { "@ui5/cli": "^4.0.0" }
}
```

**`webapp/manifest.json` — routing + data source (from `purchaseOrder`):**

```jsonc
"sap.app": {
  "id": "<ns>",
  "dataSources": {
    "mainService": { "uri": "/odata/v4/<service>/", "type": "OData",
      "settings": { "odataVersion": "4.0" } }
  }
},
"sap.ui5": {
  "models": {
    "": { "dataSource": "mainService", "type": "sap.ui.model.odata.v4.ODataModel",
      "settings": { "operationMode": "Server", "autoExpandSelect": true,
        "earlyRequests": true, "groupId": "$auto", "updateGroupId": "$auto" } },
    "i18n": { "type": "sap.ui.model.resource.ResourceModel",
      "settings": { "bundleName": "<ns>.i18n.i18n" } }
  },
  "routing": {
    "routes": [
      { "name": "EntityList",   "pattern": ":?query:",             "target": "EntityList" },
      { "name": "EntityDetail", "pattern": "Entity({key}):?query:", "target": "EntityDetail" }
    ],
    "targets": {
      "EntityList": { "type": "Component", "id": "EntityList", "name": "sap.fe.templates.ListReport",
        "options": { "settings": { "contextPath": "/Entity", "variantManagement": "Page",
          "initialLoad": "Enabled",
          "controlConfiguration": { "@com.sap.vocabularies.UI.v1.LineItem": {
            "tableSettings": { "type": "ResponsiveTable", "selectionMode": "Multi" } } },
          "navigation": { "Entity": { "detail": { "route": "EntityDetail" } } } } } },
      "EntityDetail": { "type": "Component", "id": "EntityDetail", "name": "sap.fe.templates.ObjectPage",
        "options": { "settings": { "contextPath": "/Entity", "editableHeaderContent": false } } }
    }
  },
  "dependencies": { "minUI5Version": "{RECOMMENDED_UI5_VERSION}", "libs": {
    "sap.ui.core": {}, "sap.m": {}, "sap.fe.core": {}, "sap.fe.templates": {},
    "sap.fe.macros": {}, "sap.uxap": {}, "sap.ui.layout": {} } }
}
```

`Component.js` extends `sap/fe/core/AppComponent`. Annotations go in `srv/annotations.cds`
(`contextPath` always, never `entitySet`). Run via `npm run watch-listreportapp`. See `reference-apps/cap-fullstack-listreport/`.

---

## C. Freestyle UI5 standalone (TypeScript)

Mirrors `project1`: `fiori-tools-proxy` (UI5 CDN + backend) + `ui5-tooling-transpile` for TS.

**`package.json` (from `project1`):**

```json
{
  "name": "<appname>", "version": "0.0.1", "main": "webapp/index.html",
  "scripts": {
    "start": "fiori run --open \"test/flp.html#app-preview\"",
    "start-mock": "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",
    "build": "ui5 build --config=ui5.yaml --clean-dest --dest dist",
    "lint": "eslint ./", "ts-typecheck": "tsc --noEmit", "prestart": "npm run ts-typecheck",
    "unit-test": "fiori run --config ./ui5-mock.yaml --open \"test/unit/unitTests.qunit.html\"",
    "int-test":  "fiori run --config ./ui5-mock.yaml --open \"test/integration/opaTests.qunit.html\""
  },
  "devDependencies": {
    "@ui5/cli": "^4.0.33", "@sap/ux-ui5-tooling": "1",
    "@sap-ux/eslint-plugin-fiori-tools": "^9.0.0", "eslint": "^9",
    "@sapui5/types": "~1.146.0", "ui5-tooling-transpile": "^3.10.0",
    "typescript": "^5.9.3", "@sap-ux/ui5-middleware-fe-mockserver": "2"
  }
}
```

**`ui5.yaml` (from `project1` — proxy UI5 from CDN + transpile TS):**

```yaml
specVersion: "4.0"
metadata:
  name: <appname>          # lowercase
type: application
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ignoreCertErrors: false
        ui5:
          path: [/resources, /test-resources]
          url: https://ui5.sap.com
        backend:
          - path: /<servicePath>            # e.g. /V4 ; real backend URL or BAS destination
            url: https://<backend-host>
    - name: fiori-tools-appreload
      afterMiddleware: compression
      configuration: { port: 35729, path: webapp, delay: 300 }
    - name: fiori-tools-preview
      afterMiddleware: fiori-tools-appreload
      configuration: { flp: { theme: sap_horizon } }
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        debug: true
        transformModulesToUI5: { overridesToOverride: true }
        excludePatterns: [/Component-preload.js]
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        debug: true
        transformModulesToUI5: { overridesToOverride: true }
```

**`index.html` — ComponentSupport bootstrap (no inline init script; CSP-safe):**

```html
<script id="sap-ui-bootstrap"
  src="resources/sap-ui-core.js"
  data-sap-ui-theme="sap_horizon"
  data-sap-ui-resource-roots='{"<ns>": "./"}'
  data-sap-ui-on-init="module:sap/ui/core/ComponentSupport"
  data-sap-ui-compat-version="edge" data-sap-ui-async="true"
  data-sap-ui-frame-options="trusted"></script>
<!-- body -->
<div data-sap-ui-component data-name="<ns>" data-id="container"
     data-settings='{"id": "<ns>"}' data-handle-validation="true"></div>
```

**`webapp/Component.ts` (from `project1`):**

```typescript
import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";

/** @namespace <ns> */
export default class Component extends BaseComponent {
  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"]
  };
  public init(): void {
    super.init();
    this.setModel(createDeviceModel(), "device");
    this.getRouter().initialize();
  }
}
```

Run: `npm run start-mock` (offline) or `npm start` (proxy to backend). See `reference-apps/freestyle-ui5-ts/`.

---

## D. Freestyle UI5 inside CAP

Same freestyle app placed under `<cap-root>/app/<appname>/`, served by `cds watch` (cds-plugin-ui5)
— **no `fiori-tools-proxy`, no `ui5-mock.yaml`**, because the CAP service is same-origin. Use the
**minimal `ui5.yaml`** and `package.json` from section B, but `Component` extends
`sap/ui/core/UIComponent` (freestyle) and you keep your own XML views/controllers. Run with
`cds watch --in-memory` from the CAP root. See `reference-apps/freestyle-in-cap/`.

---

## E. External-service-bound app (mock + proxy, both)

Bound to a RAP / existing OData service via its EDMX. **Policy: always generate both** an offline
mock and a real-backend proxy, and flip with npm scripts (exactly how `project1` does it).

1. **Manifest data source** points at the consumed service with a `localUri` for the mock:

```jsonc
"dataSources": {
  "mainService": { "uri": "/<servicePath>/", "type": "OData",
    "settings": { "localUri": "localService/mainService/metadata.xml", "odataVersion": "4.0" } } }
```

2. **Mock — `ui5-mock.yaml`** adds `sap-fe-mockserver` (from `project1`, on top of the section C middleware):

```yaml
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /<servicePath>
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: true
        annotations: []
```

3. **Proxy — `ui5.yaml`** carries the `fiori-tools-proxy` `backend` block from section C
   (`path: /<servicePath>`, `url:` real host in VS Code, or `destination:` in BAS).

4. **Scripts:** `start:mock` → `--config ./ui5-mock.yaml`; `start:proxy` / `start` → `ui5.yaml`.

`mcp__intent2app__gen_mock_from_edmx` writes the metadata + sample data + `ui5-mock.yaml`;
`configure_service` writes the manifest data source + proxy/approuter/mta snippets. See
`reference-apps/fiori-elements-external-service/` and the `cap-integration` skill.

---

## Post-scaffold checklist

`validate_namespace` (4 places identical, lowercase `ui5.yaml` name) · `contextPath` not `entitySet`
· theme `sap_horizon` · V4 model settings · async routing + `IAsyncContentCreation` · i18n for all
labels · `npm install` · run (CAP `cds watch --in-memory`; freestyle/external `start-mock` /
`start`) · `run_checks` (CAP: `cds build`/`npm test`; UI5: `ui5lint`/tests/`tsc --noEmit`).
