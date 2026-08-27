# Deployment Configuration Templates

Substitute these six constants throughout every template before writing any file:

| Constant | Description | Example |
|---|---|---|
| `{MTA_ID}` | MTA application ID — lowercase | `vcleavers` |
| `{APP_ID}` | UI5 app module name — lowercase, matches folder | `project2` |
| `{SRV_MODULE}` | CAP srv module name (`{MTA_ID}-srv`) | `vcleavers-srv` |
| `{BACKEND_DEST}` | OData destination name (`{MTA_ID}-srv-api`) | `vcleavers-srv-api` |
| `{CLOUD_SERVICE}` | sap.cloud.service value (`{MTA_ID}`) | `vcleavers` |
| `{ODATA_PATH}` | CAP service path — lowercase service name, trailing slash | `odata/v4/company/` |

> All six values are intentionally simple: `BACKEND_DEST = {MTA_ID}-srv-api`,
> `CLOUD_SERVICE = {MTA_ID}`, `SRV_MODULE = {MTA_ID}-srv`. Keep them consistent.

---

## `mta.yaml` — Complete Correct Template

```yaml
_schema-version: "3.3"
ID: {MTA_ID}
description: {Meaningful description — NOT "A simple CAP project."}
version: 1.0.0

parameters:
  deploy_mode: html5-repo
  enable-parallel-deployments: true

build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npx cds build --production

modules:

  # ── CAP Service ──────────────────────────────────────────────────
  - name: {SRV_MODULE}
    type: nodejs
    path: gen/srv
    parameters:
      buildpack: nodejs_buildpack
      memory: 512M
    build-parameters:
      builder: npm-ci
      ignore:
        - node_modules/
    requires:
      - name: {MTA_ID}-auth
      - name: {MTA_ID}-destination
      - name: {MTA_ID}-connectivity    # remove if no on-premise systems
    provides:
      - name: srv-api
        properties:
          forwardAuthToken: true        # ← CRITICAL — both here AND in destination
          srv-url: ${default-url}

  # ── HTML5 App ────────────────────────────────────────────────────
  - name: {APP_ID}
    type: html5
    path: app/{APP_ID}
    build-parameters:
      build-result: dist
      builder: custom
      commands:
        - npm ci                        # ← never 'npm install'
        - npm run build:cf
      supported-platforms: []

  # ── App Content (uploads zips to HTML5 repo) ──────────────────────
  - name: {MTA_ID}-app-content
    type: com.sap.application.content
    path: .
    requires:
      - name: {MTA_ID}-html5-repo-host
        parameters:
          content-target: true
    build-parameters:
      build-result: resources
      requires:
        - artifacts:
            - {APP_ID}.zip              # ← must match ui5-deploy.yaml archiveName + .zip
          name: {APP_ID}
          target-path: resources/

  # ── Destination Content (registers service-binding destinations) ──
  - name: {MTA_ID}-destination-content
    type: com.sap.application.content
    path: .                             # ← never '..' — causes mbt ENOENT
    requires:
      - name: {MTA_ID}-destination
        parameters:
          content-target: true
      - name: {MTA_ID}-html5-repo-host
        parameters:
          service-key:
            name: {MTA_ID}-repo-host-key
      - name: {MTA_ID}-auth
        parameters:
          service-key:
            name: {MTA_ID}-uaa-key
    parameters:
      content:
        instance:
          existing_destinations_policy: update   # ← never 'fail' or 'ignore'
          destinations:
            - Name: {MTA_ID}-html5-repo-host
              ServiceInstanceName: {MTA_ID}-html5-app-host-service   # must match service-name below
              ServiceKeyName: {MTA_ID}-repo-host-key
              sap.cloud.service: {CLOUD_SERVICE}
            - Authentication: OAuth2UserTokenExchange
              Name: {MTA_ID}-uaa
              ServiceInstanceName: {MTA_ID}-auth                    # must match service-name below
              ServiceKeyName: {MTA_ID}-uaa-key
              sap.cloud.service: {CLOUD_SERVICE}
    build-parameters:
      no-source: true

resources:

  # ── XSUAA ────────────────────────────────────────────────────────
  - name: {MTA_ID}-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      service-name: {MTA_ID}-auth      # ← explicit service-name required
      path: ./xs-security.json

  # ── Destination ──────────────────────────────────────────────────
  - name: {MTA_ID}-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
      service-name: {MTA_ID}-destination
      config:
        HTML5Runtime_enabled: true
        version: 1.0.0
        init_data:
          instance:
            existing_destinations_policy: update
            destinations:
              - Authentication: NoAuthentication
                HTML5.DynamicDestination: true
                HTML5.ForwardAuthToken: true         # ← CRITICAL — both here AND in srv provides
                HTML5.Timeout: 600000
                Name: {BACKEND_DEST}
                ProxyType: Internet
                Type: HTTP
                URL: ~{srv-api/srv-url}              # ← never hardcode the URL
              - Authentication: NoAuthentication
                Name: ui5
                ProxyType: Internet
                Type: HTTP
                URL: https://ui5.sap.com
                # ← no ForwardAuthToken on ui5 (public CDN)
    requires:
      - name: srv-api                  # ← required for ~{srv-api/srv-url} substitution

  # ── HTML5 App Repository ─────────────────────────────────────────
  - name: {MTA_ID}-html5-repo-host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host
      service-name: {MTA_ID}-html5-app-host-service  # ← explicit service-name required

  # ── Connectivity (on-premise only — remove if not needed) ─────────
  - name: {MTA_ID}-connectivity
    type: org.cloudfoundry.managed-service
    parameters:
      service: connectivity
      service-plan: lite
```

