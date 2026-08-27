*Part of the destinations-and-services skill.*

# Deploy: approuter & MTA

A worked approuter `xs-app.json` route, an `mta.yaml` with the destination + xsuaa resources + html5 module, and how each piece maps back to the local proxy config. Deploy target is Cloud Foundry on BTP. `mcp__intent2app__configure_service` writes these as `service-config.snippets.md` to merge.

The mapping in one line: the **local proxy `backend`** (dev) becomes the **approuter route + destination** (deploy); the **destination name** is the constant that ties them together.

---

## 1. approuter `xs-app.json`

The approuter is the single entry point: it authenticates the user (xsuaa) and routes OData calls to the backend destination, and serves the UI from the HTML5 repo.

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/salesorder(.*)$",
      "target": "$1",
      "destination": "S4_SALES",
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

- **`source`** (regex) matches the path the app calls — the **same path** as the local proxy `backend.path` and the manifest `dataSources.uri`.
- **`destination`** = the BTP destination name (the same `S4_SALES` used in BAS dev). The approuter forwards the user's token there.
- **`authenticationType: "xsuaa"`** enforces login; **`csrfProtection: true`** for write-capable OData.
- The catch-all route serves the UI from `html5-apps-repo-rt`.

---

## 2. `mta.yaml`

The deployment descriptor: an approuter module, the HTML5 app module, and the resources (xsuaa + destination) bound to them.

```yaml
_schema-version: "3.3.0"
ID: salesorder
version: 1.0.0
parameters:
  enable-parallel-deployments: true

modules:
  # ── CAP service (if you built one; omit for consume-only apps) ───────────────
  - name: salesorder-srv
    type: nodejs
    path: gen/srv
    requires:
      - name: salesorder-auth          # xsuaa
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}

  # ── App router ──────────────────────────────────────────────────────────────
  - name: salesorder-approuter
    type: approuter.nodejs
    path: approuter
    requires:
      - name: salesorder-auth          # xsuaa: authenticate the user
      - name: salesorder-destination   # destination service: reach the backend
      - name: salesorder-html5-runtime # serve the UI
    parameters:
      disk-quota: 256M
      memory: 256M

  # ── HTML5 app deployer (pushes the built UI to the HTML5 repo) ───────────────
  - name: salesorder-app-content
    type: com.sap.application.content
    path: .
    requires:
      - name: salesorder-html5-repo-host
        parameters: { content-target: true }
    build-parameters:
      build-result: resources
      requires:
        - name: salesorderui            # the html5 module below
          artifacts: [ salesorderui.zip ]
          target-path: resources/

  - name: salesorderui
    type: html5
    path: app/salesorder                # the Fiori app folder
    build-parameters:
      build-result: dist
      builder: custom
      commands: [ "npm ci", "npm run build" ]
      supported-platforms: []

resources:
  - name: salesorder-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json          # scopes/role-templates (see authorization.md)

  - name: salesorder-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  - name: salesorder-html5-repo-host
    type: org.cloudfoundry.managed-service
    parameters: { service: html5-apps-repo, service-plan: app-host }

  - name: salesorder-html5-runtime
    type: org.cloudfoundry.managed-service
    parameters: { service: html5-apps-repo, service-plan: app-runtime }
```

- **xsuaa** (`salesorder-auth`) is bound to both the approuter and the CAP service; it's created from `xs-security.json`, so the dev-mocked roles and prod scopes match (see `cap-best-practices/authorization.md`).
- **destination** (`salesorder-destination`) is the service that resolves the `S4_SALES` name at runtime; the destination itself is defined in the subaccount (or as an `mta.yaml` destination-content resource).
- **html5-apps-repo** host+runtime store and serve the built UI.
- For a **consume-only** app (no CAP build), drop the `salesorder-srv` module and its `srv-api`.

Build & deploy: `mbt build` → `cf deploy mta_archives/salesorder_1.0.0.mtar`.

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
