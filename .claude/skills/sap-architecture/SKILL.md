---
name: sap-architecture
description: >
  THE interactive architecture skill for Intent2App. Load it whenever a developer brings a
  Functional Design (FD) or requirement and you need to decide HOW to build it on SAP BTP —
  Clean Core assessment, backend choice (build CAP vs consume RAP/existing OData), and Fiori
  floorplan choice — recommend the best-fit Fiori Elements floorplan (List Report + Object Page,
  Analytical List Page, Object Page, or FPM) or Freestyle UI5, then offer all five — plus the ordered
  question-gates to confirm each decision with the developer before any code is written.
  Use for: "what architecture for this requirement", "Fiori Elements vs freestyle", "CAP or RAP",
  "is this Clean Core", "which floorplan", "recommend a floorplan", greenfield vs extend S/4, side-by-side BTP/CAP.
  Keywords: Clean Core, extension pattern, decision gate, floorplan recommendation, List Report, Object Page,
  Analytical List Page, ALP, FPM, freestyle, CAP, side-by-side, released API, greenfield, intent.
---

# SAP Architecture Decisions (interactive)

> Complements `CLAUDE.md` and the other Intent2App skills; it does not duplicate CAP or UI5 build detail.
> After the architecture is agreed it hands off to `cap-skill` (backend), `fiori-bootstrap`
> + `fiori-elements` (frontend), and `cap-integration` (service wiring).

## Operating model — ask, don't assume

This is the product's USP. You run a short series of **decision gates** in the MAIN conversation thread (the only place `AskUserQuestion` works). At every gate you:

1. Compute a **recommendation** from the rules below.
2. Present it as a question with the recommended option first (labelled *Recommended*) and let the developer **override**.
3. Record the answer; it becomes a line in the Technical Design Document.

Never silently pick auth, data types, draft mode, OData version, or floorplan — surface each as a question. Only generate code after the TDD is approved (Gate G).

**The flip side of "ask, don't assume" is "flag, don't reconcile."** The FD often disagrees with itself (an auth section says "display + update only" while a screen section describes a "create" form), and a gate answer can contradict a requirement (choosing "draft off" for a Fiori Elements app that must let users *create* records — FE create/edit needs drafts). When two requirements, or a requirement and a gate answer, **cannot both hold**, do not quietly pick one and build it. Stop at the relevant gate, present both sides with their `REQ-NNN`/§ refs, and let the developer decide. Build STEP 0's **Conflict Register** so none of these slip through, and run the **conflict cross-checks** in `references/decision-gates.md` at every gate.

**A requirement is "built" only when the code proves it.** Tracking a `REQ-NNN` into the TDD is *design*, not *delivery*. The coverage step (STEP 8.5 of the `/intent` flow) re-opens each generated file and confirms the behaviour is actually there — a modelled-but-non-functional create form, an empty filter value-help, or an unwired locale is a **Gap**, not a build. Never let "designed" masquerade as "done".

## 1. Clean Core — the lens for every decision

Intent2App builds the **Side-by-side BTP/CAP** model only: a new app on BTP consuming released OData APIs, zero on-stack modification. If a requirement cannot be met without on-stack RAP/ABAP Cloud or classic modification, state it is out of scope.

Rules that always hold: **released/public APIs only**; **OData V4**; **upgrade-stable** (no modification of SAP objects); extensions are **separately deployable**. See `references/clean-core.md` for the full extensibility tier reference.

## 2. Decision tree

```
Requirement
 │
 ├─ Can SAP standard config satisfy it?  ── yes ─▶ Configure (no build). Document and stop.
 │                                          no
 ▼
 Need a data service (backend)?
 ├─ Reuse an existing/RAP OData service ──▶ CONSUME (offline-first via EDMX)  ─┐
 ├─ Build new domain data on BTP ─────────▶ BUILD CAP service                 │
 └─ No backend (pure UI / mock) ──────────▶ UI-only + mock                    │
                                                                              ▼
                                                              Choose the floorplan (recommend by signal)
   charts / KPIs / aggregation / drill-down ...............▶ Fiori Elements — Analytical List Page
   transactional worklist + detail (default) ..............▶ Fiori Elements — List Report + Object Page
   single record by key, no worklist ......................▶ Fiori Elements — Object Page (standalone)
   standard list/detail + one custom section/column .......▶ Fiori Elements — Flexible Programming Model
   bespoke UX / non-standard navigation ...................▶ Freestyle UI5 (TypeScript)
```

## 3. Selection matrix

