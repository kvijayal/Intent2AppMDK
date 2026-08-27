---
name: mta-reviewer
description: >
  Use EVERY TIME you need to review, audit, or validate an mta.yaml file for a CAPM application.
  Trigger on: "review mta", "audit mta", "mta review", "check mta.yaml", "mta best practices",
  "validate mta", "mta issues", "mta problems", "is mta correct", "mta yaml review",
  "review deployment descriptor", "mta quality", "mta errors", "mta checklist".
---

# MTA YAML Reviewer Skill — CAPM Best Practices
# Validated against real-world enterprise MTA files (zmmke0001_mk, zbue0004_mk)

## Mandatory Workflow

1. Read the mta.yaml file in FULL before any judgement — skim reads miss cross-reference errors
2. List every module name and every resource name first, then check cross-references
3. Run the quick-scan greps below to catch the two most common critical failures immediately
4. Work through each category in order, mark PASS / WARN / FAIL
5. Report using the structured output format at the end of this skill

```bash
# Quick-scan — run these first, they catch the most common critical failures
grep -n "forwardAuthToken\|ForwardAuthToken" mta.yaml
# Expected: at least 2 hits — one in srv provides, one in destination init_data

grep -n "existing_destinations_policy" mta.yaml
# Expected: all occurrences must be 'update' — never 'ignore' or 'fail'

grep -n "npm install" mta.yaml
# Expected: zero hits — all builder commands must use 'npm ci'

grep -n "service-name:" mta.yaml
# Expected: every managed-service resource has one

grep -n "path:" mta.yaml
# Check for 'path: ..' — points outside project root (common copy-paste error)

# CRITICAL — detect URL-based destinations placed inside destination-content module
# The GACD (Generic Application Content Deployer) only accepts service-key destinations.
# Any URL: entry inside parameters.content.instance.destinations fails at deploy time with
# "Missing destination property [ServiceInstanceName]" — move them to init_data instead.
grep -n "URL:" mta.yaml
# Cross-check: every URL: hit must be inside a resource's config.init_data block,
# NOT inside a module's parameters.content block.
```

---

## Real-World Architecture — Two Valid Destination Patterns

Both patterns are correct. Identify which pattern the file uses before reviewing sections 5–6.

### Pattern A — Simple (single UI, all destinations in module)
Destinations are configured entirely inside the destination-content module's `parameters.content`.
Common in SAP-generated single-app projects.

### Pattern B — Split (enterprise, multi-service)
**HTTP destinations** (srv-api, ui5) live in the **destination RESOURCE** `init_data`.
**Service-binding destinations** (OAuth2UserTokenExchange, html5-repo) live in the **destination-content MODULE** `parameters.content`.
The destination resource has `requires: - name: srv-api` so `~{srv-api/srv-url}` resolves correctly.

Both real-world files reviewed used Pattern B. Both patterns require the same `forwardAuthToken` checks.

---

## Review Categories & Rules

---

### 0. General Pre-Checks

| # | Rule | Severity |
|---|------|----------|
| G1 | No module of `type: approuter.nodejs` — the standalone approuter pattern is superseded by the `html5-apps-repo` pattern (BTP HTML5 Application Runtime). Flag and recommend migration. | WARN |
| G2 | Every module `name` referenced in any `requires` block must exist as a declared module or resource `name` — dangling references fail silently at deploy time | FAIL |

---

### 1. Header & Schema

| # | Rule | Severity |
|---|------|----------|
| H1 | `_schema-version` must be `"3.3"` or `"3.3.0"` as a **quoted string** — unquoted `3.3` is parsed as a float by YAML and rejected by MBT at build time | FAIL |
| H2 | `ID` must be present, lowercase, and globally unique within the BTP global account | WARN |
| H3 | `version` must follow semver (`1.0.0`) | WARN |
| H4 | `description` must NOT be `"A simple CAP project."` — the auto-generated placeholder seen in both reviewed files | WARN |
| H5 | `parameters.enable-parallel-deployments: true` must be present for faster deployments | WARN |
| H6 | For fullstack apps, `parameters.deploy_mode: html5-repo` must be set at the top level | WARN |

---

### 2. Build Parameters

