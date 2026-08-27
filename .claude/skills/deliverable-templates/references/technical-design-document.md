<!--
  Intent2App — Technical Design Document template.
  Fill every {{placeholder}}, delete every <!-- guidance --> comment, and remove sections that
  genuinely do not apply (note why in §9). Never leave a {{placeholder}} in a finished document.
  Output to: <app-name>/deliverables/Technical-Design-Document.md
-->

# Technical Design Document — {{App / Feature Name}}

## 0. Document control

| Field | Value |
|---|---|
| App / feature | {{name}} |
| Author | {{author}} (Intent2App) |
| Date | {{YYYY-MM-DD}} |
| Source FD / requirement | {{path or one-line requirement}} |
| Status | Draft → Approved at Gate G |
| Reviewers | {{names / roles}} |

## 1. Requirement & business goal

- **Intent:** {{restate the requirement in 2–3 sentences}}
- **In scope:** {{…}}  **Out of scope:** {{…}}
- **Actors & roles:** {{e.g. Viewer, Editor, Admin}}
- **Key business rules:** {{e.g. status flow DRAFT → SUBMITTED → APPROVED/REJECTED}}

## 2. Clean Core assessment & chosen pattern

- **Clean Core delivery (Gate A):** {{Standard config | Key-user in-app | Developer on-stack (RAP/ABAP Cloud) | Developer side-by-side (BTP/CAP)}} — rationale: {{…}}
- **Chosen application pattern (Gates B/C):** {{CAP service + Fiori Elements LROP | ALP | Object Page | FPM | Freestyle UI5 | Consume RAP/existing OData}}
- **Rationale:** {{why this pattern best fits the intent + Clean Core}}
- **Rejected alternatives:**

  | Alternative | Why rejected |
  |---|---|
  | {{e.g. Freestyle UI5}} | {{maps to standard list/detail → FE is less code & upgrade-safe}} |
  | {{…}} | {{…}} |

## 3. Solution architecture & runtime topology

- **Backend:** {{Build new CAP service | Consume RAP/ABAP Cloud OData | Consume other OData}}
- **Dev runtime:** {{CAP same-origin `cds watch` @ :4004 | UI5 mock/proxy @ :8080}}
- **Prod runtime (if deploying):** Cloud Foundry / MTA — approuter (XSUAA) → {{CAP service | destination → RAP}} → {{HANA Cloud | S/4 released API}}.

```
{{ASCII topology — e.g.}}
Browser ─▶ Approuter (XSUAA) ─▶ CAP Service ─▶ HANA Cloud
                              └▶ Destination ─▶ S/4 (released OData)
```

## 4. Data model

<!-- For CAP: the entities you will create. For RAP/external: the consumed entity types from the EDMX. -->
| Entity | Key | Key fields | Associations / Compositions | Notes |
|---|---|---|---|---|
| {{Entity}} | {{ID:UUID}} | {{camelCase fields + types}} | {{to X / of many Y}} | {{enum status, @odata.etag, …}} |

- **Enums:** {{status values}}  · **Concurrency:** {{@odata.etag on modifiedAt? }}  · **Money:** {{amount + currency via @Measures.ISOCurrency}}  · **Audit/history:** {{yes/no}}

## 5. OData service design  /  consumed service contract

- **OData version:** V4.  **Service path:** {{/odata/v4/… or /sap/opu/odata4/…}}
- **CAP (if building):** projections {{…}}; computed fields {{status criticality via after-READ}};

  | Action | Bound to | Inputs | Effect | Errors |
  |---|---|---|---|---|
  | {{approve}} | {{Entity}} | {{—}} | {{status → APPROVED + audit}} | {{409 invalid transition}} |

- **RAP/external (if consuming):** service `$metadata` source = {{EDMX file path}}; entity sets used = {{…}}; offline mock generated = yes.

## 6. Annotations / UX design

- **Floorplan:** {{List Report + Object Page | ALP | Object Page | FPM | Freestyle}}
- **List columns / SelectionFields:** {{…}}  · **Object Page facets:** {{…}}
- **Status rendering:** `UI.DataPoint` + `Criticality` + `CriticalityRepresentation: #WithIcon` (0 Neutral, 1 Negative, 2 Critical, 3 Positive).
- **Annotation placement (RAP/external):** {{backend metadata-extension (Clean Core) | local annotation.xml | mix}}
- **Value helps / actions:** {{enum fixed-value lists; references via Common.ValueList; actions as UI.DataFieldForAction}}

