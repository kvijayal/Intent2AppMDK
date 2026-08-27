---
name: rap-integration
description: >
  How Intent2App consumes an EXISTING RAP / ABAP-Cloud OData V2 or V4 service in a Fiori app when the
  backend already owns the data model. Covers why the project is scaffolded with the BAS Fiori
  template wizard (the headless generator and terminal metadata-fetch both fail in BAS), the wizard
  sub-flow, reading the fetched metadata.xml to drive UI decisions, and the UI-only build (local
  annotation.xml + mock/proxy) via fiori-developer Path A. Load at Gate B when the backend is RAP /
  consume-existing, and whenever building UI on a wizard-scaffolded external service. Keywords: RAP,
  ABAP Cloud, consume OData, released service, BAS Fiori wizard, Application Generator, user-wizard,
  metadata.xml, EDMX, destination, PrincipalPropagation, List Report, annotation.xml, UI-only.
---

# Consuming a RAP service (UI-only build)

> The RAP counterpart to `cap-integration`. There you **build** the CAP backend; here the backend
> **already exists** as a released RAP / ABAP-Cloud OData service (a RAP service definition can be
> exposed through an OData **V2 or V4** UI service binding, so either version is valid) and Intent2App
> builds **only the UI**. Load this at Gate B when the developer chooses *Consume RAP / existing OData*.

## When to use — RAP = the backend owns the model

A released RAP / ABAP-Cloud OData service already exists (data model, business logic, authorization
all live on-stack) — exposed as an OData **V2 or V4** UI service binding; either version is valid.
Intent2App must **not** design a CDS schema — it reads the service's metadata and
builds the UI. **Clean Core:** consume **released** services only; never modify or target a
non-released core endpoint. No hardcoded URL or secret in the app — reach the backend through a BTP
**destination** only.

## OData version decision — read this before building

A RAP service definition can be exposed through an OData **V2** or **V4** UI service binding, and the
two differ in almost every layer of the UI build (manifest model settings, Component base class, CRUD
API, filter/sort grammar, response shape). **Detect the version from the fetched `metadata.xml`** and
follow the matching reference file — do not mix the two.

| Signal in `metadata.xml` | Version | `odata_version` |
|---|---|---|
| `m:DataServiceVersion="2.0"` on `<edmx:DataServices>` | **OData V2** | `"2.0"` |
| `Version="4.0"` on the `<edmx:Edmx>` root element | **OData V4** | `"4.0"` |

What changes by version (summary — full detail in the reference files):

| Aspect | OData V2 | OData V4 |
|---|---|---|
| Backend URL pattern | `/sap/opu/odata/sap/SERVICE/` | `/sap/opu/odata4/sap/<binding>/srvd/sap/<service>/0001/` |
| manifest `settings.odataVersion` | `"2.0"` | `"4.0"` |
| Component base class | `sap/suite/ui/generic/template/lib/AppComponent` | `sap/fe/core/AppComponent` |
| Key model settings | `defaultBindingMode` · `defaultCountMode: Inline` · `refreshAfterChange: false` · `metadataUrlParams` | `operationMode: Server` · `autoExpandSelect: true` · `earlyRequests: true` |
| Metadata style | `sap:*` property attributes (`sap:filterable`, `sap:sortable`, `sap:aggregation-role`, `sap:requires-filter`) | vocabulary annotations (`Capabilities.*`, `Core.*`, `UI.*`) — no `sap:` prefix |
| CRUD | `oModel.read/create/update/remove` | `bindList().create()` · `ctx.setProperty()`+`submitBatch()` · `ctx.delete()` |
| Server operations | function imports via `oModel.callFunction(...)` | bound actions via `oModel.bindContext("ns.Action(...)", ctx).invoke()` |
| Filter substring keyword | `substringof('x',Field)` | `contains(Field,'x')` |
| Response shape | `{ d: { results: [...] } }` | `{ value: [...] }` |
| Dates | `/Date(ticks)/` (auto-parsed to JS Date) | ISO 8601 strings (stay strings) |
| CSRF | model handles `X-CSRF-Token`; `csrfProtection: false` in `xs-app.json` | model handles it; `csrfProtection: false` in `xs-app.json` |

**Then load the version-specific reference and follow it for every file you touch:**
- `references/odata-v2-patterns.md` when `odata_version = "2.0"`
- `references/odata-v4-patterns.md` when `odata_version = "4.0"`

## Why the BAS wizard scaffolds the project (not the headless generator)

Two hard constraints in this environment force the shell to be created by the **BAS SAP Fiori
Application Generator wizard**, not by Intent2App:

1. **The headless generator is broken here.** `@sap/generator-fiori` (its `fiori-app-sub-generator:headless`)
   throws `this.env.error is not a function` — a peer-version clash with `yeoman-environment@4.x`
   (shipped by `yo@7.x`). Both headless and piped-interactive CLI runs fail.
2. **Metadata can't be fetched from a terminal.** `$metadata` behind a BTP destination proxy
   (`secure-outbound-connectivity.webide-system`) returns 404/400 from a terminal process — it lacks
   the BAS IDE session (and, for `PrincipalPropagation`, the interactive principal) that carries auth.

**The BAS wizard runs in the extension host with the user's session**, so it both scaffolds a valid
project *and* fetches `metadata.xml` from the destination. Intent2App then takes over on the UI.

