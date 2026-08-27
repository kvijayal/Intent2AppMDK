---
name: deployment-validation
description: >
  Prescriptive deployment configuration guide for CAP + Fiori apps on SAP BTP — provides
  correct file templates AND validates existing files. Load this skill whenever creating or
  checking mta.yaml, xs-app.json, ui5.yaml, ui5-deploy.yaml, app/package.json, xs-security.json,
  or manifest.json for deployment. Template-first: agents use the templates in
  references/deployment-templates.md to generate correct files from scratch; then run the
  validation workflow to confirm cross-file consistency. Derived from real-world VCleavers
  project analysis with all issues resolved. Keywords: deployment, mta.yaml, xs-app.json,
  ui5.yaml, ui5-deploy.yaml, manifest, xs-security.json, package.json, destination,
  forwardAuthToken, archiveName, sap.cloud.service, npm ci, xsappname, production auth,
  cross-file consistency, deployment ready.
---

# Deployment Validation — Templates + Pre-Flight Checklist

> **Two modes — use both:**
> 1. **Template mode** (generating files) — load `references/deployment-templates.md` and
>    substitute the six identity constants. Every file is correct by construction.
> 2. **Validation mode** (checking existing files) — run the workflow below (Steps 0–5).
>    Every check has a fix snippet. A project passes when zero CRITICALs remain.

---

## The Six Identity Constants

Derive these once from `mta.yaml` + `app/*/webapp/manifest.json`. Every file uses them.

| Constant | Source | Example |
|---|---|---|
| `MTA_ID` | `mta.yaml ID:` (lowercase) | `vcleavers` |
| `APP_ID` | HTML5 module `name:` in mta.yaml = `sap.app.id` in manifest | `project2` |
| `SRV_MODULE` | srv module `name:` | `vcleavers-srv` |
| `BACKEND_DEST` | OData destination `Name:` in `init_data` | `vcleavers-srv-api` |
| `CLOUD_SERVICE` | destination-content `sap.cloud.service:` | `vcleavers` |
| `XSAPPNAME` | `xs-security.json xsappname` (use lowercase = `MTA_ID`) | `vcleavers` |

> **Rule:** `XSAPPNAME` must equal `MTA_ID` (lowercase). Set them to the same value. Case
> mismatch causes silent XSUAA binding failures in some BTP regions.

---

## Template Mode

Load `references/deployment-templates.md` to get ready-to-use templates for every file.
Substitute `{MTA_ID}`, `{APP_ID}`, `{SRV_MODULE}`, `{BACKEND_DEST}`, `{CLOUD_SERVICE}`,
`{XSAPPNAME}` with the actual values. The templates encode all rules — a project built from
them passes the validation workflow below with zero CRITICAL findings.

---

## Validation Mode — Step-by-Step Workflow

### Step 0 — File Presence

```bash
test -f mta.yaml          && echo MTA_OK       || echo MTA_MISSING
test -f xs-security.json  && echo XSSEC_OK     || echo XSSEC_MISSING
find app -name "xs-app.json"     2>/dev/null | head -5
find app -name "ui5.yaml"        2>/dev/null | head -5
find app -name "ui5-deploy.yaml" 2>/dev/null | head -5
find app -name "manifest.json" -path "*/webapp/*" 2>/dev/null | head -5
find app -name "package.json"    2>/dev/null | head -5
```

Every missing file is a CRITICAL finding. Fix by generating from the template in
`references/deployment-templates.md` before proceeding.

---

### Step 1 — Derive the Six Identity Constants

Read `mta.yaml` and the first `app/*/webapp/manifest.json`. Fill in the constants table above.
All subsequent checks reference these constants by name — never re-derive mid-check.

---

### Step 2 — Per-File Checks

#### `mta.yaml`

Quick-scan greps (catch the two most common critical failures first):

```bash
grep -n "forwardAuthToken\|ForwardAuthToken" mta.yaml   # expect ≥ 2 hits
grep -n "existing_destinations_policy"       mta.yaml   # expect all = 'update'
grep -n "npm install"                        mta.yaml   # expect ZERO hits
grep -n "service-name:"                      mta.yaml   # every resource needs one
```