| # | Rule | Severity |
|---|------|----------|
| B1 | `before-all` block must exist under `build-parameters` | FAIL |
| B2 | `builder: custom` must be set on the `before-all` entry | FAIL |
| B3 | First command must be `npm ci` — never `npm install` (ignores lock file, non-deterministic) | FAIL |
| B4 | Second command must be `npx cds build --production` — sole CDS compilation step | FAIL |
| B5 | Commands must be in ORDER: `npm ci` THEN `npx cds build --production` | FAIL |
| B6 | No additional `cds build` or `npx cds build` anywhere else in the file | FAIL |

**Correct pattern:**
```yaml
build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npx cds build --production
```

---

### 3. srv Module (CAP Node.js Service)

> **HANA conditionality:** Rules S7 and S8 apply only when the app has a HANA HDI container resource. Skip them for SQLite-only apps or apps that consume only external OData without a local DB.

**This section contains the single most commonly missed rule (S6 — forwardAuthToken). Check it first.**

| # | Rule | Severity |
|---|------|----------|
| S1 | `type: nodejs` | FAIL |
| S2 | `path: gen/srv` — NEVER `srv/` or `./srv` — deploys compiled artefact, not source | FAIL |
| S3 | `build-parameters.builder: npm-ci` — never `npm` or `npm-install` | FAIL |
| S4 | `provides` block must exist with an entry named `srv-api` | FAIL |
| S5 | `srv-api` entry must have `srv-url: ${default-url}` | FAIL |
| S6 | **`srv-api` entry MUST have `forwardAuthToken: true`** — omitting this strips the JWT before it reaches CAP; RBAC silently returns 403 on every request even with a valid user token. Found missing in BOTH real-world files reviewed. | FAIL |
| S7 | `requires` must list the HANA HDI container resource | FAIL |
| S8 | `requires` must list the XSUAA resource | FAIL |
| S9 | `parameters.buildpack: nodejs_buildpack` | WARN |
| S10 | `parameters.memory` must be explicitly set — CF default is too low for HANA connections (`1024M` is typical for production) | WARN |
| S12 | `parameters.instances` should be `1` in base `mta.yaml`; use `.mtaext` for production scale-out | WARN |
| S13 | `build-parameters.ignore: ["node_modules/"]` should be set to prevent local node_modules being included in the archive | WARN |

**Correct srv module pattern:**
```yaml
- name: <app-id>-srv
  type: nodejs
  path: gen/srv
  parameters:
    instances: 1
    buildpack: nodejs_buildpack
    memory: 1024M
    disk-quota: 1G
  build-parameters:
    builder: npm-ci
    ignore:
      - "node_modules/"
  provides:
    - name: srv-api
      properties:
        forwardAuthToken: true       # ← CRITICAL — JWT forwarding to CAP
        srv-url: ${default-url}
  requires:
    - name: <app-id>-auth            # XSUAA
    - name: <app-id>-db              # HANA HDI
    - name: <app-id>-destination
    - name: <app-id>-connectivity    # only if on-premise systems exist
```

---

### 4. db-deployer Module (HANA HDI Deployer)

> **Conditional section:** Applies only when the app has a HANA HDI container resource (`type: com.sap.xs.hdi-container`). If the app uses SQLite or no local DB, skip this section entirely.

| # | Rule | Severity |
|---|------|----------|
| D1 | `type: hdb` | FAIL |
| D2 | `path: gen/db` — never `db/` | FAIL |
| D3 | `requires` must list the HANA HDI container resource | FAIL |
| D4 | `parameters.buildpack: nodejs_buildpack` | WARN |
| D5 | If the HANA resource uses the `hdi-container-name` property pattern, db-deployer must bind it via `TARGET_CONTAINER: ~{hdi-container-name}` | FAIL |

**Standard pattern:**
```yaml
- name: <app-id>-db-deployer
  type: hdb
  path: gen/db
  parameters:
    buildpack: nodejs_buildpack
  requires:
    - name: <app-id>-db
```

**With `hdi-container-name` property binding (multi-container or explicit schema):**
```yaml
- name: <app-id>-db-deployer
  type: hdb
  path: gen/db
  parameters:
    buildpack: nodejs_buildpack
  requires:
    - name: <app-id>-db
      properties:
        TARGET_CONTAINER: ~{hdi-container-name}    # resolves from HANA resource properties
```

