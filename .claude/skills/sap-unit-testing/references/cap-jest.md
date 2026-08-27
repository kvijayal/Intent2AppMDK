*Part of the sap-unit-testing skill.*

# CAP service tests (Jest + cds.test)

`cds.test()` boots the CAP service in-memory (SQLite) and exposes HTTP-style helpers (`GET`, `POST`, `PATCH`, `DELETE`) plus a Chai `expect`. Tests run with `jest ^29` against `@sap/cds ^9`, OData V4. Real service under test: `Claude-Code/purchaseOrder/srv` (status→criticality in `service.js`, validation guards, the `PurchaseOrderService` projection).

## Setup & how to run

`test/service.test.js`:

```js
const cds = require('@sap/cds');
// Boots the CAP app rooted one level up; serves OData in-memory.
const { GET, POST, PATCH, DELETE, expect } = cds.test(__dirname + '/..');

const SRV = '/odata/v4/purchaseorder';
const admin  = { auth: { username: 'admin',  password: '' } };
const viewer = { auth: { username: 'viewer', password: '' } };
```

Run: `npm test`. On **CAP 9**, `cds.test` lives in a separate package — add `@cap-js/cds-test` to `devDependencies` (alongside `jest` and `@cap-js/sqlite`), or the suite fails with `Cannot resolve module '@cap-js/cds-test'`. Booting the in-memory service exceeds Jest's default 5 s hook timeout on a cold run, so wire `"test": "jest --testTimeout=120000"` (verified working in `reference-apps/cap-fullstack-listreport`). Use `mcp__intent2app__run_checks` to execute the CAP gate. Target ≥ 80% statements/branches, covering every action, guard, and transition including the negatives.

## 1. $metadata health

```js
describe('PurchaseOrderService', () => {
  it('serves $metadata', async () => {
    const { status, headers } = await GET(`${SRV}/$metadata`);
    expect(status).to.equal(200);
    expect(headers['content-type']).to.match(/xml/);
  });

  it('exposes the entity set', async () => {
    const { status, data } = await GET(`${SRV}/PurchaseOrders?$top=1`);
    expect(status).to.equal(200);
    expect(data.value).to.be.an('array');
  });
});
```

## 2. CRUD by role

```js
describe('CRUD', () => {
  it('admin can create', async () => {
    const { status, data } = await POST(`${SRV}/PurchaseOrders`,
      { PONumber: 'PO-100', Vendor: 'Acme', TotalAmount: 500, Currency: 'EUR' }, admin);
    expect(status).to.equal(201);
    expect(data.PONumber).to.equal('PO-100');
  });

  it('admin can read by key', async () => {
    const { status } = await GET(`${SRV}/PurchaseOrders(1)`, admin);
    expect(status).to.equal(200);
  });
});
```

## 3. Computed-field boundary asserts (each criticality value)

The `after('READ')` handler maps status → criticality. Assert **every** branch of the enum — these are the boundary cases the Unit Testing Document must list.

```js
describe('status → criticality (boundary values)', () => {
  const cases = [
    ['APPROVED',  3],   // Positive (green)
    ['COMPLETED', 3],   // Positive (green)
    ['SUBMITTED', 2],   // Critical (orange)
    ['REJECTED',  1],   // Negative (red)
    ['DRAFT',     0],   // Neutral  (grey)
  ];
  it.each(cases)('%s → %i', async (status, expected) => {
    const { data } = await GET(
      `${SRV}/PurchaseOrders?$filter=POStatus eq '${status}'&$select=POStatus,POStatusCriticality`, admin);
    expect(data.value.length).to.be.greaterThan(0);
    for (const row of data.value) expect(row.POStatusCriticality).to.equal(expected);
  });
});
```

## 4. Authorization

Viewer cannot write; only Admin can delete. (Requires `@requires`/`@restrict` on the service — see `cap-skill`.)