| # | Check | Severity | Correct value |
|---|---|---|---|
| MTA1 | `_schema-version: "3.3"` — quoted string | CRITICAL | `"3.3"` |
| MTA2 | `parameters.deploy_mode: html5-repo` | WARNING | present at top level |
| MTA3 | `parameters.enable-parallel-deployments: true` | WARNING | present at top level |
| MTA4 | `before-all` commands: `npm ci` then `npx cds build --production` — in that order | CRITICAL | see template |
| MTA5 | No `npm install` anywhere in any module's `commands:` | CRITICAL | replace with `npm ci` |
| MTA6 | srv `type: nodejs`, `path: gen/srv` (never `srv/`) | CRITICAL | `gen/srv` |
| MTA7 | srv `build-parameters.builder: npm-ci` | CRITICAL | `npm-ci` |
| MTA8 | srv `provides.srv-api.properties.forwardAuthToken: true` | CRITICAL | must be present |
| MTA9 | srv `provides.srv-api.properties.srv-url: ${default-url}` | CRITICAL | must be present |
| MTA10 | Destination resource `config.HTML5Runtime_enabled: true` | CRITICAL | must be present |
| MTA11 | Destination `init_data` OData entry `HTML5.ForwardAuthToken: true` | CRITICAL | must be present |
| MTA12 | Destination `init_data` OData entry `URL: ~{srv-api/srv-url}` — never hardcoded | CRITICAL | `~{srv-api/srv-url}` |
| MTA13 | Destination resource has `requires: - name: srv-api` | CRITICAL | must be present |
| MTA14 | All `existing_destinations_policy:` values are `update` | CRITICAL | `update` |
| MTA15 | Every `org.cloudfoundry.managed-service` resource has explicit `service-name:` | CRITICAL | see template |
| MTA16 | HTML5 module build commands use `npm ci` not `npm install` | CRITICAL | `npm ci` |
| MTA17 | HTML5 module `build-result: dist` | CRITICAL | `dist` |
| MTA18 | `destination-content` `build-parameters.no-source: true` | CRITICAL | must be present |
| MTA19 | XSUAA resource `parameters.path: ./xs-security.json` | CRITICAL | `./xs-security.json` |
| MTA20 | `description:` is not `"A simple CAP project."` placeholder | WARNING | update to meaningful text |
| MTA21 | `ui5` CDN destination present — points to `https://ui5.sap.com`, no `ForwardAuthToken` | WARNING | see template |
| MTA22 | No `URL:` key inside any `parameters.content.instance.destinations` entry in a `destination-content` module. The GACD only accepts `ServiceInstanceName`+`ServiceKeyName` entries. A `URL:` entry here fails at deploy with `Missing destination property [ServiceInstanceName]`. URL-based destinations (srv-api, ui5) belong in the destination **resource** `config.init_data`. | CRITICAL | move to `init_data` |
| MTA23 | Every URL-based destination in `init_data` must have `ProxyType: Internet` and `Type: HTTP` — without these the HTML5 Runtime cannot classify the destination | CRITICAL | add both properties |

Fix: see `references/deployment-templates.md` § mta.yaml for the complete correct file.

---

#### Root `package.json`

| # | Check | Severity | Correct value |
|---|---|---|---|
| PKG1 | `cds.requires.[production].auth` is `"xsuaa"` — NOT `"dummy"` or `"mocked"`. **Skip if `xs-security.json` does not exist** — project is intentionally using no-auth. | CRITICAL | `"xsuaa"` |
| PKG2 | `name` is lowercase | WARNING | match `MTA_ID` |
| PKG3 | `cds-plugin-ui5` pinned to `0.13.6` or `^0.17.0` (P-04 dual-load fix) | WARNING | `"0.13.6"` |
| PKG4 | If `connectivity` resource in mta.yaml: `cds.requires.[production].connectivity` not `false` | CRITICAL | remove the `false` override |
| PKG5 | `scripts.build` calls `mbt build` | WARNING | present |
| PKG10 | If `cds.requires.db.kind` is `"sqlite"` without a `[production]` override to HANA: `@cap-js/sqlite` must be in `dependencies`, not `devDependencies` — CF sets `NODE_ENV=production` and skips devDependencies at runtime | CRITICAL | move to `dependencies` |