---

### 5. UI Modules (Fullstack apps — multiple apps supported)

Each UI5/Fiori app is a separate module of `type: html5`. Real enterprise apps have multiple UI modules.

| # | Rule | Severity |
|---|------|----------|
| U1 | Each UI module `type` must be `html5` | FAIL |
| U2 | `build-parameters.builder: custom` on each UI module | FAIL |
| U3 | Builder commands must use `npm ci` — NOT `npm install` | FAIL |
| U4 | `build-parameters.build-result: dist` on each UI module | WARN |
| U5 | `supported-platforms: []` must be set to prevent CF default platform deployment | WARN |
| U6 | Each UI module must be listed in the app-deployer's `build-parameters.requires` with its artifact zip and `target-path` | FAIL |

**Correct UI module pattern:**
```yaml
- name: <ui-module-name>
  type: html5
  path: app/<ui-folder-name>
  build-parameters:
    build-result: dist
    builder: custom
    commands:
      - npm ci                   # ← never 'npm install'
      - npm run build
    supported-platforms: []
```

---

### 6. App-Deployer Module (Fullstack apps)

Uploads all UI5 zip artefacts to the HTML5 Application Repository.

| # | Rule | Severity |
|---|------|----------|
| AD1 | `type: com.sap.application.content` | FAIL |
| AD2 | `requires` must list the html5-repo-host resource with `content-target: true` | FAIL |
| AD3 | `build-parameters.build-result` must point to the folder where zips land (e.g. `app/`) | FAIL |
| AD4 | `build-parameters.requires` must list every UI module with its artifact zip name and `target-path` | FAIL |
| AD5 | `path: gen` (when using cds build output) or `.` for source-based builds | WARN |

**Correct app-deployer pattern (multiple UI apps):**
```yaml
- name: <app-id>-app-deployer
  type: com.sap.application.content
  path: gen
  requires:
    - name: <app-id>-html5-repo-host
      parameters:
        content-target: true
  build-parameters:
    build-result: app/
    requires:
      - name: <ui-module-1>
        artifacts:
          - <ui-module-1-bundle>.zip
        target-path: app/
      - name: <ui-module-2>
        artifacts:
          - <ui-module-2-bundle>.zip
        target-path: app/
```

---

### 7. Destination-Content Module (Fullstack apps)

Configures service-binding destinations in the BTP Destination Service. In Pattern B, HTTP destinations live in the destination **resource** `init_data` instead (see Section 8d).

| # | Rule | Severity |
|---|------|----------|
| DC1 | `type: com.sap.application.content` | FAIL |
| DC2 | `path` must be `.` — **never `..`** (parent directory causes `ENOENT` during `mbt build`) | FAIL |
| DC3 | `build-parameters.no-source: true` must be set | FAIL |
| DC4 | `requires` must include destination resource with `content-target: true` | FAIL |
| DC5 | `requires` must include XSUAA resource with `service-key` | FAIL |
| DC6 | `requires` must include html5-repo-host resource with `service-key` | FAIL |
| DC7 | `requires` must include `srv-api` (Pattern A) OR destination resource's `requires` must include `srv-api` (Pattern B) — one location must reference it | FAIL |
| DC8 | `parameters.content.instance.existing_destinations_policy` must be `update` — **never `ignore` or `fail`** | FAIL |
| DC9 | OAuth2UserTokenExchange destinations must reference the correct `ServiceInstanceName` matching the resource's explicit `service-name` | FAIL |
| DC10 | `ServiceInstanceName` for html5-repo-host must match the explicit `service-name` on that resource | FAIL |
| DC11 | `sap.cloud.service` in every destination-content destination must match the `sap.cloud.service` value in each UI app's `manifest.json` — mismatch means the HTML5 Runtime cannot associate the app with the correct service instance | FAIL |
| DC12 | **No `URL:` property inside any `parameters.content.instance.destinations` entry.** The Generic Application Content Deployer (GACD) only handles service-key destinations (`ServiceInstanceName` + `ServiceKeyName`). Any entry with a `URL:` key causes the deploy to fail immediately with `Missing destination property [ServiceInstanceName]`. Move URL-based destinations (srv-api, ui5 CDN) to the destination **resource** `config.init_data` block. | FAIL |