---

## `xs-security.json` — Complete Correct Template

```json
{
  "xsappname": "{MTA_ID}",
  "tenant-mode": "dedicated",
  "description": "{Meaningful description}",
  "scopes": [],
  "role-templates": [],
  "attributes": []
}
```

> `xsappname` must be **lowercase** and match `MTA_ID` exactly.
> Add scopes and role-templates here when the CAP service uses `@restrict` annotations.

---

## `app/{APP_ID}/xs-app.json` — Complete Correct Template

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/{BACKEND_DEST}/(.*)$",
      "target": "$1",
      "destination": "{BACKEND_DEST}",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },
    {
      "source": "^/resources/(.*)$",
      "target": "/resources/$1",
      "authenticationType": "none",
      "destination": "ui5"
    },
    {
      "source": "^/test-resources/(.*)$",
      "target": "/test-resources/$1",
      "authenticationType": "none",
      "destination": "ui5"
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

> The catch-all route (`^(.*)$`) **must be last**. The OData route source prefix
> **must match** the `/{BACKEND_DEST}/` prefix used in `manifest.json dataSources uri`.

---

## `app/{APP_ID}/ui5.yaml` — Complete Correct Template

```yaml
specVersion: "4.0"
metadata:
  name: {APP_ID}              # ← must match sap.app.id in manifest.json exactly
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
          url: https://sapui5.hana.ondemand.com
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

> No `framework:` block — this app bootstraps from the CDN proxy above. Never mix
> `framework:` block with CDN proxy; it causes a blank-page script-load error.

---

## `app/{APP_ID}/ui5-deploy.yaml` — Complete Correct Template

```yaml
specVersion: "4.0"
metadata:
  name: {APP_ID}              # ← must match ui5.yaml metadata.name
type: application
resources:
  configuration:
    propertiesFileSourceEncoding: UTF-8
builder:
  resources:
    excludes:
      - /test/**
      - /localService/**
  customTasks:
    - name: ui5-task-zipper
      afterTask: generateCachebusterInfo
      configuration:
        archiveName: {APP_ID}           # ← produces {APP_ID}.zip — must match mta.yaml artifacts entry
        relativePaths: true
        additionalFiles:
          - xs-app.json                 # ← CRITICAL: routing config must be in the zip
```

---

## `app/{APP_ID}/package.json` — Complete Correct Template

```json
{
  "name": "{APP_ID}",
  "version": "0.0.1",
  "description": "An SAP Fiori application.",
  "keywords": ["ui5", "openui5", "sapui5"],
  "main": "webapp/index.html",
  "dependencies": {},
  "devDependencies": {
    "@ui5/cli": "^4",
    "@sap/ux-ui5-tooling": "1",
    "ui5-task-zipper": "^3"
  },
  "scripts": {
    "build:cf": "ui5 build preload --clean-dest --config ui5-deploy.yaml --include-task=generateCachebusterInfo",
    "build": "npm run build:cf",
    "deploy-config": "npx -p @sap/ux-ui5-tooling fiori add deploy-config cf"
  }
}
```

> `"name"` **must** match the folder name and `sap.app.id`. This is the most common
> deployment mistake — a name left over from a generator default (e.g. `"project1"` in
> a folder called `project2`).

---

## Root `package.json` — Production Auth Section

The most dangerous misconfiguration: `auth: "dummy"` silently passes local tests but causes
all OData calls to return 401 after deployment.

```json
{
  "name": "{MTA_ID}",
  "cds": {
    "requires": {
      "[production]": {
        "auth": "xsuaa"
      },
      "[development]": {
        "auth": "dummy"
      }
    }
  }
}
```

> `[production]` profile activates automatically when deployed to BTP.
> `[development]` profile activates for `cds watch` locally.
> Never set `auth: "dummy"` in `[production]`.

---

## `app/*/webapp/manifest.json` — Critical Deployment Fields

Only the fields that matter for deployment. The generator handles the rest.

```json
{
  "sap.app": {
    "id": "{APP_ID}",
    "dataSources": {
      "mainService": {
        "uri": "/{BACKEND_DEST}/{ODATA_PATH}",
        "type": "OData",
        "settings": {
          "odataVersion": "4.0"
        }
      }
    }
  },
  "sap.cloud": {
    "public": true,
    "service": "{CLOUD_SERVICE}"
  },
  "sap.ui5": {
    "flexEnabled": true,
    "models": {
      "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
          "operationMode": "Server",
          "autoExpandSelect": true,
          "earlyRequests": true
        }
      }
    }
  }
}
```

> `sap.cloud.service` **must** match `CLOUD_SERVICE` from mta.yaml destination-content.
> `dataSources uri` prefix **must** match the `xs-app.json` OData route `source` prefix.

---

## Cross-File Consistency — Quick Visual Alignment Check

Copy the actual values from your project and verify all values in a row match:

```
{APP_ID}          = app folder name
                  = app/package.json "name"
                  = manifest.json sap.app.id
                  = ui5.yaml metadata.name
                  = ui5-deploy.yaml metadata.name
                  = mta.yaml HTML5 module name
                  = mta.yaml app-content artifacts name
                  = ui5-deploy.yaml archiveName (→ produces {APP_ID}.zip)

