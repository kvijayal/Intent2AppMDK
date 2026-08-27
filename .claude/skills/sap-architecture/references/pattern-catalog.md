*Part of the sap-architecture skill.*

# Pattern catalog

One deep card per pattern the decision tree can land on. Use this after Gate **G3** (floorplan) and Gate **G2** (backend) to confirm the choice. Each card covers: definition, ideal signals, anti-signals, Clean Core stance, the local-run story, the default stack, and when to pick it over its neighbours.

Default bias (from the core): **Fiori Elements over Freestyle** whenever the requirement maps to standard list/detail. Less code, automatic accessibility/variants/personalisation, cheaper upgrades. Reach for Freestyle only when the UX genuinely can't be expressed in annotations.

---

## Analytical List Page (ALP)

**Definition.** A `sap.fe.templates.ListReport` variant that pairs a chart/visual-filter area with a table over the same entity set. Built entirely from annotations (`UI.Chart`, `UI.PresentationVariant`, `UI.SelectionPresentationVariant`). Supports hybrid chart+table, drill-down dimensions, and KPIs.

**Ideal signals.** "Dashboard", "KPIs", "trend", "by region/category/period", "drill-down", multi-dimensional aggregation, compare-then-act. The user analyses first, then acts on a filtered subset.

**Anti-signals.** Pure transactional create/edit; a single record in focus; no aggregation. If there are no charts/KPIs, use List Report + Object Page instead.

**Clean Core stance.** Clean — annotation-driven over a released OData service or your own CAP service; no core modification. Aggregation should be pushed to the service (`$apply`) not the client.

**Local-run story.** CAP `cds watch --in-memory`, or `sap-fe-mockserver` with generated data. Charts render against mock aggregations; for realistic KPIs seed representative mock data.

**Default stack.** OData V4 · `sap.fe.templates.ListReport` with `"variantManagement": "Page"`, `"initialLoad": "Enabled"` · annotations for `UI.Chart` + `UI.LineItem` · SAPUI5 1.120+/1.146 · `sap_horizon`.

**Choose over neighbours.** Over **List Report** when charts/KPIs are first-class, not an afterthought. Over **Freestyle** always for analytics — never hand-build chart+filter+table sync that FE gives free.

---

## List Report + Object Page (LROP)

**Definition.** The canonical transactional floorplan: a `sap.fe.templates.ListReport` (filter bar + worklist table) navigating to a `sap.fe.templates.ObjectPage` (header facets + sections + actions). This is the **recommended default** for transactional CRUD.

**Ideal signals.** "Manage/maintain/process X", a worklist the user filters and triages, then opens one record to view or edit. CRUD over entities; status that moves via actions; standard tables and forms.

**Anti-signals.** Heavy analytics (→ ALP); a single fixed object with no list (→ Object Page only); a wizard/bespoke flow that annotations can't express (→ Freestyle).

**Clean Core stance.** Clean and preferred — 100% annotation-driven; actions surface as `UI.DataFieldForAction`, never triggered from controller code; status uses `UI.Criticality` + `CriticalityRepresentation: #WithIcon`. See the `purchaseOrder` reference app.

**Local-run story.** CAP `cds watch --in-memory` (service + UI same origin, no proxy) or mock server from EDMX. The `purchaseOrder` app runs end-to-end on in-memory sqlite.

**Default stack.** CAP (Node.js, `@sap/cds ^9`) backend or consumed OData · OData V4 · `sap.fe.templates.ListReport` + `sap.fe.templates.ObjectPage` · `annotations.cds` (CAP) or `annotation.xml` (RAP/external) · drafts **off** for action-driven status machines, **on** for long multi-field edits.

**Choose over neighbours.** Over **Object Page only** when users need a worklist first. Over **FPM** when stock sections/columns suffice. Over **ALP** when there are no charts/KPIs.

---

## Object Page (standalone)

**Definition.** A `sap.fe.templates.ObjectPage` reached directly (deep link, tile, or cross-app navigation) without a preceding List Report — a single object's header, facets, sections, and actions.

**Ideal signals.** "Open/maintain *the* X" where the key is already known: a settings/profile record, a singleton config, or a target of cross-app navigation. No worklist needed.

**Anti-signals.** The user must search/filter a set first (→ add a List Report → LROP). Many sibling records browsed routinely.

**Clean Core stance.** Clean — annotation-driven, same discipline as LROP. Bind with the entity key via routing; never pass data through navigation parameters.

**Local-run story.** CAP `cds watch` / mock server. Provide at least one seeded record so the page binds; deep-link the key in the FLP sandbox or `start-mock` URL.