## Step 1 — the user scaffolds via the wizard (exact steps)

Instruct the developer to run, in BAS:

> **Command Palette** → **Fiori: Open Application Generator** → template **List Report** →
> data source **Connect to a SAP System** → **Destination** `s4h_uerp_pp_generic_destination`
> (or their destination) → **Service** (choose the released service; e.g. binding
> `zsb_fi_budget_report_04`, service `zsd_fi_budget_report`, path — **V4**
> `/sap/opu/odata4/sap/<binding>/srvd/sap/<service>/0001/` or **V2**
> `/sap/opu/odata/sap/<SERVICE>_SRV/`) → **Main entity** →
> project name / namespace → **Finish**.

The wizard writes the project **and** `webapp/localService/mainService/metadata.xml` (the fetched
EDMX). The developer returns the **generated project path** to Intent2App.

## Step 2 — read metadata.xml to drive UI decisions (plain `Read`, no tool)

`Read` `<project>/webapp/localService/mainService/metadata.xml` and inventory it — this replaces CDS
design. For each `<EntitySet Name= EntityType=>`:

- match its `<EntityType>`,
- read `<Key>` → `<PropertyRef Name>` = the **keys**,
- read each `<Property Name= Type=>` = **candidate columns / filters**,
- read each `<NavigationProperty>` = **value-help / drill-down** targets.

Default **main entity** = the entity set with the most properties. Present the model **read-only**,
then run the ❓ **UI-decisions gate**: which properties become `UI.LineItem` columns, which become
`UI.SelectionFields` filters, which need a value-help, and which drive criticality.

## Step 3 — UI-only build (`fiori-developer` Path A)

The project already exists, so **do NOT call `scaffold_app` / the generator**. Hand
`fiori-developer` the `scaffold_path`; it takes **Path A**:

1. Verify `webapp/manifest.json` (namespace consistent in all 4 places — `validate_namespace`).
2. Write the local `webapp/annotations/annotation.xml` — `UI.LineItem` (chosen columns),
   `UI.SelectionFields` (chosen filters), `UI.DataPoint` + criticality for highlighted lines —
   targeting the main entity set. Annotation patterns: **`fiori-elements`** skill.
3. Ensure the **offline mock** exists from the EDMX (`gen_mock_from_edmx` if the wizard produced none).
4. Validate: `ui5_run_manifest_validation` → `ui5_run_ui5_linter` → `run_checks`.

Manifest `dataSources` layout for an external service (`localUri` + `annotations:["localAnnotations"]`):
see **`fiori-bootstrap` → `references/external-service-app.md`**.

## Run modes

- `npm run start:mock` — offline, `sap-fe-mockserver` serves the wizard's EDMX + mock data.
- `npm run start:proxy` — live, `fiori-tools-proxy` routes to the real service via the **destination**
  in `ui5.yaml`.

Mock / proxy / destination wiring details (and deploy-time `xs-app.json` + `mta.yaml`): the
**`cap-integration`** skill — it stays the authority; this skill does not duplicate it. Note:
`cap-integration` assumes OData V4 (the CAP-build default) — for **RAP consumption follow the version
the fetched metadata declares** (V2 or V4), and set `manifest … settings.odataVersion` to match.

## Checklist

**Shared (both versions):**
- `webapp/localService/mainService/metadata.xml` present (fetched by the wizard).
- manifest `dataSources.mainService.settings` has `localUri` + an annotations entry.
- `annotation.xml` targets the correct entity set; namespace identical in all 4 places.
- No hardcoded URL / secret — destination only.
- Version detected from the metadata and recorded as `odata_version` (`"2.0"` / `"4.0"`); the correct reference file (`odata-v2-patterns.md` / `odata-v4-patterns.md`) loaded and followed.
- No `cap-developer`, no CDS model, no `@restrict` authored — auth is enforced by the backend + destination.
- `xs-app.json` `/sap` route has `csrfProtection: false` (the OData model handles the token).

**OData V2 only:**
- `dataSources.mainService.settings.odataVersion: "2.0"`; Component extends `sap/suite/ui/generic/template/lib/AppComponent`.
- Model settings: `defaultCountMode: "Inline"`, `refreshAfterChange: false`, `metadataUrlParams: {"sap-value-list": "none"}`.
- Every `sap:required-in-filter="true"` field is present in `UI.SelectionFields`; no Filter targets a `sap:filterable="false"` field; no Sorter targets a `sap:sortable="false"` field.
- Filters use `substringof`; collection responses read from `d.results`; server operations use `oModel.callFunction()`.

**OData V4 only:**
- `dataSources.mainService.settings.odataVersion: "4.0"`; Component extends `sap/fe/core/AppComponent`.
- Model settings: `operationMode: "Server"`, `autoExpandSelect: true`, `earlyRequests: true`.
- `__EntityControl` / `__OperationControl` never used in Filters or Sorters; `Capabilities.FilterRestrictions.RequiredProperties` honoured.
- Filters use `contains`; collection responses read from `value`; bound actions use `bindContext(...).invoke()` (not `callFunction`); dates handled as ISO strings.

> The V4-only rule in `cap-integration/edmx-and-mock.md` is the CAP-build default, **not** a RAP constraint — RAP consumption follows whichever version the metadata declares.
