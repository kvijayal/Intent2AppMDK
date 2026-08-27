---
name: fiori-bootstrap
description: >
  How to bootstrap every SAP Fiori app type for Intent2App without external generators/MCP — by
  copying a bundled reference starter and editing manifest routing/config. Covers the namespace
  consistency rule and per-floorplan config for Analytical List Page (ALP), List Report + Object
  Page, Object Page, FPM, Freestyle UI5 (standalone or in-CAP), and external-service-bound apps.
  Load when scaffolding or wiring a Fiori app, editing manifest.json routing/targets, or fixing
  "failed to load Component.js". Keywords: manifest.json, sap.fe.templates, ListReport, ObjectPage,
  AnalyticalListPage, FPM, sap.fe.core, contextPath, resource-roots, ui5.yaml, namespace, bootstrap.
---

# Fiori App Bootstrapping (no external generator)

## Quick load — pick ONE reference for your appType, load nothing else

| appType | Load this reference only |
|---|---|
| `cap-fe-lrop` · `cap-fe-op` · `external-fe` (V4) | [`references/list-report-op.md`](references/list-report-op.md) |
| `cap-fe-alp` (V4, CAP) | [`references/analytical-list-page.md`](references/analytical-list-page.md) |
| `cap-fe-alp` (V2, external) | [`references/bootstrap-alp-v2.md`](references/bootstrap-alp-v2.md) |
| `cap-fpm` | [`references/fpm.md`](references/fpm.md) |
| `cap-freestyle` · `freestyle-ui5` (TypeScript, default) | [`references/bootstrap-freestyle-typescript.md`](references/bootstrap-freestyle-typescript.md) |
| Freestyle plain JS (explicitly requested) | [`references/bootstrap-freestyle-js.md`](references/bootstrap-freestyle-js.md) |
| `external-fe` RAP / EDMX-bound | [`references/external-service-app.md`](references/external-service-app.md) |

Load the one that matches. Only load additional references if the first one is insufficient for your specific sub-task.

> Complements `CLAUDE.md` and `context/Bootstrapping.md`. Use `mcp__intent2app__scaffold_app` to copy
> a starter and rewrite the namespace, then `validate_namespace`. If the MCP is unavailable, copy the
> matching `reference-apps/` folder by hand and follow this skill.

## The namespace rule (the #1 failure)

The **identical** namespace string must appear in all four places, and `ui5.yaml metadata.name` must be **all lowercase** (a–z, 0–9, dash, dot):

| Place | Field |
|---|---|
| `Component.(js\|ts)` | `extend("<ns>.Component")` / `@namespace <ns>` |
| `manifest.json` | `sap.app.id` |
| `index.html` | `data-sap-ui-resource-roots='{"<ns>": "./"}'` |
| `ui5.yaml` | `metadata.name` (lowercase) |

Always run `mcp__intent2app__validate_namespace` after scaffolding or any edit to these files.

## The CAP serving rule (the #1 blank-page failure)

For a Fiori app **inside a CAP project** (`app/<name>/`, served by `cds watch` via `cds-plugin-ui5`), two things must hold or the app renders a **blank page with `sap-ui-core.js not found`**:

1. **`cds-plugin-ui5` (`^0.17.0`) is in the CAP root `devDependencies`** — without it `cds watch` serves only OData, never the UI5 app. (Both `cap-fullstack-listreport` and `cap-fullstack-freestyle` starters already have it.)
2. **`index.html` bootstrap ↔ `ui5.yaml` are consistent.** Either: **(A, recommended)** bootstrap UI5 from the CDN — `src="https://ui5.sap.com/1.120.0/resources/sap-ui-core.js"` — and keep `ui5.yaml` minimal (no `framework` block); **or (B)** use a relative `src="resources/sap-ui-core.js"` **and** add a `framework:` block (`name: SAPUI5`, `version`, `libraries`) to `ui5.yaml`. **Never mix** (relative bootstrap + no framework block = 404 = blank page). Copy the starter's `index.html` verbatim rather than hand-rolling a relative bootstrap. Full rule: [`references/freestyle-in-cap.md`](references/freestyle-in-cap.md) and [`references/list-report-op.md`](references/list-report-op.md).

## Pick the starter

| App type (`scaffold_app` appType) | Starter | Notes |
|---|---|---|
| `cap-service` | `cap-service-only` | CAP backend only, no UI |
| `cap-fe-lrop` | `cap-fullstack-listreport` | CAP + Fiori Elements List Report + Object Page |
| `cap-fe-alp` | `cap-fullstack-listreport` | convert the LR target to Analytical List Page |
| `cap-fe-op` | `cap-fullstack-listreport` | Object Page focus |
| `cap-fpm` | `cap-fullstack-listreport` | starter is a List Report — convert to FPM per `fpm.md` Walkthrough B §B.10 |
| `cap-freestyle` | `cap-fullstack-freestyle` | CAP + Freestyle UI5 (TypeScript), served by cds-plugin-ui5 |
| `freestyle-ui5` | `freestyle-ui5-ts` | Freestyle UI5 (TypeScript) — standalone, no CAP |
| `external-fe` | `fiori-elements-external-service` | bound to RAP/existing OData via EDMX + mock + proxy |

## Which bootstrap guide to load (by resolved appType)

The `fiori-developer` agent resolves an appType from Gate C (floorplan) × Gate B (backend). After the generator (Path A) or `scaffold_app` (Path B) produces the app — or when building a file from scratch — load the matching full walkthrough to verify/repair every file against a known-good target.