**Correct destination-content module pattern (Pattern B — service-binding destinations only):**
```yaml
- name: <app-id>-destinations-content
  type: com.sap.application.content
  path: .                           # ← NEVER '..'
  requires:
    - name: <app-id>-auth
      parameters:
        service-key:
          name: <app-id>-auth-key
    - name: <app-id>-html5-repo-host
      parameters:
        service-key:
          name: <app-id>-html5-repo-host-key
    - name: srv-api
    - name: <app-id>-destination
      parameters:
        content-target: true
  build-parameters:
    no-source: true
  parameters:
    content:
      instance:
        existing_destinations_policy: update   # ← never 'ignore' or 'fail'
        destinations:
          - Name: <app-id>-html5-repository
            ServiceInstanceName: <app-id>-html5-app-host   # must match service-name on resource
            ServiceKeyName: <app-id>-html5-repo-host-key
            sap.cloud.service: <app-id>.service
          - Name: <app-id>-auth
            Authentication: OAuth2UserTokenExchange
            ServiceInstanceName: <app-id>-xsuaa-service    # must match service-name on resource
            ServiceKeyName: <app-id>-auth-key
            sap.cloud.service: <app-id>.service
```

---

### 8. Resources

#### 8a. XSUAA Resource

| # | Rule | Severity |
|---|------|----------|
| X1 | `type: org.cloudfoundry.managed-service` | FAIL |
| X2 | `parameters.service: xsuaa` | FAIL |
| X3 | `parameters.service-plan: application` | FAIL |
| X4 | `parameters.service-name` must be explicitly set — used as `ServiceInstanceName` in destination-content module | FAIL |
| X5 | `parameters.path: ./xs-security.json` | FAIL |
| X6 | `parameters.config.xsappname` should match the `xsappname` in `xs-security.json` | WARN |

**Correct XSUAA pattern:**
```yaml
- name: <app-id>-auth
  type: org.cloudfoundry.managed-service
  parameters:
    service: xsuaa
    service-plan: application
    service-name: <app-id>-xsuaa-service
    path: ./xs-security.json
    config:
      xsappname: <app-id>
      tenant-mode: dedicated
      oauth2-configuration:
        credential-types:
          - binding-secret
          - x509
```

#### 8b. HANA HDI Container Resource

| # | Rule | Severity |
|---|------|----------|
| DB1 | `type: com.sap.xs.hdi-container` | FAIL |
| DB2 | `parameters.service: hana` | FAIL |
| DB3 | `parameters.service-plan: hdi-shared` | FAIL |
| DB4 | `parameters.service-name` must be explicitly set — without it, CF generates a random name causing data loss on redeploy | FAIL |
| DB5 | If `properties: hdi-container-name: ${service-name}` is used, `service-name` is doubly critical — `${service-name}` resolves to this value and the db-deployer uses it for `TARGET_CONTAINER` binding | FAIL |

**Correct HANA pattern (with property binding):**
```yaml
- name: <APP-ID>-db
  type: com.sap.xs.hdi-container
  parameters:
    service: hana
    service-plan: hdi-shared
    service-name: <app-id>-hdi-container    # ← REQUIRED — ${service-name} resolves to this
    config:
      schema: <APP-ID>
  properties:
    hdi-container-name: ${service-name}     # exposed for TARGET_CONTAINER in db-deployer
```

#### 8c. HTML5 Application Repository Host

| # | Rule | Severity |
|---|------|----------|
| HR1 | `parameters.service-plan: app-host` — stores static app artefacts | FAIL |
| HR2 | `parameters.service-name` must be explicitly set — it is referenced as `ServiceInstanceName` in destination-content | FAIL |
| HR3 | `parameters.config.sizeLimit` should be set (e.g. `2` MB) to guard against oversized uploads | WARN |

#### 8d. Destination Service Resource

