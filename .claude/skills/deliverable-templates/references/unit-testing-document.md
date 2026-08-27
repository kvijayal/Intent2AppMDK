<!--
  Intent2App — Unit Testing Document template.
  Fill every {{placeholder}}, delete guidance comments. Output to:
  <app-name>/deliverables/Unit-Testing-Document.md
-->

# Unit Testing Document — {{App / Feature Name}}

## 0. Document control

| Field | Value |
|---|---|
| App / feature | {{name}} |
| Linked TDD | ./Technical-Design-Document.md |
| Author | {{author}} (Intent2App) |
| Date | {{YYYY-MM-DD}} |
| Units under test | {{CAP service(s) + Fiori app(s)}} |

## 1. Scope & strategy

- **CAP service tests** — Jest + `cds.test()` (in-memory). Validation, computed fields, authorization, actions, concurrency.
- **UI5 unit tests** — QUnit: controllers, formatters, the criticality mapping.
- **UI5 integration tests** — OPA5 journeys against the mock server.
- **Pyramid:** more service + unit tests, fewer OPA5 journeys. Every state transition: a happy path **and** ≥1 negative.

## 2. Test environment & data

- CAP: in-memory sqlite via `cds.test`; seed data {{CSV/JSON}}; mock users for `@restrict` ({{viewer/editor/admin}}).
- UI5: mock server (`ui5-mock.yaml`, EDMX + generated data) for OPA5; no live backend needed.

## 3. CAP service test cases

| ID | Scenario | Preconditions | Input | Expected | Type |
|---|---|---|---|---|---|
| CAP-01 | `$metadata` served | service up | `GET …/$metadata` | 200 | positive |
| CAP-02 | status → criticality ({{APPROVED}}) | seeded row | `$filter status eq '{{APPROVED}}'` | criticality = 3 | boundary |
| CAP-03 | status → criticality ({{SUBMITTED}}) | seeded row | `$filter status eq '{{SUBMITTED}}'` | criticality = 2 | boundary |
| CAP-04 | Viewer cannot create | role=Viewer | POST {{Entity}} | 401/403 | security |
| CAP-05 | direct status edit blocked | seeded row | PATCH status | 400 | negative |
| CAP-06 | valid transition + audit | {{DRAFT}} row | action {{approve}} | 200 + audit row written | positive |
| CAP-07 | invalid transition | {{wrong state}} | action {{approve}} | 409 | negative |
| CAP-08 | stale etag rejected | fetched row | PATCH with old etag | 412 | negative |

## 4. UI5 unit (QUnit) test cases

| ID | Scenario | Input | Expected | Type |
|---|---|---|---|---|
| QU-01 | criticality formatter | {{'APPROVED'}} | 3 | positive |
| QU-02 | controller onInit binds model | view created | model set | positive |

## 5. UI5 integration (OPA5) journeys

| ID | Journey | Steps | Expected | Type |
|---|---|---|---|---|
| OPA-01 | List → Object Page | open app → click first row | Object Page shows the item | positive |
| OPA-02 | Filter | enter {{filter}} → go | list filtered | positive |
| OPA-03 | Invoke action | select row → {{approve}} | status + criticality update | positive |
| OPA-04 | Role-gated action hidden | role=Viewer | action not visible | security |

## 6. Coverage targets

- CAP service ≥ **80%** statements/branches — every action, guard, and transition (incl. negatives).
- UI5 controllers/formatters covered by QUnit; every primary journey covered by OPA5.
- Must-cover list: {{each status transition happy + ≥1 negative; each role's allowed/denied operation}}.

## 7. How to run

```bash
cd {{app}}
npm install
npm test            # CAP Jest (cds.test)
npm run unit-test   # UI5 QUnit
npm run int-test    # UI5 OPA5
```
Or via the MCP: `mcp__intent2app__run_checks { appDir, stack }`.

## Appendix — traceability

| Requirement | TDD element | Test ID(s) |
|---|---|---|
| {{req}} | {{§5 action approve}} | CAP-06, CAP-07, OPA-03 |