| Resolved appType / scenario | Floorplan · stack · OData | Full walkthrough guide | Concise config |
|---|---|---|---|
| `cap-fe-lrop`, `cap-fe-op`, `external-fe` (V4) | List Report / OP · FE · OData V4 (CAP or RAP) | [`references/bootstrap-list-report-v4.md`](references/bootstrap-list-report-v4.md) | `list-report-op.md`, `object-page.md` |
| `cap-fe-alp` (CAP, OData V4) | ALP · `sap.fe.templates` · V4 | *(use existing)* [`references/analytical-list-page.md`](references/analytical-list-page.md) | — |
| ALP bound to an OData **V2** service (external/older) | ALP · `sap.suite.ui.generic.template` · V2 | [`references/bootstrap-alp-v2.md`](references/bootstrap-alp-v2.md) | — |
| `freestyle-ui5` / `cap-freestyle` — **TypeScript** (default) | Freestyle · TS | [`references/bootstrap-freestyle-typescript.md`](references/bootstrap-freestyle-typescript.md) | `freestyle-standalone.md`, `freestyle-in-cap.md` |
| Freestyle when **plain JS** is explicitly required | Freestyle · JS | [`references/bootstrap-freestyle-js.md`](references/bootstrap-freestyle-js.md), [`references/bootstrap-freestyle-worklist.md`](references/bootstrap-freestyle-worklist.md) | — |
| `cap-fpm` (CAP + FPM) | FPM · `sap.fe.core.fpm` + `sap.fe.macros` · V4 | [`references/fpm.md`](references/fpm.md) — **Walkthrough B** | `list-report-op.md` |
| FPM on external / RAP | FPM · external OData | [`references/fpm.md`](references/fpm.md) — **Walkthrough A** | `external-service-app.md` |

Precedence: the **concise config** references remain the primary Intent2App wiring; the **full walkthroughs** are the exhaustive, generator-parity file-by-file target — consult them when the concise snippet isn't enough, when repairing generator/`scaffold_app` output, or when neither scaffolder is available.

## Floorplan config (manifest routing)

**List Report + Object Page** — two routes/targets, both Components:
```jsonc
"targets": {
  "List":   { "type": "Component", "name": "sap.fe.templates.ListReport",
              "options": { "settings": { "contextPath": "/Entity", "variantManagement": "Page",
                "initialLoad": "Enabled",
                "navigation": { "Entity": { "detail": { "route": "Detail" } } } } } },
  "Detail": { "type": "Component", "name": "sap.fe.templates.ObjectPage",
              "options": { "settings": { "contextPath": "/Entity", "editableHeaderContent": false } } }
}
```
Always `contextPath` (never the deprecated `entitySet`). Libs: `sap.fe.core`, `sap.fe.templates`, `sap.fe.macros`, `sap.uxap`, `sap.ui.layout`. See [`references/list-report-op.md`](references/list-report-op.md). Full walkthrough: [`references/bootstrap-list-report-v4.md`](references/bootstrap-list-report-v4.md).

**Analytical List Page** — replace the List target template with `sap.fe.templates.AnalyticalListPage`; requires a `UI.Chart` + `UI.PresentationVariant`/`UI.SelectionPresentationVariant` in annotations. See [`references/analytical-list-page.md`](references/analytical-list-page.md). OData **V2** (generic-template) walkthrough: [`references/bootstrap-alp-v2.md`](references/bootstrap-alp-v2.md).

**Object Page only** — single target `sap.fe.templates.ObjectPage`; entry by key. See [`references/object-page.md`](references/object-page.md).

**FPM** — start from the FE base, add a custom page (`sap.fe.core.fpm`) or custom section/column via manifest `content` + an XML fragment using building blocks (`<macros:Table>`, `<macros:Chart>`, `<macros:FilterBar>`). **CAP backend — follow `references/fpm.md` Walkthrough B (served by `cds watch`); external/RAP — Walkthrough A.** Loading `fpm.md` is mandatory for any FPM app. See [`references/fpm.md`](references/fpm.md).

**Freestyle (standalone)** — `sap.m.routing.Router`, root `App.view.xml` with `<App>`, XML views, `Component` extends `sap/ui/core/UIComponent` with `IAsyncContentCreation`, async routing on. Bootstrap via `ComponentSupport` in `index.html`. See [`references/freestyle-standalone.md`](references/freestyle-standalone.md). Full walkthroughs: [`references/bootstrap-freestyle-typescript.md`](references/bootstrap-freestyle-typescript.md), [`references/bootstrap-freestyle-js.md`](references/bootstrap-freestyle-js.md), [`references/bootstrap-freestyle-worklist.md`](references/bootstrap-freestyle-worklist.md).

**Freestyle in CAP** — same app under `app/`, served by `cds watch` (cds-plugin-ui5), no proxy. See [`references/freestyle-in-cap.md`](references/freestyle-in-cap.md).

**External-service-bound** — manifest `dataSources` points at the consumed service with a `localUri` for the mock; `ui5.yaml`/`ui5-local.yaml` carry the proxy `backend` and the `sap-fe-mockserver` for offline. See [`references/external-service-app.md`](references/external-service-app.md) and the `cap-integration` skill.

## OData model settings (every backend-bound app)

```jsonc
"models": { "": { "dataSource": "mainService", "type": "sap.ui.model.odata.v4.ODataModel",
  "settings": { "operationMode": "Server", "autoExpandSelect": true, "earlyRequests": true,
    "groupId": "$auto", "updateGroupId": "$auto" } } }
```

## Checklist

Namespace identical (run `validate_namespace`) · **CAP-embedded: `cds-plugin-ui5` in root devDeps + bootstrap↔`ui5.yaml` consistent (CDN URL + no framework block, or relative + framework block)** · `contextPath` not `entitySet` · `sap_horizon` · async routing + `IAsyncContentCreation` · i18n for all labels · V4 model settings as above · `npm install` then run (CAP `cds watch`; freestyle/external `start:mock`/`start:proxy`).