| # | Rule | Severity |
|---|------|----------|
| DS1 | `parameters.service: destination` | FAIL |
| DS2 | `parameters.service-plan: lite` — use `standard` only if on-premise connectivity required | WARN |
| DS3 | `parameters.service-name` must be explicitly set | FAIL |
| DS4 | `parameters.config.HTML5Runtime_enabled: true` — required for HTML5 Runtime to resolve destinations by name | FAIL |
| DS6 | In Pattern B: `parameters.config.init_data.instance.existing_destinations_policy: update` must be set | FAIL |
| DS7 | In Pattern B: the srv-api HTTP destination must have `HTML5.ForwardAuthToken: true` | FAIL |
| DS8 | In Pattern B: the srv-api HTTP destination must have `HTML5.DynamicDestination: true` | FAIL |
| DS9 | In Pattern B: `HTML5.Timeout` must be set on the srv-api destination — omission causes 504 on bulk/long-running operations | WARN |
| DS10 | In Pattern B: `URL: ~{srv-api/srv-url}` — never hardcode the CAP service URL | FAIL |
| DS11 | In Pattern B: a `ui5` destination to `https://ui5.sap.com` must be present — must NOT have ForwardAuthToken | WARN |
| DS12 | In Pattern B: destination resource must have `requires: - name: srv-api` for `~{srv-api/srv-url}` substitution | FAIL |
| DS_XS1 | The destination `Name` in `init_data` must exactly match the `destination` field in each UI app's `xs-app.json` route — a mismatch causes the HTML5 Runtime to return 404 with no informative error message | FAIL |

**Correct destination resource (Pattern B):**
```yaml
- name: <app-id>-destination
  type: org.cloudfoundry.managed-service
  parameters:
    service: destination
    service-plan: lite
    service-name: <app-id>-destination-service
    config:
      HTML5Runtime_enabled: true
      version: 1.0.0
      init_data:
        instance:
          existing_destinations_policy: update
          destinations:
            - Authentication: NoAuthentication
              HTML5.DynamicDestination: true
              HTML5.ForwardAuthToken: true
              HTML5.Timeout: 600000            # ← prevents 504 on bulk ops
              Name: <app-id>-srv-api
              ProxyType: Internet
              Type: HTTP
              URL: ~{srv-api/srv-url}
            - Authentication: NoAuthentication
              Name: ui5
              ProxyType: Internet
              Type: HTTP
              URL: https://ui5.sap.com
              # ← no ForwardAuthToken on ui5 — it is a public CDN
  requires:
    - name: srv-api                            # ← required for ~{srv-api/srv-url} substitution
```

#### 8e. Connectivity Service (Conditional — On-Premise Only)

**Skip this entire section if `grep -q "connectivity" mta.yaml` returns no match.**

| # | Rule | Severity |
|---|------|----------|
| C1 | Remove entirely if NO on-premise SAP systems (ERP, S/4) are connected — unused bindings add attack surface and cost | WARN |
| C2 | `parameters.service-plan: lite` | WARN |
| C4 | If present, confirm the srv module lists it in `requires` | FAIL |

#### 8f. Job Scheduler (Conditional)

**Skip this entire section if `grep -q "jobscheduler" mta.yaml` returns no match.**

Applies when the app uses background scheduled jobs.

| # | Rule | Severity |
|---|------|----------|
| JS1 | `parameters.service: jobscheduler` | FAIL |
| JS2 | `parameters.service-plan: standard` — `lite` plan does not support XSUAA token exchange | FAIL |
| JS3 | `parameters.config.enable-xsuaa-support: true` — required for the scheduler to obtain tokens | FAIL |
| JS4 | `parameters.service-name` must be explicitly set | WARN |

**Correct job scheduler pattern:**
```yaml
- name: <app-id>-jobscheduler
  type: org.cloudfoundry.managed-service
  parameters:
    service: jobscheduler
    service-plan: standard
    service-name: <app-id>-jobscheduler
    config:
      enable-xsuaa-support: true
```

#### 8g. HTML5 Application Runtime (app-runtime plan)

**Skip this section if `grep -q "app-runtime" mta.yaml` returns no match.**

| # | Rule | Severity |
|---|------|----------|
| RT1 | If provisioned (`service-plan: app-runtime`), confirm it is actually required by a module or Launchpad configuration — unbound resources waste cost | WARN |