{BACKEND_DEST}    = mta.yaml destination init_data destination Name
                  = xs-app.json OData route destination
                  = manifest.json dataSources uri first path segment (/{BACKEND_DEST}/...)

{CLOUD_SERVICE}   = mta.yaml destination-content sap.cloud.service
                  = manifest.json sap.cloud.service

{MTA_ID}          = mta.yaml ID
                  = xs-security.json xsappname (lowercase)
                  = mta.yaml SRV_MODULE prefix ({MTA_ID}-srv)
                  = mta.yaml resource name prefixes ({MTA_ID}-auth, etc.)
```

If any value in a row differs → that mismatch is a CRITICAL finding.

---

## Code Snippets — Reference Only

These snippets show the correct implementation patterns for the CAP backend files that
complement the deployment config above. They are reference examples — do not copy verbatim;
adapt to the actual service name, entities, and roles in the project.

---

### `srv/service.cds` — Auth annotations (every service, every entity)

```cds
using { db } from '../db/schema';

// Every service must have @requires — unauthenticated access is never allowed
service {SRV_NAME}Service @(requires: 'authenticated-user') {

  // Read-only entity — Viewer can read, Editor/Admin can write
  entity {Entity} @(restrict: [
    { grant: 'READ',              to: ['Viewer', 'Editor', 'Admin'] },
    { grant: ['CREATE','UPDATE'], to: ['Editor', 'Admin'] },
    { grant: 'DELETE',            to: 'Admin' }
  ]) as projection on db.{Entity};

  // Draft-enabled entity (Fiori Elements create/edit)
  @odata.draft.enabled
  entity {DraftEntity} @(restrict: [
    { grant: 'READ',              to: ['Viewer', 'Editor', 'Admin'] },
    { grant: ['CREATE','UPDATE'], to: ['Editor', 'Admin'] },
    { grant: 'DELETE',            to: 'Admin' }
  ]) as projection on db.{DraftEntity};
}
```

> Never leave an entity without `@restrict` — missing restriction = open to any
> authenticated user. This is a security misconfiguration that `deployer` will flag.

---

### `srv/service.js` — ESM handler (required when `package.json` has `"type": "module"`)

```js
// ESM export — required when root package.json has "type": "module"
// (produced by cds init --add nodejs,sqlite,hana with CDS 10)
export default (srv) => {

  // READ handler — delegate to external service
  srv.on('READ', 'CompanyCode', async (req) => {
    const externalSrv = await cds.connect.to('ZAPI_COMPANYCODE_SRV');
    return externalSrv.run(req.query);
  });

  // Validate before CREATE/UPDATE
  srv.before(['CREATE', 'UPDATE'], 'Orders', (req) => {
    if (!req.data.quantity || req.data.quantity <= 0) {
      return req.error(400, 'Quantity must be greater than zero.');
    }
  });

  // Role-gated logic — status field editable by Admin only
  srv.before('UPDATE', 'Orders', (req) => {
    if (!req.user.is('Admin') && req.data.status !== undefined) {
      return req.error(403, 'Only Admins can change the order status.');
    }
  });

  // Strip sensitive fields for non-Admin callers
  srv.after('READ', 'Orders', (results, req) => {
    if (!req.user.is('Admin')) {
      results.forEach(o => { delete o.internalNotes; });
    }
  });

};
```

> **CommonJS alternative** (when `"type": "module"` is NOT in `package.json`):

```js
module.exports = cds.service.impl(async function (srv) { /* … */ });
```

> Check `package.json` before choosing — mixing ESM export with CommonJS package crashes at startup.

---

### `.cdsrc.json` — Local development auth (never deployed)

```json
{
  "requires": {
    "auth": {
      "kind": "dummy"
    }
  },
  "server": {
    "port": 4004
  }
}
```

> `"kind": "dummy"` is correct for local development — it accepts any request without a token.
> Do NOT use `"kind": "mocked"` with named users — mocked auth causes XHR OData requests to
> silently return 401 (a blank List Report with no error in the browser console).
> Production uses `"kind": "xsuaa"` via the `[production]` profile in root `package.json`.

---

### `xs-security.json` — With roles (when `@restrict` is used in CDS)

```json
{
  "xsappname": "{MTA_ID}",
  "tenant-mode": "dedicated",
  "description": "Security descriptor for {MTA_ID}",
  "scopes": [
    { "name": "$XSAPPNAME.Viewer",  "description": "Read-only access" },
    { "name": "$XSAPPNAME.Editor",  "description": "Create and update records" },
    { "name": "$XSAPPNAME.Admin",   "description": "Full access including delete" }
  ],
  "role-templates": [
    {
      "name": "Viewer",
      "description": "Read all entities",
      "scope-references": ["$XSAPPNAME.Viewer"]
    },
    {
      "name": "Editor",
      "description": "Create and edit records",
      "scope-references": ["$XSAPPNAME.Viewer", "$XSAPPNAME.Editor"]
    },
    {
      "name": "Admin",
      "description": "Full access",
      "scope-references": [
        "$XSAPPNAME.Viewer",
        "$XSAPPNAME.Editor",
        "$XSAPPNAME.Admin"
      ]
    }
  ],
  "attributes": [],
  "oauth2-configuration": {
    "token-validity": 43200,
    "redirect-uris": [
      "https://*.cfapps.eu10.hana.ondemand.com/**",
      "https://*.cfapps.us10.hana.ondemand.com/**"
    ]
  }
}
```

> Roles are **additive** — higher roles must include all lower-role scopes.
> After changing this file: `cf update-service {MTA_ID}-auth -c xs-security.json`
> (update, never recreate — recreating destroys existing Role Collection assignments).

---

### `mta.yaml` — HANA variant (add these when the app has its own database)

When the app has a `db/schema.cds` (not just an external OData service), add the
`db-deployer` module and `hana` resource to the fullstack template above:

```yaml
# Add to modules:
  - name: {MTA_ID}-db-deployer
    type: hdb
    path: gen/db                        # ← never 'db/' — deploys compiled artefact
    parameters:
      buildpack: nodejs_buildpack
    build-parameters:
      ignore:
        - node_modules/
    requires:
      - name: {MTA_ID}-db