Fix PKG1: `"[production]": { "auth": "xsuaa" }` in `cds.requires`.
Fix PKG10: move `@cap-js/sqlite` from `devDependencies` to `dependencies` in root `package.json`.

---

#### `app/*/package.json`

| # | Check | Severity | Correct value |
|---|---|---|---|
| APKG1 | `name` matches the app folder name exactly | CRITICAL | `{APP_ID}` — e.g. `"project2"` not `"project1"` |
| APKG2 | `name` matches `sap.app.id` in `webapp/manifest.json` | CRITICAL | same as above |
| APKG3 | `scripts.build:cf` calls `ui5 build ... --config ui5-deploy.yaml` | CRITICAL | must be present |
| APKG4 | `devDependencies` includes `ui5-task-zipper` | CRITICAL | required by ui5-deploy.yaml |
| APKG5 | `devDependencies` includes `@ui5/cli` | WARNING | `^4` |
| APKG6 | `devDependencies` includes `@sap/ux-ui5-tooling` | WARNING | `1` |

Fix: see `references/deployment-templates.md` § app/package.json.

---

#### `xs-security.json`

| # | Check | Severity | Correct value |
|---|---|---|---|
| XS1 | `xsappname` equals `MTA_ID` in lowercase | WARNING | `"{MTA_ID}"` |
| XS2 | `tenant-mode: "dedicated"` | WARNING | `"dedicated"` |
| XS3 | No hardcoded credentials anywhere | CRITICAL | n/a |

Fix: see `references/deployment-templates.md` § xs-security.json.

---

#### `app/*/xs-app.json`

Derive the expected OData route source: `^/{BACKEND_DEST}/(.*)$`
e.g. `BACKEND_DEST = vcleavers-srv-api` → source pattern `^/vcleavers-srv-api/(.*)$`

| # | Check | Severity | Correct value |
|---|---|---|---|
| XA1 | Route with source `^/{BACKEND_DEST}/(.*)$` exists | CRITICAL | must be present |
| XA2 | That route `authenticationType: "xsuaa"` | CRITICAL | `"xsuaa"` |
| XA3 | That route `destination: "{BACKEND_DEST}"` | CRITICAL | matches `BACKEND_DEST` |
| XA4 | OData route `csrfProtection: true` | WARNING | `true` for write operations |
| XA5 | Catch-all route exists: `source: "^(.*)$"`, `service: "html5-apps-repo-rt"`, `authenticationType: "xsuaa"` | CRITICAL | must be last route |
| XA6 | Catch-all is the **last** route in the array | CRITICAL | position it last |
| XA7 | `authenticationMethod: "route"` at top level | INFO | `"route"` |
| XA8 | All `destination` values in routes exist in mta.yaml `init_data` | CRITICAL | cross-check names |

Fix: see `references/deployment-templates.md` § xs-app.json.

---

#### `app/*/ui5.yaml`

| # | Check | Severity | Correct value |
|---|---|---|---|
| UY1 | `metadata.name` matches `APP_ID` | CRITICAL | `"{APP_ID}"` |
| UY2 | `metadata.name` matches the app folder name | CRITICAL | same string |
| UY3 | `type: application` | CRITICAL | `application` |
| UY4 | `specVersion: "4.0"` | WARNING | `"4.0"` |
| UY5 | No `framework:` block when bootstrapping from CDN | CRITICAL | omit it |

Fix: see `references/deployment-templates.md` § ui5.yaml.

---

#### `app/*/ui5-deploy.yaml`

