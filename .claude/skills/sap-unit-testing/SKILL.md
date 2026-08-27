---
name: sap-unit-testing
description: >
  Testing for Intent2App across both layers — CAP service tests with Jest + cds.test(), and UI5 tests
  with QUnit (unit) and OPA5 (integration). Load when writing or reviewing tests, defining a test
  plan, or producing the Unit Testing Document. Covers computed-field boundary tests, authorization
  tests, action/transition tests, etag/concurrency, the required test-case table format, coverage
  targets, and how to run each suite. Keywords: cds.test, jest, QUnit, OPA5, opaTest, journey,
  boundary values, criticality, authorization test, 400, 409, 412, coverage, npm test, unit-test.
---

# Unit & Integration Testing

> Complements `cap-best-practices` (service) and `fiori-app-bootstrapping` (UI). For deep OPA5 patterns
> use the official `ui5` plugin's `ui5-best-practices-opa5` skill when present. The Documenter uses this
> skill to fill `templates/UNIT_TESTING_DOCUMENT.md`.

## Test pyramid

More CAP service tests + UI5 unit (QUnit) tests; fewer UI5 integration (OPA5) journeys. Every state
transition needs a happy path **and** at least one negative path.

## CAP service tests (Jest + cds.test)

```js
const cds = require('@sap/cds');
const { GET, POST, PATCH, expect } = cds.test(__dirname + '/..');   // boots the service in-memory

describe('PurchaseOrderService', () => {
  it('serves $metadata', async () => { const { status } = await GET('/odata/v4/purchaseorder/$metadata'); expect(status).to.equal(200); });

  // Computed field — boundary values (the PDF Status-column pattern)
  it('maps status → criticality', async () => {
    const { data } = await GET(`/odata/v4/purchaseorder/PurchaseOrders?$filter=POStatus eq 'APPROVED'`);
    expect(data.value[0].POStatusCriticality).to.equal(3);   // 0 Neutral,1 Negative,2 Critical,3 Positive
  });

  // Authorization
  it('rejects writes for Viewer', async () => {
    const res = await POST('/odata/v4/purchaseorder/PurchaseOrders', { PONumber:'X' }, { auth: { username:'viewer', password:'' } });
    expect(res.status).to.be.oneOf([401, 403]);
  });

  // Guard + action transitions
  it('blocks direct status PATCH', async () => {
    await expect(PATCH('/odata/v4/purchaseorder/PurchaseOrders(1)', { POStatus:'APPROVED' })).to.be.rejectedWith(/400/);
  });
  it('rejects an invalid transition', async () => {
    await expect(POST('/odata/v4/purchaseorder/PurchaseOrders(1)/PurchaseOrderService.approve', {})).to.be.rejectedWith(/409/);
  });
  // Concurrency: stale etag → 412 Precondition Failed
});
```
Cover: `$metadata` 200 · CRUD per role · computed-field boundaries (each criticality value) · auth (Viewer can't write; Admin-only delete; direct status edit → 400) · actions (valid transition + audit row; invalid → 409) · stale etag → 412. See [`references/cap-jest.md`](references/cap-jest.md).

## UI5 unit tests (QUnit)

Test controllers, formatters, and the criticality mapping in isolation; keep controllers thin so they're testable.
```js
QUnit.module('formatter');
QUnit.test('criticality', assert => { assert.strictEqual(formatter.criticality('APPROVED'), 3); });
```

## UI5 integration tests (OPA5)

Journeys via page objects: list loads → filter → navigate to Object Page → invoke action → status/criticality updates → role-gated action visibility. Structure: `test/integration/opaTests.qunit.ts`, `pages/*.ts`, `*Journey.ts`; use `autoWait: true`. Defer authoring depth to `ui5-best-practices-opa5`. See [`references/ui5-opa5.md`](references/ui5-opa5.md).

## Required test-case table (use in the Unit Testing Document)

| ID | Layer | Scenario | Preconditions | Input | Expected | Type |
|---|---|---|---|---|---|---|
| CAP-01 | CAP | Status→criticality (APPROVED) | seeded PO | `$filter POStatus eq 'APPROVED'` | `POStatusCriticality = 3` | boundary |
| CAP-02 | CAP | Viewer cannot create | role=Viewer | POST PurchaseOrders | 401/403 | security |
| CAP-03 | CAP | Direct status PATCH blocked | seeded PO | PATCH POStatus | 400 | negative |
| CAP-04 | CAP | Invalid transition | DRAFT PO | action approve | 409 | negative |
| OPA-01 | OPA5 | Navigate list → Object Page | mock data | click first row | Object Page shows PO | positive |

## Coverage & running

- Targets: CAP service ≥ **80%** statements/branches (every action + guard + transition incl. negatives); UI5 controllers/formatters via QUnit; every primary journey via OPA5.
- Run: `npm test` (CAP Jest) · `npm run unit-test` (UI5 QUnit) · `npm run int-test` (UI5 OPA5). Use `mcp__intent2app__run_checks` to execute the CAP/UI5 gates.