**Default stack.** OData V4 · `sap.fe.templates.ObjectPage` with `"editableHeaderContent": false` unless header is editable · `contextPath` to the entity · annotations for `UI.HeaderInfo`, `UI.Facets`, `UI.FieldGroup`.

**Choose over neighbours.** Over **LROP** when there is genuinely no list. Over **Freestyle** when it's a standard detail form.

---

## Flexible Programming Model (FPM)

**Definition.** Fiori Elements as the base, extended with custom content: `sap.fe.core.fpm.Page`, building-block macros (`<macros:Table>`, `<macros:Form>`, `<macros:Chart>`), custom sections/columns, and a typed extension controller — without abandoning the FE runtime (drafts, variants, message handling stay free).

**Ideal signals.** "Mostly standard list/detail, **but** one custom section / a computed column / a non-trivial validation / an embedded custom chart." You want FE's plumbing plus a few bespoke pieces.

**Anti-signals.** Pure-standard (use LROP — don't add extension surface you don't need) or fully bespoke/non-OData (use Freestyle — fighting the FE runtime costs more than it saves).

**Clean Core stance.** Clean — uses **official FE extension points** (`controllerExtension`, building blocks, custom sections in `manifest.json`). Stay on documented APIs; don't reach into FE internals.

**Local-run story.** Identical to LROP (CAP `cds watch` / mock). Custom fragments live under `webapp/ext/` and load against the same mock/service.

**Default stack.** OData V4 · `sap.fe.core.fpm` + `sap.fe.macros` · custom views/fragments under `webapp/ext/` · TypeScript extension controllers · manifest `content`/`controlConfiguration` wiring.

**Choose over neighbours.** Over **LROP** the moment you need a custom section/column/handler. Over **Freestyle** when you still want drafts, variant management, and FE message handling for free.

---

## Freestyle UI5 (TypeScript)

**Definition.** A hand-built UI5 app extending `sap/ui/core/UIComponent`, with your own XML views, controllers, routing, and models. Full control of UX; you write what FE would have generated.

**Ideal signals.** Bespoke UX (wizards, guided flows, canvas/diagram UIs), non-OData or mixed data sources, heavy client-side logic, or a layout no annotation expresses. The reference is `project1` (freestyle UI5 + TypeScript).

**Anti-signals.** Anything that maps cleanly to list/detail — FE is faster, less code, and upgrade-safer. Don't rebuild a List Report by hand.

**Clean Core stance.** Clean when deployed **side-by-side** on BTP consuming released APIs. The risk is reinventing accessibility/variants/i18n poorly — FE gives these for free, so justify going freestyle.

**Local-run story.** `sap-fe-mockserver` (offline) and/or `fiori-tools-proxy` to a real backend, flipped via `start-mock` / `start` scripts. `project1` proxies `/V4` to `https://services.odata.org` and mocks the same path — see `cap-integration`.

**Default stack.** SAPUI5 1.120+/1.146 · TypeScript (`@sapui5/types`, `ui5-tooling-transpile`) · `sap.m` controls only · `sap_horizon` · XML views · `@ui5/cli ^4` · OData V4 model.

**Choose over neighbours.** Over **FPM** only when you need so much custom UX that the FE runtime is in the way. Over **LROP/ALP/OP** only when the UX can't be annotation-expressed.

---

## CAP service (build a backend)

**Definition.** A new OData V4 service built on SAP CAP (Node.js): `db/schema.cds` domain model, `srv/service.cds` projections + auth, `srv/service.js` handlers. The side-by-side BTP backend you own.

**Ideal signals.** You own the domain data; no released service exists for it; you need custom logic, computed criticality, bound actions, drafts, or events. Greenfield data on BTP.

**Anti-signals.** A released RAP/S/4 OData service already exposes the data — then **consume**, don't rebuild (Clean Core: don't duplicate the source of truth). See `backend-cap-vs-rap.md`.

**Clean Core stance.** Side-by-side Clean Core: separately deployable, consumes released S/4 APIs/events via destinations, never modifies the core. `@requires` on every service; `@restrict` on every writable entity.

**Local-run story.** `cds watch --in-memory` (in-memory sqlite via `@cap-js/sqlite`); service + UI same origin at `http://localhost:4004`, **no proxy**. `cds compile '*' --to serviceinfo` lists service URLs.

**Default stack.** `@sap/cds ^9` · OData V4 · `@sap/cds/common` aspects (`managed`, `cuid`) · `@odata.etag` on user-edited entities · Jest (`cds.test`) ^29 · `cds-plugin-ui5 ^0.16.3` to serve the Fiori app under `app/`. See `cap-skill`.