| # | Check | Severity | Correct value |
|---|---|---|---|
| UDY1 | `metadata.name` matches `APP_ID` (same as `ui5.yaml`) | CRITICAL | `"{APP_ID}"` |
| UDY2 | `builder.customTasks` includes `ui5-task-zipper` | CRITICAL | must be present |
| UDY3 | `ui5-task-zipper.configuration.archiveName` matches mta.yaml HTML5 module `name:` | CRITICAL | `"{APP_ID}"` → produces `{APP_ID}.zip` |
| UDY4 | `ui5-task-zipper.configuration.additionalFiles` includes `xs-app.json` | CRITICAL | routing config must be in the zip |
| UDY5 | `afterTask: generateCachebusterInfo` on the zipper task | WARNING | correct order |
| UDY6 | `builder.resources.excludes` includes `/test/**` and `/localService/**` | INFO | keep dist clean |

Fix: see `references/deployment-templates.md` § ui5-deploy.yaml.

---

#### `app/*/webapp/manifest.json`

| # | Check | Severity | Correct value |
|---|---|---|---|
| MAN1 | `sap.app.id` matches `APP_ID` | CRITICAL | `"{APP_ID}"` |
| MAN2 | `sap.cloud.service` matches `CLOUD_SERVICE` | CRITICAL | `"{CLOUD_SERVICE}"` |
| MAN3 | OData `dataSource uri` uses relative path — destination-prefixed URIs must NOT start with `/` | CRITICAL | `"{BACKEND_DEST}/odata/v4/{service}/"` (no leading slash) |
| MAN4 | OData model settings include `operationMode: "Server"`, `autoExpandSelect: true`, `earlyRequests: true` (V4) | WARNING | all three must be present |
| MAN5 | `minUI5Version` >= `"1.120"` | WARNING | `"1.144.1"` or higher |
| MAN6 | `sap.ui5.flexEnabled: true` | WARNING | `true` |

Fix: see `references/deployment-templates.md` § manifest.json.

---

### Step 3 — Cross-File Consistency (most deployments break here)

Run after all per-file checks. These are the silent killers — everything compiles fine but
the app returns 404 or blank page after deploy.

| # | What must match | Files | Severity |
|---|---|---|---|
| XFC1 | `ui5-deploy.yaml archiveName` + `.zip` = mta.yaml `artifacts[]` entry | ui5-deploy.yaml ↔ mta.yaml | CRITICAL |
| XFC2 | `manifest.json sap.cloud.service` = mta.yaml destination-content `sap.cloud.service` | manifest ↔ mta.yaml | CRITICAL |
| XFC3 | `manifest.json sap.app.id` = `ui5.yaml metadata.name` = `ui5-deploy.yaml metadata.name` = mta.yaml HTML5 module `name:` = app folder name = app `package.json name` | 5 files | CRITICAL |
| XFC4 | `xs-app.json` OData route `destination` = mta.yaml `init_data` destination `Name:` | xs-app.json ↔ mta.yaml | CRITICAL |
| XFC5 | `manifest.json dataSources uri` path prefix = `xs-app.json` OData route source path prefix | manifest ↔ xs-app.json | CRITICAL |
| XFC6 | mta.yaml destination-content `ServiceInstanceName` = resource `service-name` for each service | mta.yaml modules ↔ resources | CRITICAL |
| XFC7 | `xs-security.json xsappname` (lowercase) = `MTA_ID` | xs-security.json ↔ mta.yaml | WARNING |
| XFC8 | mta.yaml HTML5 module `path:` = `app/{APP_ID}` | mta.yaml | CRITICAL |
| XFC9 | mta.yaml app-content `build-parameters.requires[].name` lists every HTML5 module | mta.yaml | CRITICAL |

---

### Step 4 — External Service Checks (conditional — skip unless remote services detected)

**Run this step only if `cds.requires` in `package.json` contains entries other than `db` and `auth`.** Detection:
```bash
node -e "const r=require('./package.json').cds?.requires||{}; const skip=['db','auth']; const ext=Object.keys(r).filter(k=>!skip.includes(k)); console.log(ext.length?'EXTERNAL:'+ext:'SKIP_STEP4')"
```
If output is `SKIP_STEP4`, mark this step **N/A — no remote services configured** and proceed to Step 5.