#### 8h. User-Provided Services (e.g. Dynatrace)

**Skip this section if `grep -q "user-provided-service" mta.yaml` returns no match.**

| # | Rule | Severity |
|---|------|----------|
| UP1 | `type: org.cloudfoundry.user-provided-service` with no `parameters` means CF must have this instance pre-created before `cf deploy` — document as a pipeline prerequisite | WARN |
| UP2 | If a user-provided service is required by srv, the CF space must have it or the deploy will fail with a binding error | FAIL |

---

### 9. JWT / Auth Propagation (Highest Priority)

**The most common real-world failure — found missing in BOTH enterprise files reviewed.**
Must be present in exactly two places. One missing = all OData calls fail silently.

| # | Rule | Severity |
|---|------|----------|
| J1 | `forwardAuthToken: true` in `srv` module `provides.srv-api.properties` | FAIL |
| J2 | `HTML5.ForwardAuthToken: true` in destination's srv-api entry (resource `init_data` in Pattern B, module `parameters` in Pattern A) | FAIL |
| J3 | Both J1 and J2 required simultaneously — omitting either one breaks auth completely | FAIL |
| J4 | Do NOT set `HTML5.ForwardAuthToken: true` on the `ui5` destination — it is a public CDN, not a protected backend | WARN |

**Verification:**
```bash
grep -n "forwardAuthToken\|ForwardAuthToken" mta.yaml
```
Expected output must contain at least two lines:
- one matching `forwardAuthToken: true` inside the `provides` block
- one matching `HTML5.ForwardAuthToken: true` inside a destination entry

---

### 10. Naming Consistency

| # | Rule | Severity |
|---|------|----------|
| N1 | All module and resource names should share the same `<app-id>-` prefix matching the top-level `ID` field | WARN |
| N2 | `ServiceInstanceName` values in destination-content module must exactly match the `service-name` on the corresponding resource — mismatch causes silent binding failures | FAIL |
| N3 | `srv-api` provide name must match every `~{srv-api/...}` substitution reference | FAIL |
| N4 | Every name listed in any `requires` block must match an existing module or resource `name` exactly | FAIL |

---

### 11. Performance & Sizing

| # | Rule | Severity |
|---|------|----------|
| P1 | `parameters.instances` on srv should be `1` in base `mta.yaml` — use `.mtaext` for per-environment overrides | WARN |
| P2 | `parameters.memory` must be explicitly set — `1024M` is typical for HANA-connected CAP apps | WARN |
| P4 | Use `.mtaext` extension files for environment-specific sizing — never create separate `mta.yaml` per environment | WARN |
| P5 | Deploy the SAME `.mtar` archive across dev/QA/prod — never rebuild for production (risks dependency drift) | WARN |

---

### 12. Security

| # | Rule | Severity |
|---|------|----------|
| SEC1 | No plaintext credentials, passwords, or tokens anywhere in mta.yaml | FAIL |
| SEC2 | No `VCAP_SERVICES` values or CF service key content embedded | FAIL |
| SEC3 | `xs-security.json` must NOT be inline — always reference via `path: ./xs-security.json` | FAIL |
| SEC4 | `existing_destinations_policy: fail` banned in any module or resource — breaks every redeploy | FAIL |
| SEC5 | `existing_destinations_policy: ignore` in destination-content module is wrong — use `update` | FAIL |
| SEC6 | Connectivity resource must be removed if no on-premise systems exist | WARN |

---

## Output Format

Produce this report after reviewing:

```
## MTA YAML Review Report
File: mta.yaml
App ID: <value from ID field>
Schema Version: <value>
Date: <today>

### ❌ Blockers (Fix before mbt build / cf deploy)
- [J1/S6] forwardAuthToken: true missing from srv provides block — RBAC silently fails on every request
- [DC8] existing_destinations_policy: ignore in destination-content — change to 'update'
- [DC2] path: .. on destination-content module — must be '.' (parent path causes mbt build ENOENT)
- [DB4] HANA resource ZBUE0004_MK has no service-name — CF creates a new HDI container on every fresh deploy, data loss

### ⚠️  Warnings (Fix before production)
- [S12] instances: 2 hardcoded — move to deploy-config-prod.mtaext, set base to 1
- [DS9] HTML5.Timeout not set on srv-api destination — 504 risk on bulk operations
- [HR2] html5-repo-host missing explicit service-name — ServiceInstanceName reference will break if resource is renamed
- [C1] connectivity bound to srv — confirm on-premise ERP connection is genuinely required

### ✅ Passed (X / Y checks)
- [H1] Schema version 3.3.0 ✅
- [B1-B6] before-all: npm ci + npx cds build --production, builder: custom ✅
- [S1] srv type: nodejs ✅
- [S2] srv path: gen/srv ✅
- [S3] srv builder: npm-ci ✅
- [J2] HTML5.ForwardAuthToken: true in destination init_data ✅
- [DS6] existing_destinations_policy: update in destination resource ✅
- [X4] XSUAA explicit service-name ✅
- [X5] xs-security.json path correct ✅
- [U3] All UI modules use npm ci ✅

### Build & Deploy Commands (when all blockers resolved)
mbt build --mtar <app-id>.mtar --platform cf
cf deploy <app-id>.mtar --strategy rolling --no-confirm
cf deploy <app-id>.mtar --strategy rolling -e deploy-config-prod.mtaext --no-confirm
```

---

## Antipattern Reference (from real-world reviews)

| Antipattern | Real-World Impact | Fix |
|-------------|-------------------|-----|
| Missing `forwardAuthToken: true` in srv provides | Every OData call returns 401/403 despite valid JWT — found in BOTH reviewed enterprise files | Add to `provides.srv-api.properties` |
| `path: ..` on destination-content module | `mbt build` fails with ENOENT — points outside project root | Change to `path: .` |
| `existing_destinations_policy: ignore` | Stale service keys after XSUAA/HTML5 recreation — silent binding failures | Change to `update` |
| `existing_destinations_policy: fail` | `cf deploy` fails on every redeploy after the first | Change to `update` |
| `npm install` instead of `npm ci` in any builder | Non-deterministic builds — package-lock.json ignored, version drift | Change to `npm ci` everywhere |
| Missing `service-name` on HANA resource | CF creates a new HDI container on fresh deploy — all data abandoned | Add explicit `service-name` |
| Missing `service-name` on html5-repo-host | `ServiceInstanceName` reference in destination-content silently breaks on rename | Add explicit `service-name` |
| `srv path: srv/` | Deploys source, not compiled artefact — CDS services fail to start | Change to `gen/srv` |
| `srv builder: npm` | CF downloads dev dependencies — slow builds, security risk | Change to `npm-ci` |
| `instances: 2` hardcoded in base mta.yaml | Wastes dev/QA resources, defeats environment parity | Move to `.mtaext`, set base to `1` |
| No `HTML5.Timeout` on srv-api destination | Default 30s timeout causes 504 on bulk/long-running CAP operations | Set `HTML5.Timeout: 600000` |
| Hardcoded CAP URL in destination | Breaks after restage/redeploy when CF assigns new URL | Use `~{srv-api/srv-url}` |
| `HTML5.ForwardAuthToken` on `ui5` destination | Security risk — forwards user tokens to a public CDN | Remove from ui5 destination |
| Connectivity service when no on-premise systems | Unnecessary service binding, billing, attack surface | Remove resource and requires binding |
| URL-based destination (`URL:`) inside `destination-content` module `parameters.content.instance.destinations` | Deploy fails immediately: `Missing destination property [ServiceInstanceName] in destination <name>`. The GACD only handles service-key destinations. Adding `Type: HTTP` or `ProxyType` does NOT fix this — the destination type is architecturally wrong. | Move the entry to the destination **resource** `config.init_data`; add `requires: - name: srv-api` to the resource |
| User-provided service not pre-created in CF space | `cf deploy` fails with binding error — no clear error message | Document as pipeline prerequisite |
| Job scheduler on `lite` plan | Lite plan has no XSUAA support — token exchange fails silently | Use `standard` plan |
| Commented webIDE properties in destinations | Legacy SAP Web IDE config, deprecated — noise in the file | Remove the commented lines |
| Inline `xs-security.json` in mta.yaml | Hard to maintain, version-controlled separately for a reason | Reference via `path: ./xs-security.json` |
