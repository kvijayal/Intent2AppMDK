*Part of the sap-architecture skill.*

# Decision gates — the full question bank (G1–G9)

This is the long form of §4 of the skill. Each gate runs as an `AskUserQuestion` in the **main thread** (sub-agents can't ask — they return the open question and the main thread re-surfaces it). For every gate: the exact question wording, why it matters, the options (recommended first, labelled *Recommended*), the default rationale, branch/follow-ups, and the **TDD section** the answer lands in.

Rule for every gate: present the recommendation, let the developer **override**, record the answer as a TDD line. Never silently pick auth, data types, draft mode, OData version, or floorplan. Code only after **G9** (Gate G) approval.

TDD section map used below (align to `deliverable-templates`): §1 Overview/Scope · §2 Architecture & Clean Core · §3 Backend/Data Model · §4 Service & Auth · §5 Floorplan/UX · §6 Annotations · §7 Run & Wiring (mock/proxy/deploy) · §8 Test strategy · §9 Assumptions register.

---

## Conflict cross-checks (run at EVERY gate — flag, don't reconcile)

Beyond asking each gate's own question, **test every answer for contradictions** against the Requirement Register and the Conflict Register built in STEP 0. A contradiction is never yours to resolve silently — surface it in the gate with the `REQ-NNN`/FD-§ refs and let the developer decide. The recurring ones:

| When you see… | …it conflicts with | Resolve at | Rule |
|---|---|---|---|
| A requirement for a **create / edit / input form** in a **Fiori Elements** app | "**draft off**" / no sticky sessions | G3 + G4/**G6** | FE create & edit need **`@odata.draft.enabled`** (or sticky sessions). "Draft off" + "user creates/edits records" cannot both hold — a non-draft FE Object Page renders **display-only**. Recommend drafts on, or switch to a Freestyle form. |
| Auth/scope text saying **display-only / "update + display" / no create** | a screen/functional section describing a **Create + Save** flow | **G5** | The FD contradicts itself. Force the decision: is the app read-only, edit-only, or full CRUD? Set `@restrict` to exactly that — and remove handlers/buttons for verbs that aren't granted. |
| A **field used as a filter** (status, type, category) | that field being **free text** with no value list | **G6/F** | A filter dropdown with data needs a **fixed enum** (`@Common.ValueListWithFixedValues`) or a **value-list entity** — free text gives an empty value help. |
| `@restrict` grants a verb with **no handler**, or a **`before <VERB>` handler with no grant** | each other | **G5** | A verb without a handler may silently no-op; a handler without a grant is dead code (CAP denies un-granted verbs by default). Grant matrix and handler set must match exactly. |
| **i18n / localization** required (e.g. "translate to es, fr") | only a default bundle wired in the manifest | G5/§NFR | Locale files must be declared in the manifest (`supportedLocales`, `fallbackLocale`) or they never load. |

If a gate answer resolves one side of a `CONFLICT-NN`, record the resolution on that conflict row so it closes before Gate G.

---

## G1 — Greenfield vs extend?

**Question:** "Is this a brand-new build, or are we extending an existing SAP S/4 capability?"

**Why it matters.** Sets the whole Clean Core path. Extending routes you to released-API consumption / on-stack key-user or developer extensibility; greenfield gives a free hand (still side-by-side, still released APIs).

**Options.**
- **New build** *(Recommended for net-new)* — no existing app/service to respect.
- **Extend existing S/4** — must follow the Clean Core extension path (config → key-user → developer RAP/CAP; never modify core).

**Default rationale.** Most Intent2App requirements are net-new BTP apps; greenfield keeps the model simple. Pick *extend* only when the FD references an existing app/transaction/service.

**Branch / follow-ups.** *Extend* → confirm whether deltas are UI-only (→ Adaptation Project, G3), data/logic on-stack (→ RAP), or side-by-side (→ CAP). Then assess which extensibility tier (see `clean-core.md`).

**Lands in TDD:** §2 (Architecture & Clean Core).

---

## G2 — Backend / data source?

**Question:** "Where does the data come from — do we build a new service, or consume an existing one?"

**Why it matters.** Build-vs-consume is the highest-leverage Clean Core decision. Duplicating a released service breaks single-source-of-truth; building when a service exists is wasted effort and a maintenance liability.

**Options.**
- **Build new CAP service** *(Recommended when you own the data)* — domain is new to BTP.
- **Consume RAP / ABAP Cloud OData** — released on-stack business object exists.
- **Consume other existing OData** — released S/4 or 3rd-party V4 service exists.
- **No backend (UI-only + mock)** — prototype/UX-only, mock data is enough.
- **Add service later** — scaffold the project now with a placeholder CAP service and mock data; backend wiring deferred to a follow-on session.

**Default rationale.** When the developer owns the domain and no released service exposes it, a CAP service is the clean side-by-side choice. If a released service exists, prefer consuming it. Use *Add service later* when the backend is unknown or unavailable at design time.

**Branch / follow-ups (any *consume* answer).**
1. **Supply the `$metadata`/EDMX file** (offline-first). Optionally the service URL / destination name.
2. **Annotation strategy:** backend CDS **metadata-extension** *(Clean Core preferred — reusable, on-stack, upgrade-safe)* | local **`annotation.xml`** (app-specific UI only) | **mix**. See `backend-cap-vs-rap.md`.
3. Hand wiring to `cap-integration` (mock + proxy/destination).

**RAP / ABAP-Cloud via a BTP destination → `rap-integration` (UI-only, user-wizard scaffold).** When the consume target is a RAP service behind a destination, hand to the **`rap-integration`** skill. The backend owns the model, so Intent2App builds **UI only** — and the developer scaffolds the shell with the **BAS Fiori Application Generator wizard**, not Intent2App, because in BAS the headless generator throws `this.env.error is not a function` and `$metadata` behind a destination cannot be fetched from a terminal. The wizard fetches `metadata.xml`; Intent2App then **reads it** to drive the UI-decisions gate and builds annotations via `fiori-developer` Path A. This sets `scaffold_method: user-wizard` (no CAP scope at G4, no `@restrict` to author — auth is enforced by the backend + destination).

*No backend* → skip G4; floorplan still runs against mock.
*Add service later* → scaffold with placeholder CAP service + mock data; record backend wiring as `Deferred` in the Requirement Register; skip G4 for now.

**Lands in TDD:** §3 (data source decision) + §6 (annotation strategy) + §7 (EDMX/wiring).

---

## G3 — Floorplan?

**Question:** "Which UI floorplan fits best — a specific annotation-driven Fiori Elements floorplan, or bespoke Freestyle UI5?"

**Why it matters.** Determines code volume, upgrade cost, and which skill builds the UI. Fiori Elements gives list/detail, filtering, sorting, draft, and accessibility for free via annotations; Freestyle is full flexibility at the cost of hand-coding everything. Within Fiori Elements the *specific* floorplan (List Report, Analytical, Object Page, or FPM) shapes the whole UX — so recommend the best-fit one; don't collapse them all into "Fiori Elements".

**Compute the recommendation first (signal → floorplan).** Read the Requirement Register and match its dominant signals against this table (the ideal/anti-signals are the ones already documented per card in `pattern-catalog.md`). The top match is the *Recommended* option:

| Dominant requirement signal | Recommend | appType (× Gate B backend) |
|---|---|---|
| Charts / KPIs / aggregation / "dashboard" / "by region\|period" / drill-down / analyse-then-act | **Analytical List Page (ALP)** | `cap-fe-alp` |
| Worklist the user filters/triages, then opens a record to view/edit; transactional CRUD; status via actions *(default when signals are transactional or ambiguous)* | **List Report + Object Page (LROP)** | `cap-fe-lrop` · `external-fe` |
| Always arrives with a known key; single record; settings/profile/singleton; cross-app or deep-link target; no worklist | **Object Page (standalone)** | `cap-fe-op` |
| Mostly standard list/detail **but** one custom section / computed column / bespoke validation / embedded custom chart | **Flexible Programming Model (FPM)** | `cap-fpm` |
| Bespoke UX (wizard/guided/canvas), non-OData/mixed sources, heavy client logic, a layout no annotation expresses | **Freestyle UI5 (TypeScript)** | `cap-freestyle` · `freestyle-ui5` |

**Standing bias (unchanged).** Prefer the **Fiori Elements family over Freestyle** unless the UX genuinely cannot be expressed in annotations; among the FE floorplans, pick by the signals above. Default to **LROP** when transactional or ambiguous.

**Options (all five are selectable).**

- **[the recommended floorplan]** *(Recommended — computed from the signals above)*
- **List Report + Object Page** — worklist + detail; transactional CRUD; filter/sort/draft for free.
- **Analytical List Page** — chart + table over the same entity; KPIs/aggregation first, then act.
- **Object Page (standalone)** — a single record entered by key; no preceding list.
- **Flexible Programming Model (FPM)** — FE runtime + a custom section/column/page where annotations fall short.
- **Freestyle UI5 (TypeScript)** — bespoke UX / non-standard navigation / heavy client logic.

**Presentation (the picker has a 4-button cap).** `AskUserQuestion` shows at most **4 option buttons** plus an automatic "Other". So rank the five by signal fit, show **4 buttons** = the *Recommended* one first + the next three, and let the lowest-ranked fifth be reached via **"Other"**. **Name all five** (with a one-line "use when" each) in the question body so nothing is hidden, and state that any floorplan not shown as a button is still selectable through "Other".

**Default rationale.** Recommend Fiori Elements unless the UX genuinely cannot be expressed in annotations; recommend the *specific* FE floorplan whose signals dominate. Choose Freestyle only when there is a concrete reason no FE floorplan fits.

**Branch / follow-ups.** ALP → confirm there is a `UI.Chart` + measures to aggregate (else fall back to LROP). Object Page → confirm entry is always by a known key (else add a List Report → LROP). FPM → name the one custom piece annotations can't express (else use LROP); and note that FPM (any backend) requires the UI builder to load `fiori-bootstrap` → `fpm.md` + `fiori-elements` → `fpm-annotations.md`. Freestyle → confirm the specific custom need that rules out every FE floorplan.

**Lands in TDD:** §5 (Floorplan/UX). The chosen floorplan × Gate B backend resolves to the `appType` in the table's right-hand column, which STEP 7.5 of `/intent` pre-fills into the generator floorplan (`FE_LROP | FE_ALP | FE_FEOP | FF_SIMPLE` / FPM).

---

## G4 — CAP scope

**Question 1:** "Is a CAP backend needed for this app?"

**Options.**

- **Yes** *(Recommended)* — app needs its own data model, service logic, or auth enforcement.
- **No** — UI-only mock, consume-only, or backend deferred (Gate B *Add service later*); skip to G5.

**Why it matters.** Confirms whether the CAP layer is in scope at all before drilling into its surface. Skipping this check leads to unnecessary scaffolding on mock/external-only apps.

---

**Question 2 (only if Yes — multi-select):** "What does the CAP layer need?"

**Options (multi-select).**

- **New service** *(Recommended)* — projections over your `db/` model.
- **Extend existing** — add to an existing CAP service.
- **Bound actions** — state transitions via actions (validate → `cds.transaction` → audit), not PATCH.
- **Draft on/off** — see G6 (kept as its own gate because it's frequently mis-set).
- **Events / messaging** — emit/consume domain events.

**Default rationale.** A new service with projections is the baseline; add actions when there's a status machine; add events only when there's a real integration need (don't gold-plate).

**Branch / follow-ups.** *Bound actions* → list each transition + its guard. *Events* → name the topic and the broker. Hand to `cap-skill` (`service-layer.md`).

**Lands in TDD:** §3/§4 (model, service surface, actions, events).

---

## G5 — Auth & roles?

**Question 1:** "Is authentication needed for this app?"

**Options.**

- **Yes** *(Recommended)* — app has write operations, role-sensitive data, or will be deployed to BTP.
- **No** — read-only display app, internal prototype, or auth enforced externally (gateway/approuter). Requires explicit developer confirmation; recorded in TDD §9.

**Why it matters.** Auth is a HARD CONSTRAINT when present: every service must have `@requires` and every writable entity must have `@restrict`. Skipping it on a write-enabled app is a security defect. This must be a question, never a guess.

---

**Question 2 (only if Yes):** "Which authorization model?"

**Options.**

- **XSUAA Viewer/Editor/Admin** *(Recommended)* — three-tier role-template model in `xs-security.json`.
- **Authenticated-user only** — `@(requires:'authenticated-user')`, no role split. Dev: `dummy` or `mocked` auth profile.
- **Custom roles** — domain-specific role set.
- **IAS** — Identity Authentication Service as IdP.

**Default rationale.** Viewer/Editor/Admin covers most CRUD apps and maps cleanly to `@restrict` grants (READ → all three; CREATE/UPDATE → Editor/Admin; DELETE → Admin).

**Question 3 (only if Yes):** Per-entity grant matrix — for each entity confirm which roles get READ / CREATE / UPDATE / DELETE, and which actions need their own `@requires`. Hand to `cap-security` (`authorization.md`).

**Branch / follow-ups (No auth).**
Generate the service with no `@requires` / `@restrict` annotations. Add `cds.requires.auth.[development].kind = "dummy"` so `cds watch` doesn't add unexpected auth. Record the explicit choice in TDD §9.

**Lands in TDD:** §4 (Auth) + §9 (auth assumption).

---

## G6 — Draft handling?

**Question:** "Drafts on or off — long multi-field edits, or atomic/action-driven flows?"

**Why it matters.** Drafts (`@odata.draft.enabled`) change the whole edit UX and the handler model. The cardinal rule: **never half-configure drafts.** Action-driven status machines are simpler and cleaner without drafts.

**Options.**
- **Off — atomic/action-driven** *(Recommended for status-machine apps)* — mutations happen via bound actions; no draft tables.
- **On — long multi-field edits** — users edit many fields over time before saving (classic Object Page editing).

**Default rationale.** When state changes through validated actions (the `purchaseOrder` pattern), drafts add complexity for no benefit. Turn drafts on only for genuinely long, free-form edits.

**Branch / follow-ups.** *On* → confirm draft-enabled entities and that compositions cascade correctly; ensure `@odata.etag` interplay is understood (see `odata-and-drafts.md`). *Off* → confirm every mutation has an action or a guarded CREATE/UPDATE.

**⚠ Conflict rule (Fiori Elements).** Before answering *Off*, check the Requirement Register for any **create / edit / input-form** requirement. In Fiori Elements, a List Report / Object Page with **draft off and no sticky sessions has no working create or edit** — the page is display-only. So "draft off" is only valid for read-only apps or action-driven status machines. If users must create or edit records via FE, **drafts on is required** (or move that screen to a Freestyle form). Raise this as a contradiction at the gate rather than shipping a create form that doesn't work.

**Lands in TDD:** §3/§4 (draft decision) + §9 (assumption).

---

## G7 — Data volume / performance?

**Question:** "What's the expected data volume, and how should we page and expand?"

**Why it matters.** Drives `operationMode`, `$expand` depth, and growing-list config. Client-side paging and deep list `$expand` are the usual performance/N+1 culprits.

**Options / recommended defaults.**
- **Server paging + shallow `$expand`** *(Recommended default)* — `operationMode: 'Server'`, `$top`/`$skip`/`$count`, `autoExpandSelect` drives selection.
- **Expand only on the Object Page** — keep list expands minimal; pull detail/children on the OP.
- **Growing list > 100 rows** — `growing: true` + `growingThreshold` for long lists.

**Default rationale.** Server paging + shallow expand scales and avoids N+1; deep expand belongs only where detail is shown.

**Branch / follow-ups.** Large aggregations → push to service (`$apply`, ALP). Per-row computed values → compute set-based in `after('READ')`, never per-row queries (see `pitfalls.md` N+1 example).

**Lands in TDD:** §3/§7 (query discipline & performance).

---

## G8 — Run target?

**Question:** "How do we run it — local mock first, plus a proxy to a real backend, and/or deploy to CF/MTA?"

**Why it matters.** Decides which run configs are generated. Policy: **always generate both** a mock (offline) and the proxy/destination config (real), flipped by npm scripts — so the dev is never blocked.

**Options.**
- **Local first (`cds watch` / mock)** *(Recommended)* — CAP same-origin in-memory, or `sap-fe-mockserver` for external/RAP.
- **+ Proxy to real backend** — `fiori-tools-proxy` `backend` (URL in VS Code, `destination` in BAS).
- **Deploy (CF / MTA)** — approuter `xs-app.json` + `mta.yaml` (xsuaa, destination, html5 module).

**Default rationale.** Local-first is fastest and offline; mock+proxy together cover both demo and integration. CAP needs no proxy (same origin); external/RAP needs mock+proxy.

**Branch / follow-ups.** Hand to `cap-integration` for `edmx-and-mock.md`, `local-proxy.md`, `bas-destinations.md`, `deploy-approuter-mta.md`. Confirm no hardcoded URLs/secrets — always a destination/env var.

**Lands in TDD:** §7 (Run & Wiring) + §9 (deploy assumption).

---

## G9 — TDD sign-off (Gate G)

**Question:** "Here's the Technical Design Document. Approve to build, or revise a specific decision?"

**Why it matters.** The HARD CONSTRAINT gate: **no code before TDD approval.** This is where surfaced assumptions (§9) are accepted on the record.

**Options.**
- **Approve → build** — hand off to `intent-builder` / the build skills.
- **Revise → loop** — return to the specific gate (G1–G8) that needs changing, then re-present.

**Default rationale.** Explicit approval makes the developer the decision-owner and prevents "ask, don't assume" from degrading into silent guessing.

**Branch / follow-ups.** On *Approve* → backend → `cap-skill`; floorplan/manifest → `fiori-bootstrap`; annotations → `fiori-elements`; wiring → `cap-integration`; tests → `sap-unit-testing`. Prefer `mcp__intent2app__*` tools; fall back to the skills.

**Lands in TDD:** the approval line + closes §9 (Assumptions register).

---

## Always-surface checklist (cross-cutting, §9)

Independently of the gate that raises them, these must each become a §9 assumption row — never guessed: auth model & roles · OData version (V4) · draft on/off · concurrency/etag on edited entities · key field + type · enum vs free-text for status · currency-paired amounts (`@Measures.ISOCurrency`) · audit/history need · data volume/paging · localization · deploy target · whether a released API already exists (consume vs build).