```js
describe('authorization', () => {
  it('Viewer cannot create', async () => {
    const res = await POST(`${SRV}/PurchaseOrders`, { PONumber: 'X', Vendor: 'Y' }, viewer)
      .catch(e => e);                     // rejected requests throw; capture the error
    expect(res.response?.status ?? res.status).to.be.oneOf([401, 403]);
  });

  it('Viewer cannot update', async () => {
    await expect(PATCH(`${SRV}/PurchaseOrders(1)`, { Vendor: 'New' }, viewer))
      .to.be.rejectedWith(/40[13]/);
  });

  it('only Admin can delete', async () => {
    await expect(DELETE(`${SRV}/PurchaseOrders(1)`, viewer)).to.be.rejectedWith(/40[13]/);
    const { status } = await DELETE(`${SRV}/PurchaseOrders(1)`, admin);
    expect(status).to.equal(204);
  });
});
```

## 5. Guard: direct status PATCH → 400

Status must change only via actions, never a raw field write. The `before('UPDATE')` guard rejects a direct `POStatus` PATCH.

```js
it('blocks a direct status PATCH', async () => {
  await expect(PATCH(`${SRV}/PurchaseOrders(1)`, { POStatus: 'APPROVED' }, admin))
    .to.be.rejectedWith(/400/);
});

it('rejects a negative amount', async () => {
  await expect(POST(`${SRV}/PurchaseOrders`,
    { PONumber: 'PO-Neg', Vendor: 'Acme', TotalAmount: -1 }, admin))
    .to.be.rejectedWith(/400/);
});
```

## 6. Bound action — happy path + audit + invalid transition → 409

Every transition needs a happy path AND a negative path. Assert the resulting status, the audit row written by the handler, and that an illegal transition is refused with 409 Conflict.

```js
describe('approve action', () => {
  it('approves a SUBMITTED PO and writes an audit row', async () => {
    // arrange: a PO in SUBMITTED state (seed or via a submit action)
    const { status, data } = await POST(
      `${SRV}/PurchaseOrders(2)/PurchaseOrderService.approve`, {}, admin);
    expect(status).to.equal(200);
    expect(data.POStatus).to.equal('APPROVED');

    // audit assertion — read the audit projection the handler appended to
    const audit = await GET(
      `${SRV}/PurchaseOrderAudit?$filter=PO_ID eq 2 and action eq 'APPROVE'`, admin);
    expect(audit.data.value.length).to.be.greaterThan(0);
  });

  it('rejects an invalid transition (DRAFT → approve) with 409', async () => {
    await expect(POST(`${SRV}/PurchaseOrders(3)/PurchaseOrderService.approve`, {}, admin))
      .to.be.rejectedWith(/409/);
  });
});
```

## 7. Concurrency — stale etag → 412

With `@odata.etag` (or `@cds.on.update` managed `modifiedAt`) the service enforces optimistic locking. A PATCH carrying an outdated ETag is refused with 412 Precondition Failed.

```js
it('rejects a stale ETag with 412', async () => {
  const read = await GET(`${SRV}/PurchaseOrders(1)`, admin);
  const etag = read.headers.etag;

  // someone else updates the row, bumping the ETag
  await PATCH(`${SRV}/PurchaseOrders(1)`, { Vendor: 'First' }, admin);

  // our write still uses the OLD etag → 412
  await expect(
    PATCH(`${SRV}/PurchaseOrders(1)`, { Vendor: 'Second' },
      { ...admin, headers: { 'If-Match': etag } })
  ).to.be.rejectedWith(/412/);
});
```

## Asserting rejections

CAP throws on non-2xx, so use either `.catch(e => e)` and inspect `e.response.status`, or Chai's `rejectedWith(/code/)`. Enable `chai-as-promised` (cds.test bundles Chai); the regex matches the HTTP status in the error message.

## What to cover (maps to the test-case table)

`$metadata` 200 · CRUD per role · computed-field boundaries (every criticality value 0/1/2/3) · auth (Viewer can't write; Admin-only delete; direct status PATCH → 400) · actions (valid transition + audit row; invalid → 409) · stale etag → 412 · negative input validation (empty mandatory, negative amount → 400).

## Checklist

`cds.test(__dirname+'/..')` boots in-memory · per-role auth objects · every criticality branch asserted · guard + validation negatives covered · action happy path + audit + 409 · etag 412 · ≥ 80% statements/branches · run with `npm test` / `run_checks`.
