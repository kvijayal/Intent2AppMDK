# Reference Apps

Bundled, runnable starter apps the Builder copies and adapts. **Do not develop in these** — they are templates. `mcp__intent2app__scaffold_app` copies one into `output/<app>/` and rewrites its namespace.

All starters ship with the base namespace **`com.intent2app.sample`** (in all four namespace places). `scaffold_app` rewrites that token to your target namespace; if you copy by hand, replace `com.intent2app.sample` everywhere and run `mcp__intent2app__validate_namespace`.

| Starter | `scaffold_app` appType(s) | Stack | Run |
| --- | --- | --- | --- |
| `cap-service-only/` | `cap-service` | CAP service only — OData V4, HANA/SQLite, role auth, no UI | `npm install && npm start` → `http://localhost:4004` |
| `cap-fullstack-listreport/` | `cap-fe-lrop`, `cap-fe-alp`, `cap-fe-op`, `cap-fpm` | CAP + Fiori Elements List Report + Object Page | `npm install && npm run watch-listreportapp` → `http://localhost:4004` |
| `cap-fullstack-freestyle/` | `cap-freestyle` | CAP + Freestyle UI5 (TypeScript), served by cds-plugin-ui5 | `npm install && npm run watch-freestyleapp` → `http://localhost:4004` |
| `freestyle-ui5-ts/` | `freestyle-ui5` | Freestyle SAPUI5 (TypeScript) — standalone, no CAP backend | `npm install && npm run start:mock` (offline) or `start:proxy` |
| `fiori-elements-external-service/` | `external-fe` | Fiori Elements bound to external/RAP OData via EDMX | `npm install && npm run start:mock` (offline) or `start:proxy` |
| `mdk-online-crud/` | `mdk-crud-online` | MDK online CRUD app — Customers entity (ESPM OData) | `npx @sap/mdk-tools validate --project .` then deploy |
| `mdk-offline-crud/` | `mdk-crud-offline` | MDK offline CRUD app — Work Orders with sync actions | `npx @sap/mdk-tools validate --project .` then deploy |

## cap-service-only

CAP-only backend with no UI. OData V4 service, SQLite in dev / HANA Cloud in prod, role-based `@requires`/`@restrict`, `xs-security.json`, and mocked dev users. Use this as the base when the TDD calls for an API-only service, or when the UI layer will be built separately.

```bash
cd cap-service-only && npm install
npm start     # http://localhost:4004 (OData metadata + $batch)
```

## cap-fullstack-listreport

CAP + Fiori Elements List Report + Object Page. Sample domain with an enum status and a **computed criticality** (`after('READ')` in `srv/service.js`), a List Report with a semantic status column, an Object Page, role-based `@requires`/`@restrict`, `xs-security.json`, mocked dev users, and a Jest test suite. Base for the ALP/OP/FPM variants — edit manifest routing + annotations per the `fiori-bootstrap` skill.

```bash
cd cap-fullstack-listreport && npm install
npm run watch-listreportapp   # http://localhost:4004 (Fiori app served by cds-plugin-ui5)
npm test                       # Jest: $metadata, criticality boundaries, validation 400, auth 403
```

## cap-fullstack-freestyle

CAP + Freestyle UI5 (TypeScript) full-stack. The UI5 app lives under `app/freestyleapp/` and is served by `cds watch` via `cds-plugin-ui5`. Use when the UX requirements cannot be expressed with Fiori Elements annotations.

```bash
cd cap-fullstack-freestyle && npm install
npm run watch-freestyleapp    # http://localhost:4004 (UI5 app served by cds-plugin-ui5)
```

## freestyle-ui5-ts

Freestyle SAPUI5 in TypeScript (transpiled), with OPA5 integration + QUnit unit tests, an offline mock server (`ui5-mock.yaml`), and a proxy-to-backend (`ui5.yaml`). Standalone — no CAP project. Demonstrates the external-service binding pattern (proxy `/V4` + mock).

```bash
cd freestyle-ui5-ts && npm install
npm run start:mock   # offline
npm run start:proxy  # real backend (configure the proxy in ui5.yaml)
npm run unit-test ; npm run int-test
```

## fiori-elements-external-service

Fiori Elements bound to an **external/RAP** OData service. Ships a sample EDMX (`webapp/localService/mainService/metadata.xml`), local UI annotations (`webapp/annotations/annotation.xml`), mock data, an offline mock (`ui5-mock.yaml`) and proxy (`ui5.yaml`). Replace the EDMX with the real service metadata via `mcp__intent2app__gen_mock_from_edmx`, and set the backend/destination via `mcp__intent2app__configure_service`.

```bash
cd fiori-elements-external-service && npm install
npm run start:mock   # offline, sample data
npm run start:proxy  # real backend/destination
```

Clean Core note: for RAP, prefer backend CDS **metadata-extension** annotations over the local `annotation.xml` where possible; consume **released** services only.

## mdk-online-crud

MDK online CRUD reference app using the SAP ESPM sample OData service (available in SAP Mobile Services).
Demonstrates Customers entity with List/Detail/Create/Edit/Delete, full CRUD action chains, ObjectTable
with search and footer count, ObjectHeader + KeyValue detail layout, FormCell create/edit with
IsRequired validation, confirm delete dialog, modal navigation, DataSubscriptions, and i18n.

Adapted from: [SAP-samples/cloud-mdk-tutorial-samples](https://github.com/SAP-samples/cloud-mdk-tutorial-samples)
(2-Create-Your-First-Mobile-App-with-the-mobile-development-kit, Apache-2.0)

```bash
# After generating .service.metadata via VS Code MDK extension:
cd mdk-online-crud
npx @sap/mdk-tools validate --project .
npx @sap/mdk-tools deploy --target mobile --showqr --project .
```

## mdk-offline-crud

MDK offline CRUD reference app — field service work order management. Demonstrates the full offline
OData pattern: InitializeOfflineOData with filtered DefiningRequests → DownloadOfflineOData →
UploadOfflineOData before every CRUD → DownloadOfflineOData after upload. Also shows: StatusColor
rule with SAP semantic colors, ListPicker with static items, DatePicker, BarcodeScanner on search,
sync button in ActionBar, and BannerMessage for sync failures.

Adapted from: [SAP-samples/cloud-mdk-tutorial-samples](https://github.com/SAP-samples/cloud-mdk-tutorial-samples)
(4-Level-Up-with-the-mobile-development-kit, Apache-2.0)

```bash
# After generating .service.metadata:
cd mdk-offline-crud
npx @sap/mdk-tools validate --project .
npx @sap/mdk-tools deploy --target mobile --showqr --project .
```

## Additional MDK sample references

Not bundled (clone separately when needed):
- **Tutorial samples:** https://github.com/SAP-samples/cloud-mdk-tutorial-samples
  Quick start, first app, CRUD, level-up, branding, extension controls
- **Showcase apps:** https://github.com/SAP-samples/cloud-mdk-samples
  Intermediate-to-advanced samples: Sample_Applications/, Showcase_Apps/
