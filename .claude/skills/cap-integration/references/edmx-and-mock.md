*Part of the destinations-and-services skill.*

# EDMX & offline mock

Acquiring and placing the EDMX/$metadata, the `sap-fe-mockserver` config in `ui5-mock.yaml`, generating sample data, and wiring `manifest.json` `dataSources.localUri`. Prefer `mcp__intent2app__gen_mock_from_edmx`; this file documents what it does so you can do it by hand if the MCP is unavailable.

The mock layer is the **offline-first** anchor: once the EDMX is captured, the whole UI can be built and run with **no system access**.

---

## 1. Acquire the EDMX / $metadata

The EDMX is the service's design-time contract (entity sets, types, navigation, annotations). Get it from whichever source applies:

- **From a running service:** open `<service-url>/$metadata` in a browser and save the XML.
- **From BAS:** the service catalog / "Service Center" can download the metadata for a destination's service.
- **From a colleague / repo:** a saved `.xml` / `.edmx` file.
- **For CAP you build:** there is **no external EDMX** — the contract is your local model (`cds compile '*'`), and `cds watch` serves it same-origin. Skip the mock server entirely for CAP (use in-memory sqlite).

Confirm it's **OData V4** before using it (HARD CONSTRAINT). V2 metadata is a non-starter.

---

## 2. Place it

Put the EDMX where the app and mock both expect it:

```
webapp/
└── localService/
    └── <service>/
        ├── metadata.xml          ← the EDMX you captured
        └── data/                 ← generated sample data (step 4)
            ├── <EntitySet1>.json
            └── <EntitySet2>.json
```

`<service>` is a short name for the service (e.g. `mainService`, or `salesorder`). The reference freestyle app `project1` uses `webapp/localService/mainService/metadata.xml`.

---

## 3. `ui5-mock.yaml` — sap-fe-mockserver config

`gen_mock_from_edmx` writes a `ui5-mock.yaml` whose `sap-fe-mockserver` middleware mounts the metadata + data at the service path. Generic form from the core:

```yaml
# yaml-language-server: $schema=https://sap.github.io/ui5-tooling/schema/ui5.yaml.json
specVersion: "4.0"
metadata:
  name: <app-namespace>          # all lowercase
type: application
server:
  customMiddleware:
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /odata/v4/<service>       # MUST match manifest dataSources.uri (sans trailing slash)
            metadataPath: ./webapp/localService/<service>/metadata.xml
            mockdataPath: ./webapp/localService/<service>/data
            generateMockData: true
        annotations: []
```

Real example (the `project1` app, which mocks the same TripPin path it proxies):

```yaml
    - name: sap-fe-mockserver
      beforeMiddleware: csp
      configuration:
        mountPath: /
        services:
          - urlPath: /V4/(S(4appsbv3cusayoxwflo3rhn1))/TripPinServiceRW
            metadataPath: ./webapp/localService/mainService/metadata.xml
            mockdataPath: ./webapp/localService/mainService/data
            generateMockData: true
        annotations: []
```

Key points:
- **`urlPath` must equal the manifest `dataSources.<service>.uri`** (without the trailing slash). A mismatch is the #1 reason the mock shows no data.
- **`beforeMiddleware: csp`** so the mock is served before the CSP middleware rejects it.
- **`generateMockData: true`** auto-fabricates data when a `data/*.json` file is missing for an entity set.
- Local annotation files (if any) go in the `annotations: []` array; backend metadata-extensions don't.

`ui5-mock.yaml` is a **separate** config from `ui5.yaml`/`ui5-local.yaml` — see `local-proxy.md` for which runs when.

---

## 4. Generate sample data

Two ways to fill `…/data/<EntitySet>.json`:

- **Auto-generate** — `generateMockData: true` makes the mock server synthesize plausible values per property type on the fly. Fast, zero-maintenance, fine for "does it render".
- **Seed explicit data** — drop a JSON array per entity set for realistic/edge-case data (needed for ALP KPIs, criticality colours, specific filter results):

```json
// webapp/localService/salesorder/data/SalesOrders.json
[
  { "ID": "11111111-1111-1111-1111-111111111111", "orderNo": "SO-1001", "customer": "Acme",  "status": "APPROVED",  "grossAmount": 1500.00, "currency_code": "USD" },
  { "ID": "22222222-2222-2222-2222-222222222222", "orderNo": "SO-1002", "customer": "Globex", "status": "SUBMITTED", "grossAmount":  900.00, "currency_code": "EUR" },
  { "ID": "33333333-3333-3333-3333-333333333333", "orderNo": "SO-1003", "customer": "Initech","status": "REJECTED",  "grossAmount":  250.00, "currency_code": "USD" }
]
```

Seed at least one row per criticality value so semantic colours are visible in the mock. File name = entity **set** name; foreign keys use the flattened `<assoc>_<key>` form (e.g. `currency_code`).

---

## 5. Wire `manifest.json` dataSources

The app must point at the EDMX for offline metadata via `localUri`:

```json
"dataSources": {
  "<service>": {
    "uri": "/odata/v4/<service>/",
    "type": "OData",
    "settings": {
      "odataVersion": "4.0",
      "localUri": "localService/<service>/metadata.xml",
      "annotations": []
    }
  }
}
```

- **`uri`** = the runtime service path (what the proxy forwards). Must match the mock `urlPath` and the proxy `backend.path`.
- **`localUri`** = the captured EDMX, used for offline metadata and by tooling.
- **`odataVersion: '4.0'`** always.

Run it: `npm run start:mock` (the script points `fiori run --config ./ui5-mock.yaml`). See `local-proxy.md` for the `start:mock` vs `start:proxy` script pattern.

**Troubleshooting:** mock shows no data → `urlPath` vs `dataSources.uri` mismatch, or `localUri`/`mockdataPath` wrong. Re-run `gen_mock_from_edmx` and re-check all three paths line up.
