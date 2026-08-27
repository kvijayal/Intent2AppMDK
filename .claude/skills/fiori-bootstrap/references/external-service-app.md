*Part of the fiori-app-bootstrapping skill.*

# External-service-bound app (RAP / existing OData)

When the backend already exists — a RAP service, an S/4HANA OData V4 API, or any deployed service you do not own — the Fiori app binds to it over an **EDMX metadata file** and runs locally in one of two modes:

- **mock** — `sap-fe-mockserver` serves data from the EDMX + local mock data (offline, no backend).
- **proxy** — `fiori-tools-proxy` forwards requests to the real backend (BAS destination or a URL).

This mirrors `Claude-Code/project1` (bound to the public TripPin V4 service). For the EDMX download/handling and BAS destinations, also see the `destinations-and-services` skill. Clean Core rule: never modify the core service; UI-only annotation tweaks go in a **local** `annotation.xml` (see `fiori-annotations` `references/local-vs-backend-annotations.md`).

## manifest.json — dataSource with localUri + annotations

The runtime `uri` is the real service path. `localUri` points to the saved EDMX, which the mock server and design-time tooling use. List any local annotation file in `annotations` and as its own data source.

```jsonc
"sap.app": {
  "id": "myexternalapp",
  "dataSources": {
    "mainService": {
      "uri": "/sap/opu/odata4/sap/zpurchaseorder/srvd/sap/zpurchaseorder/0001/",
      "type": "OData",
      "settings": {
        "odataVersion": "4.0",
        "localUri": "localService/mainService/metadata.xml",
        "annotations": [ "localAnnotations" ]
      }
    },
    "localAnnotations": {
      "type": "ODataAnnotation",
      "uri": "annotations/annotation.xml",
      "settings": { "localUri": "annotations/annotation.xml" }
    }
  }
}
```

The EDMX is saved at `webapp/localService/mainService/metadata.xml`. App-specific UI annotations (if any) live at `webapp/annotations/annotation.xml`.

## ui5.yaml — proxy to the real backend

`fiori-tools-proxy` serves UI5 from the CDN and forwards the service path to the backend. Use `destination` in BAS, or a `url` for a public/dev endpoint (project1 uses the latter).

```yaml
specVersion: "4.0"
metadata:
  name: myexternalapp           # lowercase, == namespace
type: application
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ignoreCertErrors: false
        ui5:
          path: [ /resources, /test-resources ]
          url: https://ui5.sap.com
        backend:
          - path: /sap                # forward the OData base path…
            destination: ZPO_BACKEND  # …to a BAS destination (or use `url:` for a direct endpoint)
    - name: fiori-tools-appreload
      afterMiddleware: compression
      configuration: { port: 35729, path: webapp, delay: 300 }
    - name: fiori-tools-preview
      afterMiddleware: fiori-tools-appreload
      configuration: { flp: { theme: sap_horizon } }
```

For a TypeScript app, also include `ui5-tooling-transpile-middleware` (and the matching `builder` task), exactly as in `freestyle-standalone.md`.

## ui5-mock.yaml — offline with sap-fe-mockserver

Identical to `ui5.yaml` but adds the `sap-fe-mockserver` middleware. It serves the service path from the EDMX; with `generateMockData: true` it fabricates plausible data, or it reads JSON from `mockdataPath`.

```yaml
specVersion: "4.0"
metadata:
  name: myexternalapp
type: application
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        ui5: { path: [ /resources, /test-resources ], url: https://ui5.sap.com }
    - name: fiori-tools-appreload
      afterMiddleware: compression
      configuration: { port: 35729, path: webapp, delay: 300 }
    - name: fiori-tools-preview
      afterMiddleware: fiori-tools-appreload
      configuration: { flp: { theme: sap_horizon } }
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /sap/opu/odata4/sap/zpurchaseorder/srvd/sap/zpurchaseorder/0001
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: true
        annotations: []
```

The middleware module is `@sap-ux/ui5-middleware-fe-mockserver` (declared `"2"` in `devDependencies`). The `urlPath` must match the service path (without the trailing slash) so the mock intercepts the right requests.

## package.json — start:mock vs start:proxy

Two run modes, each pointing at its config. Convention: `start-mock` (offline) and `start` / `start-local` (proxy).

```jsonc
"scripts": {
  "start":      "fiori run --open \"test/flp.html#app-preview\"",
  "start-mock": "fiori run --config ./ui5-mock.yaml --open \"test/flp.html#app-preview\"",
  "start-local":"fiori run --config ./ui5.yaml --open \"test/flp.html#app-preview\"",
  "build":      "ui5 build --config=ui5.yaml --clean-dest --dest dist",
  "unit-test":  "fiori run --config ./ui5-mock.yaml --open \"test/unit/unitTests.qunit.html\"",
  "int-test":   "fiori run --config ./ui5-mock.yaml --open \"test/integration/opaTests.qunit.html\""
},
"devDependencies": {
  "@ui5/cli": "^4.0.33",
  "@sap/ux-ui5-tooling": "1",
  "@sap-ux/ui5-middleware-fe-mockserver": "2"
}
```

Tests run against the **mock** config (deterministic data) — never against a live backend.

## Floorplan on top

This is orthogonal to the floorplan: an external-bound app can be List Report + Object Page, ALP, Object Page, or freestyle. Wire the routing per the matching reference; only the data-source/mock/proxy plumbing differs.

## Hard rules

- Save the EDMX locally (`localService/.../metadata.xml`) and reference it via `localUri`.
- Tests + offline dev use the mock; the proxy is for live verification only.
- No hardcoded backend URLs in app code — the URL/destination lives in `ui5.yaml`, requests use the relative service path.
- Clean Core: app-only UI annotations go in a local `annotation.xml`; never edit the backend service to suit one app's layout.

## Checklist

`dataSources.mainService` has runtime `uri` + `localUri` (saved EDMX) · local `annotation.xml` registered (if used) · `ui5.yaml` proxy `backend` (destination/url) · `ui5-mock.yaml` adds `sap-fe-mockserver` with matching `urlPath` · `start-mock` vs proxy scripts · `@sap-ux/ui5-middleware-fe-mockserver` 2 in devDeps · tests run on mock.
