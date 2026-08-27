---
name: application-sanity-check
description: >
  Technical sanity checklist for a generated Intent2App project — run after the build agents
  complete and before coverage verification or review. Verifies the project compiles, the
  namespace is consistent, Fiori manifest and ui5lint pass, auth annotations are present on
  every entity, no console.log or hardcoded secrets exist in source, CSV seed data uses
  valid UUIDs, the app starts cleanly at runtime (cds watch smoke test), dev auth kind is
  dummy, watch script --open path matches the ui5.yaml metadata.name, manifest dataSources
  URI matches the lowercase-derived CAP service path, manifest dataSources URIs that include
  a destination prefix must NOT start with / (leading slash = Workzone OData 404),
  i18n supportedLocales includes en, and every CollectionPath entity referenced in
  annotations.cds is declared inside the service block.
  Load at STEP 8.1 (checks 1–4 only) and STEP 8.3 (all 17 checks) of the /intent flow. Keywords: sanity check, build validation, cds build,
  validate_namespace, ui5lint, @restrict, @requires, console.log, hardcoded URL, CSV UUID,
  cds watch, runtime, OData metadata, sanity, pre-review check, dummy auth, mocked auth,
  --open path, manifest URI, service path, relative URI, destination prefix, leading slash,
  Workzone, managed approuter, GUID app context, supportedLocales, i18n, en locale, CollectionPath,
  value help entity, service block, OData endpoint, 404 value help.
---

# Sanity Check — Technical Build Validation

Run these checks in order after the build agents complete. Fix any failure before proceeding to
coverage verification (STEP 8.5) or review (STEP 9). Each check maps to the tool or grep pattern
to use.

---

## 1. CDS Build

**Tool:** `mcp__intent2app__run_checks` on `<app>/`

**Pass:** `cds build --production` exits 0, no errors in output.

**Fail action:** Re-spawn `cap-developer` with the exact error output.

---

## 2. Namespace Consistency

**Tool:** `mcp__intent2app__validate_namespace` on the UI app folder.

**Pass:** Namespace is identical in all four places — `Component.(js|ts)`, `manifest.json sap.app.id`, `index.html data-sap-ui-resource-roots`, `ui5.yaml metadata.name` (lowercase).

**Fail action:** Re-spawn `fiori-developer` with the exact mismatch.

---

## 3. Fiori Manifest Validation *(Fiori Elements and Freestyle apps only)*

**Tool:** `mcp__intent2app__ui5_run_manifest_validation` on the app folder.

**Pass:** No errors. Warnings are acceptable but must be noted.

**Fail action:** Re-spawn `fiori-developer` with the validation output.

---

## 4. UI5 Lint *(Fiori Elements and Freestyle apps only)*

**Tool:** `mcp__intent2app__ui5_run_ui5_linter` on the app folder.

**Pass:** No ERRORS (exit 0). Warnings noted but do not block.

**Fail action:** Re-spawn `fiori-developer` with the linter output.

---

## 4a. No Deprecated `synchronizationMode` in OData V4 Model Settings

**Why:** `"synchronizationMode"` was removed from the OData V4 model in UI5 1.110+. Any occurrence causes the UI5 linter to emit a deprecation error. It has no effect even in older versions and must never appear in generated manifests.

**Pattern:**

```bash
grep -rn "synchronizationMode" app/*/webapp/manifest.json
```

**Pass:** No results.

**Fail condition:** Any `manifest.json` contains the string `synchronizationMode`.

**Auto-fix (no user prompt):** Delete the `"synchronizationMode"` key and its value from the OData model `settings` block in `manifest.json`. Do not change any surrounding settings.

---

## 5. Auth Annotations Present on Every Service and Entity

**Pattern:** Grep `srv/` for any `service ` declaration missing `@(requires:` and any `entity ` projection missing `@(restrict:`.

```
# Services must have @requires
grep -rn "^service " srv/ | grep -v "@(requires:"

# Entity projections must have @restrict (writable ones)
grep -rn "as projection on" srv/ | grep -v "@(restrict:"
```

