*Part of the cap-integration skill.*

# Deploy: xs-app.json & MTA (html5-apps-repo pattern)

> **No standalone approuter.** The BTP HTML5 Application Runtime (`html5-apps-repo`) is the public entry
> point — it reads `xs-app.json` from the uploaded app bundle and handles routing. There is no
> `approuter.nodejs` module in this pattern. Use `mta-reviewer` rule G1 to flag any legacy approuter modules.

A worked `xs-app.json` route config, an `mta.yaml` using the html5-apps-repo pattern, and how each piece maps back to the local proxy config. Deploy target is Cloud Foundry on BTP. `mcp__intent2app__configure_service` writes these as `service-config.snippets.md` to merge.

The mapping in one line: the **local proxy `backend`** (dev) becomes the **destination + xs-app.json route** (deploy); the **destination name** is the constant that ties them together.

---

## 1. UI app `xs-app.json`

Each UI5 app bundle contains its own `xs-app.json`. The HTML5 Application Runtime reads it at request time to route OData calls to the backend destination and serve the app's own static files.

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/salesorder(.*)$",
      "target": "$1",
      "destination": "salesorder-srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },
    {
      "source": "^/sap/opu/odata4/(.*)$",
      "target": "/sap/opu/odata4/$1",
      "destination": "S4_SALES",
      "authenticationType": "xsuaa",
      "csrfProtection": true
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

- **`source`** (regex) must match the `dataSources.uri` path in `manifest.json` exactly.
- **`destination`** name must exactly match the `Name` declared in `mta.yaml` destination `init_data` — a mismatch causes a silent 404 at runtime (see `mta-reviewer` rule DS_XS1).
- **`authenticationType: "xsuaa"`** enforces login; **`csrfProtection: true`** for write-capable OData.
- The catch-all route serves the app from `html5-apps-repo-rt` — this is the managed runtime, not a custom approuter.

---

## 2. `mta.yaml` (html5-apps-repo pattern)

No standalone approuter module. The HTML5 Application Runtime serves the UI; the Destination Service wires the frontend to the CAP backend via JWT forwarding.

```yaml
_schema-version: "3.3"
ID: salesorder
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
  # ── CAP service ──────────────────────────────────────────────────────────────
  - name: salesorder-srv
    type: nodejs
    path: gen/srv
    parameters:
      buildpack: nodejs_buildpack
      memory: 512M
    build-parameters:
      builder: npm-ci
      ignore: ["node_modules/"]
    requires:
      - name: salesorder-auth
      - name: salesorder-destination
    provides:
      - name: srv-api
        properties:
          forwardAuthToken: true         # ← CRITICAL: forwards JWT to CAP
          srv-url: ${default-url}

  # ── HTML5 app module (builds and packages the Fiori app) ────────────────────
  - name: salesorderui
    type: html5
    path: app/salesorder
    build-parameters:
      build-result: dist
      builder: custom
      commands: ["npm ci", "npm run build"]
      supported-platforms: []

  # ── App-deployer (uploads zip to html5-apps-repo) ───────────────────────────
  - name: salesorder-app-deployer
    type: com.sap.application.content
    path: gen
    requires:
      - name: salesorder-html5-repo-host
        parameters: { content-target: true }
    build-parameters:
      build-result: app/
      requires:
        - name: salesorderui
          artifacts: ["salesorderui.zip"]
          target-path: app/

  # ── Destination-content (registers service-binding destinations) ─────────────
  - name: salesorder-destination-content
    type: com.sap.application.content
    path: .
    build-parameters:
      no-source: true
    requires:
      - name: salesorder-auth
        parameters:
          service-key: { name: salesorder-auth-key }
      - name: salesorder-html5-repo-host
        parameters:
          service-key: { name: salesorder-html5-repo-host-key }
      - name: srv-api
      - name: salesorder-destination
        parameters: { content-target: true }
    parameters:
      content:
        instance:
          existing_destinations_policy: update
          destinations:
            - Name: salesorder-html5-repository
              ServiceInstanceName: salesorder-html5-app-host
              ServiceKeyName: salesorder-html5-repo-host-key
              sap.cloud.service: salesorder.service
            - Authentication: OAuth2UserTokenExchange
              Name: salesorder-auth
              ServiceInstanceName: salesorder-xsuaa-service
              ServiceKeyName: salesorder-auth-key
              sap.cloud.service: salesorder.service

resources:
  - name: salesorder-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      service-name: salesorder-xsuaa-service
      path: ./xs-security.json

  - name: salesorder-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite
      service-name: salesorder-destination-service
      config:
        HTML5Runtime_enabled: true
        init_data:
          instance:
            existing_destinations_policy: update
            destinations:
              - Authentication: NoAuthentication
                HTML5.DynamicDestination: true
                HTML5.ForwardAuthToken: true   # ← also required here (both places)
                HTML5.Timeout: 600000
                Name: salesorder-srv-api       # ← must match xs-app.json route destination
                ProxyType: Internet
                Type: HTTP
                URL: ~{srv-api/srv-url}
              - Authentication: NoAuthentication
                Name: ui5
                ProxyType: Internet
                Type: HTTP
                URL: https://ui5.sap.com
    requires:
      - name: srv-api

  - name: salesorder-html5-repo-host
    type: org.cloudfoundry.managed-service
    parameters:
      service: html5-apps-repo
      service-plan: app-host
      service-name: salesorder-html5-app-host
```

Key points:

- **No `approuter.nodejs` module** — the HTML5 Application Runtime is the public entry point.
- **`forwardAuthToken: true`** must appear in **both** `srv-api.properties` (srv module) and the destination `init_data` — omitting either breaks JWT propagation.
- **`salesorder-srv-api`** in `init_data` must match the `destination` field in `xs-app.json` exactly.
- For a **consume-only** app (no CAP build), drop the `salesorder-srv` module and replace `~{srv-api/srv-url}` with the hardcoded backend destination URL from the subaccount.

Build & deploy: `mbt build --mtar salesorder.mtar --platform cf` → `cf deploy salesorder.mtar --strategy rolling --no-confirm`.

---

## 3. How it maps to the local proxy

Everything you set up for local dev has a deploy counterpart — same paths, same destination name:

| Concern | Local dev | Deploy |
|---|---|---|
| Route OData to backend | `fiori-tools-proxy` `backend.path` | `xs-app.json` route `source` |
| Backend target | `url:` (VS Code) / `destination:` (BAS) | `destination` resource (`mta.yaml`) → subaccount destination |
| Destination name | `S4_SALES` (in `ui5.yaml`) | `S4_SALES` (in `xs-app.json` + subaccount) — **identical** |
| Auth | mocked users (`cds watch`) / basic | `xsuaa` (token via approuter) |
| Roles/scopes | mocked roles in `package.json` | `xs-security.json` bound via `salesorder-auth` |
| Serve the UI | `fiori run` / `cds watch` | html5-apps-repo + approuter catch-all route |
| Service path | manifest `dataSources.uri` | unchanged — same `uri`, routed by the approuter |

Because the **service path and destination name are constant** across dev and deploy, moving from `npm run start:proxy` to a deployed app changes only *where* the destination resolves — not the app code. That's the payoff of never hardcoding URLs/secrets and always routing through the proxy/approuter.

---

## 4. Clean Core & secrets

- The destination must point at a **released/public** OData service — never a modified or non-released core endpoint.
- No URLs or secrets in the MTA or repo: the **destination resource** resolves the connection at runtime; xsuaa handles identity. The only literal is the **destination name**.
- The app stays **separately deployable** (its own MTA), consuming released APIs side-by-side — the BTP Clean Core model.
