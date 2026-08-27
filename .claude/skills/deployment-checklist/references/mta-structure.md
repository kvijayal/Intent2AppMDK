*Part of the deployment-checklist skill.*

# MTA Structure — Required Modules and Resources

A complete, annotated `mta.yaml` for a CAP + Fiori app deployed on Cloud Foundry / BTP.
Use this as the canonical reference; compare the app's `mta.yaml` against it during review.

---

## Complete `mta.yaml` (CAP + Fiori Elements, XSUAA auth)

```yaml
_schema-version: "3.3.0"
ID: myapp
version: 1.0.0
description: My CAP + Fiori App
parameters:
  enable-parallel-deployments: true   # modules deploy in parallel where deps allow

modules:

  # ── 1. CAP service (Node.js) ────────────────────────────────────────────────
  - name: myapp-srv
    type: nodejs
    path: gen/srv               # produced by `cds build --production`
    parameters:
      buildpack: nodejs_buildpack
      health-check-type: http
      health-check-http-endpoint: /health   # CAP exposes this automatically
    requires:
      - name: myapp-auth        # xsuaa: validate JWT tokens
      - name: myapp-db          # SAP HANA or sqlite (dev)
    provides:
      - name: srv-api           # makes the URL available to the approuter
        properties:
          srv-url: ${default-url}

  # ── 2. SAP HANA DB deployer ────────────────────────────────────────────────
  # Omit if using sqlite (local dev only — HANA is required for production)
  - name: myapp-db-deployer
    type: hdb
    path: gen/db
    requires:
      - name: myapp-hana

  # ── 3. App router ──────────────────────────────────────────────────────────
  - name: myapp-approuter
    type: approuter.nodejs
    path: approuter
    parameters:
      disk-quota: 256M
      memory: 256M
      health-check-type: port   # approuter has no /health; use port check
    requires:
      - name: myapp-auth        # xsuaa: authenticate the user
      - name: myapp-destination # destination service: resolve backend destination
      - name: myapp-html5-rt    # html5-apps-repo runtime: serve the UI
      - name: srv-api           # provided by myapp-srv above (optional — for dynamic routing)
        group: destinations
        properties:
          forwardAuthToken: true
          name: srv-api
          url: ~{srv-url}

  # ── 4. HTML5 app content deployer ──────────────────────────────────────────
  - name: myapp-app-content
    type: com.sap.application.content
    path: .
    requires:
      - name: myapp-html5-host
        parameters:
          content-target: true
    build-parameters:
      build-result: resources
      requires:
        - name: myappui            # the HTML5 module below
          artifacts: [myappui.zip]
          target-path: resources/

  # ── 5. HTML5 module (the Fiori app itself) ─────────────────────────────────
  - name: myappui
    type: html5
    path: app/myapp             # the Fiori app folder
    build-parameters:
      build-result: dist
      builder: custom
      commands:
        - npm ci
        - npm run build          # runs @ui5/cli build
      supported-platforms: []

resources:

  # ── XSUAA (authentication + authorization) ─────────────────────────────────
  - name: myapp-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json  # scopes/role-templates must match CDS @restrict roles

  # ── Destination service (resolves BTP destinations at runtime) ─────────────
  - name: myapp-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  # ── HTML5 Application Repository — host (stores the built UI) ──────────────
  - name: myapp-html5-host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host

  # ── HTML5 Application Repository — runtime (serves the UI to the browser) ──
  - name: myapp-html5-rt
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-runtime

  # ── SAP HANA Cloud (production DB) ─────────────────────────────────────────
  # Omit for sqlite-only apps
  - name: myapp-hana
    type: com.sap.xs.hana-HDI-container
    parameters:
      service: hana
      service-plan: hdi-shared

  # ── Connectivity service (on-premise via Cloud Connector) ──────────────────
  # Add ONLY if the app calls on-premise systems via Cloud Connector
  # - name: myapp-connectivity
  #   type: org.cloudfoundry.managed-service
  #   parameters:
  #     service: connectivity
  #     service-plan: lite
```

---

## Common omissions and their runtime symptoms

| Missing | Symptom after deploy | Fix |
|---|---|---|
| `xsuaa` not bound to `*-srv` | Every OData call returns 401 (token not validated) | Add `- name: myapp-auth` to `*-srv` requires |
| `xsuaa` not bound to approuter | Login loop / 403 after SAML redirect | Add `- name: myapp-auth` to approuter requires |
| `destination` resource absent | Destination name can't be resolved → 502 Bad Gateway | Add `myapp-destination` resource + bind to approuter |
| `html5-apps-repo` host missing | UI files never pushed → 404 on all app routes | Add `myapp-html5-host` resource + content deployer module |
| `html5-apps-repo` runtime missing | Approuter can't serve the UI → 404 | Add `myapp-html5-rt` resource + bind to approuter |
| `health-check-type` absent on CAP srv | CF marks instance as crashed during rolling deploy | Add `health-check-type: http` + `health-check-http-endpoint: /health` |
| `build-result: dist` missing on HTML5 module | `mbt build` packages empty zip → blank app | Verify `npm run build` outputs to `dist/` |

---

## Consume-only variant (no CAP backend)

When the app binds to an external RAP / OData service and has no CAP service, drop modules 1
and 2 entirely. The approuter still needs `destination` to resolve the backend:

```yaml
modules:
  - name: myapp-approuter    # same as above, minus srv-api dependency
  - name: myapp-app-content  # same
  - name: myappui            # same

resources:
  - name: myapp-auth         # xsuaa still needed for user login
  - name: myapp-destination  # destination to the external service
  - name: myapp-html5-host
  - name: myapp-html5-rt
  # no hana, no connectivity unless on-premise
```

---

## Build and deploy commands

```bash
# Build the MTA archive
mbt build

# Deploy to CF (target space must be set with cf target -o <org> -s <space>)
cf deploy mta_archives/myapp_1.0.0.mtar --retries 0

# Update an existing XSUAA instance after xs-security.json change (do NOT recreate — loses role assignments)
cf update-service myapp-auth -c xs-security.json
```