**Pass:** No results from either grep (every service and writable entity is annotated).

**Fail action:** Re-spawn `cap-developer` listing the missing annotations.

---

## 6. No `console.log` in Production Source

**Pattern:** Grep `srv/` for `console.log`.

```
grep -rn "console\.log" srv/
```

**Pass:** No results.

**Fail action:** Re-spawn `cap-developer` to replace with `cds.log()`.

---

## 7. No Hardcoded URLs or Secrets

**Pattern:** Grep source files for common patterns.

```
grep -rn "http://" srv/ app/
grep -rn "https://" srv/ app/ --include="*.js" --include="*.ts" --include="*.cds"
grep -rn -i "password\|secret\|apikey\|api_key\|token" srv/ app/ --include="*.js" --include="*.ts"
```

**Pass:** No results that are actual credentials (ignore comments and documentation strings).

**Fail action:** Re-spawn the relevant developer to move values to environment variables or the Destination service.

---

## 8. CSV Seed Data — Valid UUIDs

**Pattern:** Grep `db/data/` for any ID column value that is NOT UUID format.

```
grep -rn "^[^,]*," db/data/ | grep -v "[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}"
```

Check all `ID` and `*_ID` (foreign key) columns contain valid UUID strings — not short strings like `01`, `lv-01`, `cat-01`. See `cap-schema` for the readable UUID pattern.

**Pass:** All ID values match UUID format.

**Fail action:** Re-spawn `cap-developer` to regenerate CSVs with valid UUID seed data.

---

## 9. Draft Configuration *(if any FE create/edit flow exists)*

**Pattern:** For every entity exposed in a Fiori Elements app that has create or edit navigation, confirm `@odata.draft.enabled` is present on the service projection.

```
grep -rn "odata.draft.enabled" srv/
```

**Pass:** Present on every entity that feeds a Fiori Elements object page with edit capability.

**Fail action:** Re-spawn `cap-developer` to add the annotation; re-spawn `fiori-developer` if the manifest navigation also needs updating.

---

## 10. Value Help Completeness *(if any field has a constrained vocabulary)*

**When to run:** Any time the Requirement Register lists a plant/material/cost-centre/status search
help, OR the view XML contains `showValueHelp="true"` on any input.

**Pattern:** For every field with a value help:

1. Confirm a CAP function that returns the value list is declared in `srv/*.cds`:
   ```
   grep -rn "returns array of" srv/*.cds
   ```
2. Confirm a matching `srv.on` handler exists:
   ```
   grep -rn "srv.on\|this.on" srv/*.js
   ```
3. Confirm `valueHelpRequest` is wired in the view:
   ```
   grep -rn "valueHelpRequest" app/
   ```
4. Confirm a `SelectDialog` (or `ValueHelpDialog`) is created in the controller:
   ```
   grep -rn "SelectDialog\|ValueHelpDialog" app/
   ```

**Pass:** All four grep patterns return results for every value-help field.

**Fail action:** Re-spawn `cap-developer` to add the missing CAP function + handler; re-spawn
`fiori-developer` to add the missing view wiring + controller dialog. See
`fiori-freestyle/references/value-help-select-dialog.md` for the complete pattern.

---

## 11. Runtime Smoke Test — `cds watch` startup + OData endpoints

**When to run:** Always, for every CAP-backed app. Run last (after checks 1–10).  
**Self-healing mandate:** Do NOT report and wait. For every failure, apply the auto-fix defined
below, then re-run the affected sub-step. Only escalate to `AskUserQuestion` if an auto-fix
requires a decision the developer must make (e.g. a port conflict with a non-intent2app process).
Maximum 3 auto-fix attempts per sub-step before escalating.

---

### 11a — Pre-flight: ensure port 4004 is free

```bash
# Windows
netstat -ano | findstr :4004
# Unix/Git Bash
lsof -ti:4004
```