# Add to resources:
  - name: {MTA_ID}-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared
      service-name: {MTA_ID}-hdi-container   # ← explicit service-name required
    properties:
      hdi-container-name: ${service-name}    # exposed for TARGET_CONTAINER binding

# Also add to srv module requires:
      - name: {MTA_ID}-db
```

> Also add `{ "for": "hana", "src": "db", "options": { "model": ["db", "srv"] } }` to the
> `cds.build.tasks` array in root `package.json` so `cds build --production` compiles HANA artefacts.

---

### `package.json` — Full production-ready CAP root config

```json
{
  "name": "{MTA_ID}",
  "version": "1.0.0",
  "description": "{Meaningful description}",
  "dependencies": {
    "@sap/cds": "^10",
    "@cap-js/hana": "^3",
    "express": "^4",
    "@sap/xssec": "^4"
  },
  "devDependencies": {
    "@cap-js/sqlite": "^3",
    "@sap/cds-dk": "^10",
    "cds-plugin-ui5": "0.13.6",
    "mbt": "^1"
  },
  "scripts": {
    "start":   "cds-serve",
    "watch":   "cds watch",
    "build":   "rimraf resources mta_archives && mbt build --mtar archive",
    "deploy":  "cf deploy mta_archives/archive.mtar --retries 1",
    "undeploy": "cf undeploy {MTA_ID} --delete-services --delete-service-keys"
  },
  "workspaces": ["app/*"],
  "private": true,
  "cds": {
    "requires": {
      "[production]": {
        "auth": "xsuaa"
      },
      "[development]": {
        "auth": "dummy"
      }
    },
    "features": {
      "fetch_csrf": true
    }
  }
}
```

> Key points:
>
> - `cds-plugin-ui5` pinned to `0.13.6` (exact) — prevents P-04 dual-load conflict
> - `[production].auth: "xsuaa"` — never `"dummy"` in production
> - `[development].auth: "dummy"` — correct for local `cds watch`
> - `workspaces: ["app/*"]` — workspace hoisting for multi-module projects

---

### `app/{APP_ID}/ui5.yaml` — Development server config

```yaml
specVersion: "4.0"
metadata:
  name: {APP_ID}              # ← must match sap.app.id in manifest.json exactly
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
          url: https://sapui5.hana.ondemand.com
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