| # | Check | Severity |
|---|---|---|
| EXT1 | External service `kind` is `odata-v2` or `odata-v4` — correct for the actual service | WARNING |
| EXT2 | EDMX/CDS stub file exists at the `model:` path | CRITICAL |
| EXT3 | On-premise service: `connectivity` resource bound in mta.yaml; `[production].connectivity` NOT `false` | CRITICAL |
| EXT4 | Handler uses `cds.connect.to('SERVICE_NAME')` — not raw `fetch`/`axios` | WARNING |
| EXT5 | V2 services: `csrf: true` and `csrfInBatch: true` set in `cds.requires` | WARNING |

---

### Step 5 — Output

```
## Deployment Readiness Report
Identity: MTA_ID={} · APP_ID={} · BACKEND_DEST={} · CLOUD_SERVICE={}

### ❌ CRITICAL  (must fix before mbt build)
[rule#] description — File: ... Fix: exact snippet

### ⚠️  WARNING  (fix before production go-live)
[rule#] description — File: ... Fix: exact snippet

### ✅ PASSED  (N checks)

### Deploy commands (when all CRITICALs clear)
mbt build --mtar {MTA_ID}.mtar --platform cf
cf deploy mta_archives/{MTA_ID}.mtar --retries 1
cf update-service {MTA_ID}-auth -c xs-security.json   # after xs-security changes
```

---

## Quick Reference — Silent-Killer Antipatterns

| Antipattern | Symptom after deploy | Fix |
|---|---|---|
| `app/package.json name` ≠ folder name | Namespace broken — app never loads | Match to `{APP_ID}` |
| `[production].auth: "dummy"` | All OData calls return 401 | Change to `"xsuaa"` |
| `npm install` in mta.yaml commands | Non-deterministic build | Replace with `npm ci` |
| Missing `service-name` on any resource | `destination-content` binding breaks on re-deploy | Add explicit `service-name` |
| `xs-app.json` not in `ui5-deploy.yaml additionalFiles` | HTML5 Runtime has no route config — 404 everywhere | Add `xs-app.json` to `additionalFiles` |
| `sap.cloud.service` mismatch | HTML5 Runtime cannot associate app with service instance | Align both to `CLOUD_SERVICE` |
| `ui5-deploy.yaml archiveName` ≠ mta.yaml `artifacts` entry | `mbt build` cannot find the zip | Align both to `{APP_ID}` |
| `manifest dataSources uri` prefix ≠ `xs-app.json` source path | All OData requests 404 in deployed app | Align both to `/{BACKEND_DEST}/...` |
| `xsappname` case mismatch | Silent XSUAA binding failure in some BTP regions | Lowercase — match `MTA_ID` |
| `connectivity: false` in `[production]` for on-premise service | CAP cannot reach Cloud Connector | Remove the `false` override |
| No `forwardAuthToken` in srv provides AND destination | RBAC returns 403 for every request | Add to both places |
| `URL:` entry inside `destination-content` module `parameters.content` | Deploy fails: `Missing destination property [ServiceInstanceName]` — adding `Type`/`ProxyType` does NOT fix it, wrong location | Move to destination resource `config.init_data`; add `requires: - name: srv-api` to the resource |
| URL-based `init_data` destination missing `Type: HTTP` / `ProxyType: Internet` | HTML5 Runtime cannot classify the destination → 502 routing failure | Add `Type: HTTP` and `ProxyType: Internet` to the entry |
| `@cap-js/sqlite` in `devDependencies` when SQLite is the production DB | `Cannot find module '@cap-js/sqlite'` → crash on CF startup (MODULE_NOT_FOUND) | Move to `dependencies` |
| CSV seed UUIDs missing version/variant bits | `Element "ID" does not contain a valid UUID` → 400 on every OData read; table seeds as empty | UUID v4 requires position 13 = `4` and position 17 = `8/9/a/b` — e.g. `00000000-0000-4000-8000-000000000001` |