**If occupied:**
```bash
# Kill whatever is on the port before starting
npx kill-port 4004
```
Do this automatically — no user prompt needed.

---

### 11b — Start `cds watch` in the background

```bash
cd <app>/
cds watch > cds-watch.log 2>&1 &
CDS_PID=$!
```

Wait for server ready — poll the log instead of a fixed sleep:

```bash
# Poll up to 30s for "server listening" or first request line
timeout=30
elapsed=0
while [ $elapsed -lt $timeout ]; do
  grep -qi "server listening\|watching\|\[cds\]" cds-watch.log 2>/dev/null && break
  sleep 2
  elapsed=$((elapsed + 2))
done
```

> The Bash tool does not persist `$CDS_PID` between calls. To kill after the check:
> `pkill -f "cds watch"` or `npx kill-port 4004`.

---

### 11c — Check the startup log for errors

```bash
grep -i "error\|fatal\|failed\|cannot find\|loaded from different locations" cds-watch.log | grep -v "^\[WARNING\]"
```

**Pass:** No output.

**Auto-fix table — apply the fix, then re-run 11b:**

| Detected message | Auto-fix (no user prompt) |
|-----------------|--------------------------|
| `@sap/cds was loaded from different locations` | In `package.json` set `"cds-plugin-ui5": "0.13.6"` (exact), delete `node_modules/`, run `npm install` |
| `Cannot find module '@sap/cds'` | Run `npm install` in `<app>/` |
| `Failed loading service implementation from ./srv/service` | Read `srv/service.js` for syntax errors; re-spawn `cap-developer` with the exact error line |
| `Failed loading service implementation from @cap-js/sqlite` | In `package.json` change `@cap-js/sqlite` to `"^3"` (CDS 10) or `"^2.1.0"` (CDS 9); run `npm install` |
| `No service definition found for` | Verify `srv/service.cds` exists and `using` import path is correct |
| `EADDRINUSE :4004` | Run `npx kill-port 4004`, re-run 11b |
| `Cannot find module 'cds-plugin-ui5'` | Run `npm install cds-plugin-ui5@0.13.6 --save-dev` in `<app>/` |

---

### 11d — Derive the correct OData service path

CDS auto-derives the path: lowercase the service name, strip the `"Service"` suffix.

```bash
# Extract the service name from srv/service.cds
grep -m1 "^service " srv/service.cds
# "service EmployeeService" → path = /odata/v4/employee/
# "service OrdersService"   → path = /odata/v4/orders/
# Override: look for @path annotation
grep "@path" srv/service.cds
```

Store the derived path as `SERVICE_PATH` for steps 11e and 11f.

---

### 11e — Probe the OData `$metadata` endpoint

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:4004${SERVICE_PATH}\$metadata"
```

**Pass:** `200`.

**Auto-fix by response code:**

| Code | Diagnosis | Auto-fix |
|------|-----------|---------|
| `000` | Server not up | Check 11c log; apply matching auto-fix; retry 11b |
| `404` | Wrong service path | Re-derive path from `srv/service.cds`; if a `@path` annotation exists, use that value instead |
| `401` | Auth required but not expected (no-auth build) | Check `srv/service.cds` for stray `@requires`; re-spawn `cap-developer` to remove it |
| `500` | Handler crash | `grep -i "error" cds-watch.log`; re-spawn `cap-developer` with the stack trace |

---

### 11f — Probe the main entity set

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:4004${SERVICE_PATH}<MainEntity>"
```

**Pass:** `200`.

**Auto-fix:**

| Code | Auto-fix |
|------|---------|
| `404` | Entity name is case-sensitive — match exactly what appears in `srv/service.cds` |
| `400` | Likely a broken `$select`/`$expand` from `autoExpandSelect`; check if a `virtual` field is in the model and remove the `virtual` keyword (`virtual` fields are excluded from `$select`) |
| `500` | Read log; re-spawn `cap-developer` with the stack trace |

---