| Pattern | Use when | Avoid when | Starter |
| --- | --- | --- | --- |
| **Fiori Elements — List Report + Object Page** | Transactional CRUD; worklist + detail; filter/sort/draft for free | Bespoke UX that annotations can't express | `cap-fullstack-listreport` |
| **Fiori Elements — Analytical List Page** | Charts/KPIs/aggregation up front, then act; drill-down by dimension | No chart or measures to aggregate (use List Report) | `cap-fullstack-listreport` |
| **Fiori Elements — Object Page (standalone)** | A single record entered by key (tile/deep-link/cross-app); no worklist | Users must search/pick a set first (use List Report) | `cap-fullstack-listreport` |
| **Fiori Elements — Flexible Programming Model (FPM)** | Standard list/detail plus one custom section/column/chart/validation | Pure-standard (use LROP) or fully bespoke (use Freestyle) | `cap-fullstack-listreport` |
| **Freestyle UI5 (TypeScript)** | Bespoke UX, custom navigation, heavy client logic | Standard list/detail (FE is faster + less code) | `cap-fullstack-freestyle` or `freestyle-ui5-ts` |

Recommend the **Fiori Elements** family by default — less code, automatic accessibility/variants, easier upgrades — and within it the *specific* floorplan whose signals dominate (see G3's signal → floorplan table in `references/decision-gates.md`). Choose **Freestyle** only when the UX genuinely cannot be expressed in annotations.

## 4. The question-gate script

Run these in order. Each shows the **recommended default** and routes the next step. (The `/intent` command turns each into an `AskUserQuestion`.)

- **G1 — Greenfield vs extend?** new build *(recommended for net-new)* | extend existing S/4 *(→ Clean Core extension path)*.
- **G2 — Backend / data source?** Build new CAP service *(recommended when you own the data)* | Consume RAP / ABAP Cloud OData | Consume other existing OData | No backend (UI-only + mock). For any *consume* answer: ask for the `$metadata`/EDMX file (offline-first) and, optionally, the service URL / destination; then ask the **annotation strategy** — backend metadata-extension *(Clean Core preferred)* | local `annotation.xml` | mix.
- **G3 — Floorplan?** First compute the recommended floorplan from the requirement signals (see the signal → floorplan table in `references/decision-gates.md`), then offer all five: Fiori Elements — List Report + Object Page *(default)* | Analytical List Page | Object Page (standalone) | Flexible Programming Model (FPM) | Freestyle UI5 (TypeScript). Present recommended-first; the picker's 4-button cap means show 4 buttons + reach the fifth via "Other" (name all five in the question body).
- **G4 — CAP scope?** First: Is CAP needed? Yes *(recommended)* | No → skip to G5. If yes *(multi-select)*: new service *(recommended)* | extend existing | bound actions | draft on/off | events/messaging.
- **G5 — Auth & roles?** First: Is auth needed? Yes *(recommended)* | No → confirm explicitly, no `@requires`/`@restrict` generated. If yes: XSUAA Viewer/Editor/Admin *(recommended)* | authenticated-user only | custom roles | IAS. Follow-up: per-entity grant matrix (READ/CREATE/UPDATE/DELETE → roles).
- **G6 — Draft handling?** Off for atomic/action-driven flows *(recommended for status-machine apps)* | On for long multi-field edits. Never half-configure drafts.
- **G7 — Data volume / performance?** server paging + shallow `$expand` *(recommended default)*; expand only on the Object Page; growing list > 100 rows.
- **G8 — Run target?** Local first (`cds watch` / mock) *(recommended)* | + proxy to real backend | deploy (CF/MTA). Always generate both mock + proxy config.
- **G9 — TDD sign-off (Gate G in the flow).** Approve → build | Revise → loop to the relevant gate.

See `references/decision-gates.md` for the full question bank (exact wording, why each matters, follow-ups).

## 5. Assumptions you must ALWAYS surface (never guess)

Auth model & roles · OData version (V4) · draft on/off · concurrency/etag on edited entities · key field + type · enum vs free-text for status · currency-paired amounts (`@Measures.ISOCurrency`) · audit/history need · data volume/paging · localization · deploy target · whether a released API already exists (consume vs build). Each surfaced assumption becomes a row in TDD §9.

## 6. Handoff

Once gates resolve and the developer approves the TDD: backend → `cap-skill`; floorplan/manifest → `fiori-bootstrap`; annotations → `fiori-elements` (**FPM, any backend — the UI builder MUST always load `fiori-bootstrap` → `fpm.md` and `fiori-elements` → `fpm-annotations.md`**); service wiring (mock + proxy) → `cap-integration`; tests → `sap-unit-testing`. Prefer the `mcp__intent2app__*` tools to execute; fall back to the skills if the MCP is unavailable.

## References

- [Pattern catalog](references/pattern-catalog.md) — one deep card per pattern.
- [Decision gates](references/decision-gates.md) — the full interactive question bank.
- [Clean Core](references/clean-core.md) — principles, released-API discipline, on-stack vs side-by-side.
- [CAP vs RAP backends](references/backend-cap-vs-rap.md) — when to build vs consume, and how.
