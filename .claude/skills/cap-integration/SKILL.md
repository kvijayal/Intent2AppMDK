---
name: cap-integration
description: >
  How Intent2App connects a Fiori app to its OData service for BOTH offline mock and a real backend
  (RAP / existing service / CAP). Covers EDMX/$metadata handling, sap-fe-mockserver mock generation,
  the fiori-tools-proxy backend block, BAS destinations, and deploy-time approuter xs-app.json + mta
  destination resources. Load when binding an app to a service, generating a mock, configuring a
  proxy/destination, or fixing OData 404 / CORS / "service not available". Keywords: destination,
  EDMX, $metadata, mock server, ui5-mock.yaml, fiori-tools-proxy, xs-app.json, approuter, mta, BAS.
---

# Destinations & Service Consumption

> Complements `fiori-bootstrap`. Use `mcp__intent2app__gen_mock_from_edmx` (offline mock) and
> `configure_service` (manifest + proxy/approuter/mta snippets). Default policy: **always generate
> both** a mock (offline) and the proxy/destination config (real), and flip with npm scripts.
>
> **Building deployment artifacts from scratch?** This skill. **Auditing existing artifacts before `mbt build` / `cf deploy`?** Use the `deployment-checklist` skill instead.

## The three layers

1. **Design-time contract** — the service `$metadata`/EDMX. For RAP/existing services, the developer
   supplies the EDMX file (offline-first). For CAP, the contract is the local model (`cds compile`).
2. **Local run** — mock (offline) and/or proxy (real).
3. **Deploy** — approuter route + BTP destination.

## 1. Offline mock (runs anywhere)

`gen_mock_from_edmx` copies the EDMX to `webapp/localService/<service>/metadata.xml`, generates sample
data per entity set under `…/data/`, and writes `ui5-mock.yaml` with `sap-fe-mockserver`:
```yaml
server:
  customMiddleware:
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /odata/v4/<service>
            metadataPath: ./webapp/localService/<service>/metadata.xml
            mockdataPath: ./webapp/localService/<service>/data
            generateMockData: true
```
`manifest.json` `dataSources.<service>.settings.localUri` must point at that metadata. Run `npm run start:mock`.

## 2. Real backend via proxy (`fiori-tools-proxy`)

`ui5.yaml` / `ui5-local.yaml`:
```yaml
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        backend:
          - path: /odata/v4/<service>      # or /sap/opu/odata4/... for S/4
            url: https://<backend-host>     # VS Code: a reachable URL
            # destination: <DEST_NAME>       # BAS: use a destination instead of url
```
Run `npm run start:proxy`. (This is exactly how `reference-apps/freestyle-ui5-ts` proxies `/V4`; for the CAP-embedded case use `reference-apps/cap-fullstack-freestyle` and `npm run watch-freestyleapp` instead.)

## 3. BAS destinations

In BAS, configure the destination in the subaccount (Connectivity → Destinations) with the backend
URL and auth (e.g. `OAuth2SAMLBearerAssertion` / `PrincipalPropagation`). Reference it by name in the
proxy `destination:` field above. No URL/secret lives in the repo.

## 4. Deploy (Cloud Foundry / MTA)

- **approuter `xs-app.json`** route:
  ```json
  { "source": "/odata/v4/<service>(.*)", "target": "$1", "destination": "<DEST_NAME>",
    "authenticationType": "xsuaa", "csrfProtection": true }
  ```
- **`mta.yaml`** destination + xsuaa resources bound to the approuter; html5 module for the app.
`configure_service` writes these as `service-config.snippets.md` to merge.

## Clean Core

Consume **released/public** OData services only. The destination must point at a released service; do
not target a modified or non-released core endpoint. No hardcoded URLs or secrets in the app — always
a destination/env var.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 on `$metadata` | wrong service path / destination | compare manifest `dataSources.uri` with the real service path; test the destination in BAS |
| CORS error in VS Code | calling backend directly | route through `fiori-tools-proxy` (don't bypass it) |
| Mock shows no data | `localUri`/mock paths mismatch | re-run `gen_mock_from_edmx`; check `ui5-mock.yaml` paths |
| Works on mock, fails on proxy | auth/destination | verify destination auth + principal propagation |

See [`references/edmx-and-mock.md`](references/edmx-and-mock.md), [`references/local-proxy.md`](references/local-proxy.md), [`references/bas-destinations.md`](references/bas-destinations.md), [`references/deploy-approuter-mta.md`](references/deploy-approuter-mta.md).
