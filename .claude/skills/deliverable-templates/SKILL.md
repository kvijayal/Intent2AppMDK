---
name: deliverable-templates
description: >
  How to produce Intent2App's written deliverables — the Application Architecture document (Gate G),
  the Technical Design Document (/document), and the Unit Testing Document (/document) — by filling
  the templates from architecture decision-gate answers. Load when writing/updating any deliverable,
  or mapping gate answers into a document. Keywords: application architecture, technical design
  document, TDD, unit testing document, test plan, template, placeholders, traceability, deliverable.
---

# Deliverable Templates

> Complements `sap-architecture` (source of gate answers) and `sap-unit-testing` (test content).
> Templates live in `templates/`; finished documents go to `<app>/docs/`.

## Outputs & locations

| Deliverable | When produced | Template | Output path |
| --- | --- | --- | --- |
| Application Architecture | Auto — Gate G sign-off (`/intent`) | [`references/application-architecture.md`](references/application-architecture.md) | `<app>/deliverables/Application-Architecture.md` |
| Technical Design Document | On-demand — `/document` | [`references/technical-design-document.md`](references/technical-design-document.md) | `<app>/deliverables/Technical-Design-Document.md` |
| Unit Testing Document | On-demand — `/document` | [`references/unit-testing-document.md`](references/unit-testing-document.md) | `<app>/deliverables/Unit-Testing-Document.md` |

Fill every `{{placeholder}}` from the gate answers. Never leave a `{{placeholder}}` in a finished document.

## Gate answers → TDD sections

| Source | TDD section |
|---|---|
| Backend choice (G2/B) + run target (G8) + `Application-Architecture.md` + `mta.yaml` | §3 Solution Architecture — topology, tech stack, runtime environments |
| Functional requirements / FD | §4 Functional Specification — screens, fields, actions, processing logic |
| `cds.requires` in `package.json` + destination `init_data` in `mta.yaml` + Gate G8 | §5 Integration Design — integration flows, destination config |
| `srv/*.js` scan — `req.error()`, `req.reject()`, `req.warn()` calls | §6 Error Handling — validation errors, auth errors, system errors |
| Auth (G5) + `xs-security.json` | §7 Security & Authorization — roles, Fiori tiles, auth checks |
| Draft (G6), volume (G7) | §8 Nonfunctional Requirements |
| Every surfaced assumption | §12 Open Issues |
| `Application-Architecture.md` diagrams + ADC checklist | §13 Application Design |
| Explicit migration requirement (if in scope) | §14 Data Migration *(Optional)* — delete section if not applicable |

## Gate answers → Unit Testing Document

Backend choice drives §3 CAP cases (Jest) and whether mock or in-memory sqlite is the env (§2). Floorplan drives §5 OPA5 journeys. The data-model/actions gate drives the computed-field boundary and transition cases. Auth drives the §3 authorization cases. Always include the required test-case table (`ID | Layer | Scenario | Preconditions | Input | Expected | Type`) and the coverage targets from `sap-unit-testing`.

## Quality bar

- Every section present; no empty headings, no leftover placeholders.
- §2 of the TDD always states the **chosen pattern, its rationale, and the rejected alternatives** (this is the Clean Core decision record).
- §9 of the TDD lists **every assumption surfaced at a gate** with the chosen default — this is the audit trail of the interactive session.
- The Unit Testing Document's traceability appendix maps requirement → TDD element → test ID(s).