## 7. Security & authorization model

- **Auth (Gate D):** {{XSUAA Viewer/Editor/Admin | authenticated-user | custom | IAS}}

| Entity / action | READ | CREATE/UPDATE | DELETE | Action(s) |
|---|---|---|---|---|
| {{Entity}} | {{Viewer,Editor,Admin}} | {{Editor,Admin}} | {{Admin}} | {{approve: Editor,Admin}} |

- `@requires` on the service; `@restrict` on every writable entity; scopes/roles in `xs-security.json` (prod).

## 8. Integration & destinations

- **Consumed/exposed APIs:** {{released OData/events}} — Clean Core: released only.
- **Destinations:** {{name, auth type, principal propagation}}  · **Local:** mock + proxy both generated.

## 9. Assumptions & open questions

<!-- Every assumption surfaced at a gate, with the chosen default. This is the audit trail of the interactive session. -->
| # | Assumption / decision | Chosen value | Confirmed by | Open? |
|---|---|---|---|---|
| 1 | {{OData version}} | {{V4}} | {{user/default}} | no |
| 2 | {{draft handling}} | {{off}} | {{…}} | {{…}} |

### 9a. Conflict register (contradictions resolved at a gate)

<!--
  Every contradiction found in STEP 0 — the FD disagreeing with itself, or a gate answer clashing with
  a requirement. None may remain open at sign-off. Examples: auth "display+update only" vs a "create" screen;
  "draft off" vs a Fiori Elements create/edit form (FE create needs drafts/sticky); a filter field that is free text.
-->
| CONFLICT-NN | Clashing REQ-NNN / FD-§ | What clashes | Resolved at (gate) | Resolution |
|---|---|---|---|---|
| {{CONFLICT-01}} | {{REQ-013 §3.1.6 vs REQ-061 §4.3}} | {{create screen required vs auth grants display+update only}} | {{Gate E}} | {{full CRUD with drafts on}} |

## 10. Non-functional requirements

- **Performance:** server paging; shallow `$expand` in lists; growing > 100 rows.
- **Concurrency:** {{etag yes/no}}.  **Security/CSP:** no inline scripts; no secrets in repo.
- **i18n / a11y:** all labels in i18n; status never colour-only (icon + text).  **Logging:** `cds.log()` / UI5 `Log`.

## 11. Build & run plan

- **Install:** `cd {{app}} && npm install`
- **Run (CAP):** `npm run watch` → http://localhost:4004
- **Run (Freestyle/external):** `npm run start:mock` (offline) | `npm run start:proxy` (real backend)
- **Deploy (if applicable):** MTA build → CF push (approuter + destination + xsuaa).

## 12. Test strategy

See the companion **Unit Testing Document**. Summary: CAP Jest (`cds.test`) for service/computed/auth/actions; UI5 QUnit for controllers/formatters; OPA5 for primary journeys. Coverage target: CAP ≥ 80%.

## Appendix — requirement traceability (full register)

<!--
  MANDATORY: one row for EVERY requirement in <app>/docs/Requirement-Register.md (STEP 0).
  No requirement may be omitted, and none may stay "TBD" — each must be Built, Deferred, or Needs-decision.
  Deferred/Needs-decision rows are the deferral list approved by the developer at Gate G.
-->
<!--
  Disposition vocabulary: at TDD sign-off (Gate G) every row is Designed, Deferred, or Needs-decision —
  never "Built" yet. STEP 8.5 (Coverage Report) then promotes each Designed row to Built (code-verified)
  or Gap (modelled but not actually working). No row may stay TBD; no Gap may ship unless explicitly deferred.
-->
| REQ-ID | Requirement (FD §/table) | Disposition (Designed → Built/Gap at STEP 8.5 / Deferred / Needs-decision) | Design element (section) | Test ID(s) | Notes / reason if deferred |
|---|---|---|---|---|---|
| {{REQ-001}} | {{source text — §2.3.4}} | {{Built}} | {{§5 action simulate}} | {{CAP-04}} | {{—}} |
| {{REQ-002}} | {{source text — §5.3}} | {{Deferred}} | {{—}} | {{—}} | {{e.g. real .xlsx generation out of scope this build}} |

**Coverage summary:** {{n}} requirements — {{Built}} built · {{Deferred}} deferred · {{0}} TBD (must be zero).