> No `framework:` block — this app bootstraps from the CDN proxy above. Mixing a
> `framework:` block with the CDN proxy causes a blank-page script-load error at runtime.
> `metadata.name` must be lowercase and match `sap.app.id` in `manifest.json` — a mismatch
> breaks `validate_namespace` and causes silent Component.js load failures.

---

### `app/{APP_ID}/ui5-deploy.yaml` — Production build + zip config

```yaml
specVersion: "4.0"
metadata:
  name: {APP_ID}              # ← must match ui5.yaml metadata.name
type: application
resources:
  configuration:
    propertiesFileSourceEncoding: UTF-8
builder:
  resources:
    excludes:
      - /test/**
      - /localService/**
  customTasks:
    - name: ui5-task-zipper
      afterTask: generateCachebusterInfo
      configuration:
        archiveName: {APP_ID}           # ← produces {APP_ID}.zip — must match mta.yaml artifacts entry
        relativePaths: true
        additionalFiles:
          - xs-app.json                 # ← CRITICAL: routing config must be packaged in the zip
```

> Critical points:
>
> - `archiveName` produces `{archiveName}.zip` — the filename must exactly match the `artifacts`
>   entry in `mta.yaml` (e.g. `artifacts: ["{APP_ID}.zip"]`). A mismatch causes the app-deployer
>   module to fail silently with an empty HTML5 repo.
> - `xs-app.json` in `additionalFiles` is mandatory — without it the deployed app has no routing
>   rules and every request returns 404.
> - `metadata.name` must be identical in both `ui5.yaml` and `ui5-deploy.yaml`.
> - The build command in `app/package.json` must be:
>   `"build:cf": "ui5 build preload --clean-dest --config ui5-deploy.yaml --include-task=generateCachebusterInfo"`