**Choose over neighbours.** Over **RAP/consumption** when you own the data and no released service exists. Over **freestyle-only + mock** when the data must be persisted/shared, not faked.

---

## RAP / existing-OData consumption (consume a backend)

**Definition.** Bind the Fiori app to an **existing** OData V4 service — a RAP (ABAP Cloud) business object or any released S/4/3rd-party service — instead of building one. Offline-first: the developer supplies the `$metadata`/EDMX.

**Ideal signals.** "There's already an OData service / RAP BO for this." Reuse the system of record; you only build (or extend) the UI.

**Anti-signals.** No service exists, or the data is genuinely new to BTP (→ build CAP). The service is non-released/modified core (→ Clean Core violation; flag it).

**Clean Core stance.** Clean **iff** the service is released/public. Annotation strategy matters: prefer a **backend CDS metadata-extension** for reusable UI semantics (stays on-stack, upgrade-safe); use a **local `annotation.xml`** only for app-specific UI. Never modify the core service. See `backend-cap-vs-rap.md`.

**Local-run story.** EDMX → `sap-fe-mockserver` for offline dev; `fiori-tools-proxy` `backend` block (URL in VS Code, `destination` in BAS) for the real service. Always generate **both** and flip with `start-mock` / `start-proxy`. See `cap-integration`.

**Default stack.** OData V4 · EDMX at `webapp/localService/<service>/metadata.xml` · manifest `dataSources.<service>.settings.localUri` → that EDMX · `annotation.xml` (app-specific) or backend metadata-extension (reusable) · Fiori Elements or Freestyle on top.

**Choose over neighbours.** Over **CAP build** whenever a released service already exists — duplicating it breaks single-source-of-truth and Clean Core.

---

## Adaptation Project (advisory)

**Definition.** An on-stack, layered adaptation of a **delivered** SAP Fiori app (typically in BAS with `@sap/generator-fiori` adaptation-project flow / SAPUI5 flexibility). You change a copy via change-layers; the original app is untouched.

**Ideal signals.** "Tweak the standard Fiori app" — hide/move fields, add a custom column/section/controller extension, change labels — **without** owning or forking the app.

**Anti-signals.** A net-new app (→ build LROP/Freestyle). Changes that belong in the backend service (→ backend extension/RAP).

**Clean Core stance.** Clean and *the* recommended way to adjust delivered apps — changes live in a separate layer, applied at runtime over the base app; the SAP app is never modified. Upgrade-stable as long as you stay on supported extension points.

**Local-run story.** ⚠ Needs the **base app and a reachable system/destination** — not fully offline. Preview runs against the adapted base app in BAS.

**Default stack.** BAS adaptation project · SAPUI5 flexibility change-layers · controller extensions / `manifest` app-descriptor changes · deployed back to the Fiori launchpad layer.

**Choose over neighbours.** Over a **fork/Freestyle rebuild** when the standard app is 90% right and you only need deltas — forking forfeits upgrades. This is advisory in Intent2App (often needs a live system); confirm feasibility with the developer.

---

## Side-by-Side on BTP (advisory)

**Definition.** A standalone app/service deployed on **SAP BTP** (CAP service and/or Freestyle/FE UI) that consumes **released** S/4 APIs and events via destinations — logic and UI live off-stack.

**Ideal signals.** New capability that shouldn't live in the core; integration across systems; modern Node.js/UI5 stack; independent deploy/release cadence from S/4.

**Anti-signals.** Logic that genuinely belongs **on-stack** next to the business object (→ RAP / ABAP Cloud developer extensibility). Pure UI deltas to a delivered app (→ Adaptation Project).

**Clean Core stance.** The canonical **BTP Clean Core** model: separately deployable, released-APIs-only, zero core modification. Pair with RAP for the on-stack half when logic must sit beside the data.

**Local-run story.** ⚠ Real consumption needs a **destination** to the S/4 system; develop offline against EDMX mock first, then proxy/destination. Deploy via approuter + MTA (xs-app.json route, xsuaa, html5 module). See `cap-integration/references/deploy-approuter-mta.md`.

**Default stack.** CAP (`@sap/cds ^9`) and/or UI5 1.120+/1.146 · OData V4 · XSUAA auth · approuter + `mta.yaml` · destinations for S/4 connectivity.

**Choose over neighbours.** Over **on-stack RAP** when the capability is cross-system or should release independently of S/4. Over **Adaptation Project** when it's a net-new app, not a delta to a delivered one.