### 11g — Probe the UI app (`cds-plugin-ui5`)

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:4004/<appname>/webapp/manifest.json"
```

**Pass:** `200`.

**Auto-fix:**

| Code | Diagnosis | Auto-fix |
|------|-----------|---------|
| `404` | `cds-plugin-ui5` not serving the app | 1. Confirm `"sapux": ["app/<appname>"]` in root `package.json` — add if missing. 2. Confirm `app/<appname>/package.json` exists with `"main": "webapp/index.html"`. 3. Run `npm install` and restart |
| `404` | App folder name mismatch | Read `package.json → sapux` array; the folder name must match exactly |

---

### 11h — Stop the background server and clean up

```bash
pkill -f "cds watch" 2>/dev/null || npx kill-port 4004
rm -f cds-watch.log
```

---

**Pass definition for check 11:** 11c (clean log) + 11e (200) + 11f (200) + 11g (200).  
**Auto-fix loop:** For any failure, apply the fix, re-run only the failed sub-step (not the whole check), and mark pass/fail. After 3 consecutive auto-fix attempts on the same sub-step without resolution, escalate with `AskUserQuestion` showing the exact log excerpt.  
**Do not proceed to STEP 8.5 with any sub-step of check 11 still failing.**

---

## 12. Development Auth Kind — `.cdsrc.json` must use `dummy`

**Why:** `"kind": "mocked"` with named users requires explicit `Authorization: Basic` credentials.
The Fiori OData V4 model makes XHR requests from the browser; modern browsers never show a
Basic Auth dialog for XHR — the server returns 401 silently, the metadata request fails, and
the List Report renders completely blank with no visible error.

**Pattern:**

```bash
# Check .cdsrc.json auth kind
grep -n '"kind"' .cdsrc.json
```

**Pass:** `.cdsrc.json` contains `"kind": "dummy"` (or no `.cdsrc.json` exists and the
`package.json` `[development]` block uses `"kind": "dummy"`).

**Fail condition:** `.cdsrc.json` exists and contains `"kind": "mocked"` AND a `"users"` block
with named users.

**Auto-fix (no user prompt):** Rewrite `.cdsrc.json` `requires.auth` to:

```json
{
  "requires": {
    "auth": { "kind": "dummy" }
  },
  "server": { "port": 4004 }
}
```

---

## 13. Watch Script `--open` Path Matches `ui5.yaml metadata.name`

**Why:** `cds-plugin-ui5` mounts the Fiori app at `/{ui5.yaml metadata.name}/index.html`
(e.g. `/com.myapp.webapp/index.html`). If the `--open` argument in the watch script uses
the folder name instead of the metadata name (e.g. `--open myapp/index.html`), the browser
opens a 404 URL and the user never reaches the app.

**Pattern:**

```bash
# Derive the correct --open path
METADATA_NAME=$(grep 'name:' app/*/ui5.yaml | head -1 | awk '{print $2}')
# Check watch script in root package.json
grep "watch" package.json | grep "\-\-open"
```

**Pass:** The `--open` argument in the watch script equals `${METADATA_NAME}/index.html`
(optionally followed by `?` query params).

**Fail condition:** `--open` uses any other path (e.g. the directory name, `webapp/index.html`,
or the old path before a rename).

**Auto-fix (no user prompt):** Read `app/*/ui5.yaml` for `metadata.name`, then update the
`watch-*` script entry in root `package.json` so the `--open` value is
`<metadata.name>/index.html?sap-ui-xx-viewCache=false`.

---

## 14. Manifest `dataSources.mainService.uri` Matches the Derived CAP Service Path

**Why:** CAP v9 derives the OData URL path from the service name in lowercase and strips the
`"Service"` suffix — `OrdersService` → `/odata/v4/orders/`, `Leavers` → `/odata/v4/leavers/`.
If the manifest URI uses the original PascalCase name or includes the `-service` suffix, every
metadata request returns 404 and the entire UI is blank.

**Pattern:**

```bash
# 1. Extract service name
SERVICE_NAME=$(grep -m1 "^service " srv/service.cds | awk '{print $2}')

# 2. Derive expected path: lowercase, strip "Service" suffix
#    e.g. "LeaversService" → "leavers", "Orders" → "orders"
EXPECTED_PATH="/odata/v4/$(echo "$SERVICE_NAME" | sed 's/Service$//' | tr '[:upper:]' '[:lower:]')/"

# 3. If a @path annotation exists, it overrides the derived path
OVERRIDE=$(grep "@path" srv/service.cds | grep -o '"[^"]*"' | tr -d '"')
[ -n "$OVERRIDE" ] && EXPECTED_PATH="$OVERRIDE"

# 4. Compare to manifest
MANIFEST_URI=$(node -e "const m=require('./app/*/webapp/manifest.json'); \
  console.log(m['sap.app'].dataSources.mainService.uri)")

echo "Expected : $EXPECTED_PATH"
echo "Manifest : $MANIFEST_URI"
```

**Pass:** `MANIFEST_URI` exactly equals `EXPECTED_PATH` (including the trailing `/`).

**Fail condition:** Any case or suffix mismatch — e.g. manifest says `/odata/v4/LeaversService/`
but service resolves to `/odata/v4/leavers/`.

**Auto-fix (no user prompt):** Update `sap.app.dataSources.mainService.uri` in
`app/<app>/webapp/manifest.json` to `EXPECTED_PATH`. Do not change the service name.
`EXPECTED_PATH` always has a leading `/` (e.g. `/odata/v4/student/`) — this is correct for
local `cds watch` development. **Never strip the leading slash from this URI.**
Check 17 handles the distinct case of destination-prefixed URIs for BTP deployment.

---

## 15. i18n `supportedLocales` Includes `"en"`

**Why:** When `fallbackLocale` is `""` (the root bundle, used as default English), UI5 still
internally enumerates `"en"` as a locale candidate during startup. If `"en"` is not listed in
`supportedLocales`, UI5 logs `"The fallback locale 'en' is not contained in the list of
supported locales"` on every page load, which appears in browser console output and can mask
real errors.

**Pattern:**

```bash
# Read both i18n blocks from manifest.json
node -e "
const fs = require('fs');
const glob = require('glob');
const file = glob.sync('app/*/webapp/manifest.json')[0];
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const a = m['sap.app']?.i18n?.supportedLocales ?? [];
const b = m['sap.ui5']?.models?.i18n?.settings?.supportedLocales ?? [];
console.log('sap.app.i18n.supportedLocales:', JSON.stringify(a));
console.log('sap.ui5.models.i18n.settings.supportedLocales:', JSON.stringify(b));
"
```

**Pass:** Both `supportedLocales` arrays include `"en"`.

**Fail condition:** Either array is missing `"en"` while `fallbackLocale` is `""`.

**Auto-fix (no user prompt):** Insert `"en"` into both `supportedLocales` arrays in
`manifest.json` — add it as the second element after `""`:
`["", "en", ...]`.

---

## 17. Manifest `dataSources` URIs with Destination Prefix Must Be Relative (No Leading `/`)

> **SCOPE — read before applying the auto-fix or this check does the wrong thing.**
>
> This check applies **only** to destination-prefixed URIs — URIs whose first path segment is a
> BTP destination name (e.g. `leaversapp-srv-api`). It does **not** apply to plain OData URIs
> whose first segment is `odata`.
>
> | URI form | Example | Leading `/` | Action |
> |---|---|---|---|
> | Plain OData (local `cds watch`) | `/odata/v4/student/` | **Required** | **Never touch** |
> | Destination-prefixed (BTP/Workzone) | `myapp-srv-api/odata/v4/student/` | Must be absent | Strip if present |
>
> **Why plain OData URIs need the leading slash:** The OData V4 model resolves relative URIs
> against the app's own URL, not the server root. An app served at
> `http://localhost:4004/listreportapp/` resolves `odata/v4/student/` (no slash) to
> `http://localhost:4004/listreportapp/odata/v4/student/` — a 404. With the leading slash,
> `/odata/v4/student/` resolves from the server root →
> `http://localhost:4004/odata/v4/student/` — the real CAP endpoint.
> Check 14 validates that plain OData URIs already match `/odata/v4/{service}/` (with slash) —
> **never remove or alter the leading slash on a URI that Check 14 already approved.**

**Why destination-prefixed URIs must not have a leading slash:** When a URI includes a
destination name (e.g. `leaversapp-srv-api/odata/v4/leavers/`), the path must be **relative**.
In SAP Build Workzone, each app is mounted at a GUID-scoped path (`/ui5apps/<GUID>/`); a
leading slash makes it absolute, the approuter finds no matching route at the server root, and
every OData call returns 404 even though the destination and CAP service are correctly configured.

**Pattern:**

```bash
# Flag destination-prefixed URIs (first segment is NOT odata/resources/test-resources) that
# incorrectly start with '/'
node -e "
const fs = require('fs');
const glob = require('glob');
// These first-segments belong to plain OData or UI5 resource paths — never flag them
const PLAIN_PREFIXES = ['/odata/', '/resources/', '/test-resources/'];
const files = glob.sync('app/*/webapp/manifest.json');
files.forEach(f => {
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  const ds = m['sap.app']?.dataSources ?? {};
  Object.entries(ds).forEach(([key, val]) => {
    const uri = val?.uri ?? '';
    const isPlainOdata = PLAIN_PREFIXES.some(p => uri.startsWith(p));
    if (uri.startsWith('/') && !isPlainOdata) {
      console.error('FAIL ' + f + ' dataSources.' + key + '.uri — destination-prefix URI has leading slash: ' + uri);
    }
  });
});
"
```

**Pass:** No output — all destination-prefixed URIs are relative; plain OData URIs are skipped.

**Fail condition:** A `dataSources[*].uri` that starts with `/` **and** whose first path segment
is not `odata`, `resources`, or `test-resources` — i.e. it is a destination name.

**Auto-fix (destination-prefix URIs only — never apply to plain OData URIs):**

```javascript
// Before: "/leaversapp-srv-api/odata/v4/leavers/"
// After:  "leaversapp-srv-api/odata/v4/leavers/"
//
// GUARD: only strip when the URI is a destination-prefix form.
// Never strip from a URI whose first segment is "odata" — that breaks local cds watch.
const PLAIN_PREFIXES = ['/odata/', '/resources/', '/test-resources/'];
if (uri.startsWith('/') && !PLAIN_PREFIXES.some(p => uri.startsWith(p))) {
  uri = uri.replace(/^\//, '');
}
```

Apply to the manifest file directly — update the `uri` value in `sap.app.dataSources`.

---

## 16. Value Help `CollectionPath` Entities Are Inside the Service Block

**Why:** `@Common.ValueList CollectionPath` tells Fiori Elements which OData entity set to call
for the dropdown data (e.g. `GET /odata/v4/leavers/EmployeeTypes`). CAP only exposes entity
projections as OData entity sets when they are declared **inside** a `service { }` block.
A projection defined at the top level of a `.cds` file is valid CDS syntax (it can be used for
reuse or `extend`) but it is never mounted as an OData endpoint — the GET returns
`404 Invalid resource path` and the dropdown stays empty with no visible browser error.

**Pattern:**

```bash
# 1. Collect every CollectionPath value from annotations.cds
COLLECTION_PATHS=$(grep -h "CollectionPath:" app/*/annotations.cds \
  | grep -oP "(?<=CollectionPath: ')[^']+(?=')" \
  | sort -u)

# 2. For each, verify the entity name appears INSIDE the service block in srv/service.cds
#    (i.e. between "service X {" and the matching closing "}")
#    A simple but reliable heuristic: entity must appear before the first top-level "}" line
for NAME in $COLLECTION_PATHS; do
  node -e "
const fs = require('fs');
const src = fs.readFileSync('srv/service.cds', 'utf8');
// Strip everything after the first closing top-level brace
const serviceBody = src.match(/service\s+\w+[^{]*\{([\s\S]*?)\n\}/)?.[1] ?? '';
if (!serviceBody.includes('entity ${NAME}')) {
  console.error('FAIL: entity ${NAME} is NOT inside the service block — value help will 404');
  process.exit(1);
} else {
  console.log('OK: entity ${NAME} is inside the service block');
}
"
done
```

**Pass:** Every entity name that appears as a `CollectionPath` in any `annotations.cds` file is
also declared (as a `entity <Name>`) inside the `service { }` block of `srv/service.cds`.

**Fail condition:** Any `CollectionPath` entity is missing from the service block — either it is
defined after the closing `}`, or it is not in the service at all.

**Auto-fix (no user prompt):**

1. Read `srv/service.cds`. Find the closing `}` of the service block.
2. For each missing entity, check if it exists as a top-level projection after the `}`.
   - **If it does:** Move it (cut + paste) to just before the closing `}` of the service block.
   - **If it doesn't exist at all:** Add `  @readonly entity <Name> as projection on db.<Name>;`
     before the closing `}` and re-spawn `cap-developer` to confirm the `db.<Name>` entity
     exists in `db/schema.cds`.
3. After the fix, re-run check 1 (CDS build) to confirm the service still compiles.

---

---

## 18–20. FPM Wiring (run ONLY when a routing target has `"name": "sap.fe.core.fpm"`)

Skip this block entirely when no manifest routing target has `"name": "sap.fe.core.fpm"`.

**F1 (check 18a).** `Component.js` extends `sap/fe/core/AppComponent` (NOT `sap/ui/core/UIComponent`).

```bash
grep -rn "sap/ui/core/UIComponent" app/*/webapp/Component.js
```

**Pass:** No results. **Auto-fix:** Replace the import and base class with `sap/fe/core/AppComponent`.

**Fail action:** Re-spawn `fiori-developer` with the finding.

---

**F2 (check 18b).** The FPM page controller extends `sap/fe/core/PageController`.

```bash
grep -rn "sap/fe/core/PageController" app/*/webapp/ext/
```

**Pass:** At least one result matching the FPM target's `viewName` controller path.

**Fail action:** Re-spawn `fiori-developer` to fix the controller base class.

---

**F3 (check 19a).** `sap.ui5.flexEnabled === true` in `manifest.json`.

```bash
node -e "const m=require('./app/*/webapp/manifest.json'); console.log(m['sap.ui5'].flexEnabled)"
```

**Pass:** `true`. **Auto-fix (no user prompt):** Set `"flexEnabled": true` in the `sap.ui5` block of `manifest.json`.

---

**F4 (check 19b).** The FPM routing target has `name === "sap.fe.core.fpm"` AND `options.settings.viewName`.

```bash
node -e "
const fs=require('fs');
const glob=require('glob');
const file=glob.sync('app/*/webapp/manifest.json')[0];
const m=JSON.parse(fs.readFileSync(file,'utf8'));
const t=m['sap.ui5'].routing.targets;
Object.entries(t).forEach(([k,v])=>{
  if(v.name==='sap.fe.core.fpm' && !v.options?.settings?.viewName)
    console.error('FAIL target '+k+' missing viewName');
});"
```

**Pass:** No output. **Fail action:** Re-spawn `fiori-developer` to add `viewName` to the FPM target settings.

---

**F5 (check 19c).** `sap.fe.core` AND `sap.fe.macros` are both in `sap.ui5.dependencies.libs`.

```bash
node -e "
const fs=require('fs');
const glob=require('glob');
const file=glob.sync('app/*/webapp/manifest.json')[0];
const m=JSON.parse(fs.readFileSync(file,'utf8'));
const libs=m['sap.ui5'].dependencies.libs;
if(!libs['sap.fe.core']) console.error('FAIL: sap.fe.core missing from dependencies.libs');
if(!libs['sap.fe.macros']) console.error('FAIL: sap.fe.macros missing from dependencies.libs');"
```

**Pass:** No output. **Auto-fix (no user prompt):** Add the missing library entries to `sap.ui5.dependencies.libs` in `manifest.json`.

---

**F6 (check 20a).** The root FPM view declares `xmlns:macros="sap.fe.macros"` and its `controllerName` matches the FPM target's `viewName`.

```bash
grep -rn 'xmlns:macros="sap.fe.macros"' app/*/webapp/ext/
```

**Pass:** At least one result for each file referenced by a FPM target's `viewName`.

**Fail action:** Re-spawn `fiori-developer` to add the namespace declaration to the view root element.

---

**F7 (check 20b — CAP-embedded only).** `dataSources.mainService` has no `localUri` and no `annotations` array entry, AND an `app/<module>-ui.cds` shim file exists.

```bash
# Check for incorrect localUri in manifest
node -e "
const fs=require('fs');
const glob=require('glob');
const file=glob.sync('app/*/webapp/manifest.json')[0];
const m=JSON.parse(fs.readFileSync(file,'utf8'));
const ds=m['sap.app'].dataSources.mainService;
if(ds.settings?.localUri) console.error('FAIL: localUri present in mainService — CAP-embedded must not have it');
if(ds.settings?.annotations?.length) console.error('FAIL: annotations array present in mainService — CAP-embedded must not have it');"

# Check annotation shim exists
ls app/*-ui.cds 2>/dev/null || echo "FAIL: no app/*-ui.cds shim found — building blocks will render empty"
```

**Pass:** No `localUri`, no `annotations` array, shim file exists.

**Auto-fix (no user prompt):**
1. Remove `localUri` and `annotations` from `dataSources.mainService.settings` in `manifest.json` — CAP serves annotations from CDS; a local file is not needed and causes a 404 in `cds watch`.
2. Create `app/<module>-ui.cds` containing:
   ```cds
   using from './<module>/annotations';
   ```
   where `<module>` is the Fiori app folder name under `app/`. Without this shim, CAP does not load `app/<module>/annotations.cds` and all FPM building blocks render with no columns, filters, or charts.

---

## Sanity Check Result

Report as a table:

| # | Check | Result | Action taken |
| --- | --- | --- | --- |
| 1 | CDS build | ✅ Pass / ❌ Fail | — / re-spawned cap-developer |
| 2 | Namespace consistency | ✅ / ❌ | |
| 3 | Manifest validation | ✅ / ❌ | |
| 4 | UI5 lint | ✅ / ❌ | |
| 5 | Auth annotations | ✅ / ❌ | |
| 6 | No console.log | ✅ / ❌ | |
| 7 | No hardcoded secrets | ✅ / ❌ | |
| 8 | CSV UUID validity | ✅ / ❌ | |
| 9 | Draft configuration | ✅ / N/A | |
| 10 | Value help completeness | ✅ / N/A | |
| 11 | Runtime smoke test (cds watch + OData + UI) | ✅ / ❌ | |
| 12 | Dev auth kind — `.cdsrc.json` uses `dummy` | ✅ / ❌ | |
| 13 | Watch script `--open` path matches ui5.yaml metadata.name | ✅ / ❌ | |
| 14 | Manifest `dataSources.uri` matches derived CAP service path | ✅ / ❌ | |
| 15 | i18n `supportedLocales` includes `"en"` | ✅ / ❌ | |
| 16 | `CollectionPath` entities declared inside service block | ✅ / N/A | |
| 17 | Manifest destination-prefix URIs are relative (no leading `/`) | ✅ / ❌ | |
| 18–20 | FPM wiring (F1–F7) | ✅ / ❌ / N/A | |

**All checks must pass before proceeding to STEP 9 (review).**
