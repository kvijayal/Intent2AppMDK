*Part of the cap-integration skill.*

# Local proxy (`fiori-tools-proxy`)

The `fiori-tools-proxy` `backend` block (URL for VS Code vs `destination` for BAS), the `ui5.yaml` vs `ui5-local.yaml` vs `ui5-mock.yaml` split, and the `start:mock` vs `start:proxy` script pattern. Reference: the freestyle `project1` app, which proxies `/V4` to `https://services.odata.org`.

Policy: **always generate both** a mock config and a proxy config; flip between them with npm scripts so the developer is never blocked on backend access.

---

## 1. The `backend` block

`fiori-tools-proxy` forwards the app's OData calls to the real service so the browser never calls the backend directly (which would hit CORS). The `backend` array maps a path to a target.

**VS Code — target by URL:**

```yaml
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ignoreCertErrors: false
        backend:
          - path: /odata/v4/<service>     # or /sap/opu/odata4/... for S/4
            url: https://<backend-host>   # a URL reachable from your machine
```

**BAS — target by destination (no URL/secret in the repo):**

```yaml
        backend:
          - path: /odata/v4/<service>
            destination: <DEST_NAME>      # configured in the subaccount; see bas-destinations.md
```

Real example from `project1` (`ui5.yaml`), which also proxies the UI5 runtime:

```yaml
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ignoreCertErrors: false
        ui5:
          path:
            - /resources
            - /test-resources
          url: https://ui5.sap.com
        backend:
          - path: /V4
            url: https://services.odata.org
```

Rules:
- **`path`** must match the manifest `dataSources.<service>.uri` prefix (and the mock `urlPath`). For S/4 it's typically `/sap/opu/odata4/...`.
- **VS Code → `url`; BAS → `destination`.** Never put a backend URL or secret in the repo when on BAS — use the named destination.
- **`ignoreCertErrors`** stays `false` except for known self-signed dev systems.
- The `ui5:` sub-block proxies `/resources` + `/test-resources` from the UI5 CDN — only needed for apps that don't bundle UI5 locally (freestyle), not for CAP same-origin.

---

## 2. `ui5.yaml` vs `ui5-local.yaml` vs `ui5-mock.yaml`

Three configs, three purposes. `fiori run --config <file>` selects one.

| File | Purpose | Key middleware | Run via |
|---|---|---|---|
| **`ui5.yaml`** | Default / build + run against the real backend | `fiori-tools-proxy` (`backend`), appreload, preview | `npm start` |
| **`ui5-local.yaml`** | Local run that also proxies the **UI5 runtime** from the CDN (for environments without local UI5) | `fiori-tools-proxy` with `ui5.url: https://ui5.sap.com` + `backend` | `npm run start-local` |
| **`ui5-mock.yaml`** | Fully offline run against generated mock data | `sap-fe-mockserver` (no backend) | `npm run start:mock` |

Notes:
- `ui5.yaml` is also the **build** config (`ui5 build --config=ui5.yaml`).
- Keep the three in sync on `metadata.name` and service paths.
- **CAP apps need none of this for the data** — `cds watch --in-memory` serves service + UI same-origin at `http://localhost:4004`. No `fiori-tools-proxy`, no `ui5-middleware-simpleproxy`. Use the proxy/mock split only for external/RAP-consumed services.

---

## 3. `start:mock` vs `start:proxy` script pattern

Wire both run modes as npm scripts so flipping is one command. Generalised from `project1`'s `package.json` (which uses `ui5-mock.yaml` for mock and `ui5.yaml` for the proxied backend):

```jsonc
{
  "scripts": {
    // Real backend (proxy) — ui5.yaml has the fiori-tools-proxy backend block
    "start":        "fiori run --open \"test/flp.html#app-preview\"",
    "start:proxy":  "fiori run --config ./ui5.yaml --open \"test/flp.html#app-preview\"",

    // Offline mock — ui5-mock.yaml has the sap-fe-mockserver block
    "start:mock":   "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",

    // Local run proxying the UI5 runtime from CDN
    "start-local":  "fiori run --config ./ui5-local.yaml --open \"test/flp.html#app-preview\"",

    // Tests run against the mock so they need no backend
    "unit-test":    "fiori run --config ./ui5-mock.yaml --open \"test/unit/unitTests.qunit.html\"",
    "int-test":     "fiori run --config ./ui5-mock.yaml --open \"test/integration/opaTests.qunit.html\"",

    "build":        "ui5 build --config=ui5.yaml --clean-dest --dest dist"
  }
}
```

(`project1` names them `start` / `start-mock`; `start:proxy` / `start:mock` is the clearer convention to generate.)

Usage:
- **Demo / offline / on a plane:** `npm run start:mock`.
- **Integration against the real service:** `npm run start:proxy` (VS Code) — in BAS the same `ui5.yaml` uses a `destination:` instead of `url:`.
- **Tests:** always run on the mock so CI needs no backend/destination.

---

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| CORS error in VS Code | App called the backend directly, bypassing the proxy | Ensure the app calls the **proxy path** (`dataSources.uri`), not the absolute backend URL |
| 404 on `$metadata` via proxy | `backend.path` ≠ service path | Align `backend.path`, `dataSources.uri`, and (mock) `urlPath` |
| Works on mock, fails on proxy | Auth / destination | Verify the destination auth + principal propagation (`bas-destinations.md`) |
| `start:proxy` can't reach `url` | Host unreachable from your machine | Use a destination (BAS) or a reachable URL/VPN; don't set `ignoreCertErrors: true` to mask it |
