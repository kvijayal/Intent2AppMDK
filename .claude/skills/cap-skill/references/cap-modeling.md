# CAP CDS Modeling

OData V4 only. Model the domain in `db/schema.cds`, expose it in `srv/service.cds`, keep
business logic in `srv/service.js`. Canonical example: `reference-apps/cap-fullstack-listreport/`.

---

## Core Rules

- Use `managed` (createdAt/By, modifiedAt/By) and `cuid` aspects for business entities; explicit
  `key` only when the domain demands a natural key.
- Model relationships with `Association to` (reference) and `Composition of many` (owned/child)
  — never duplicate foreign keys by hand.
- Enums for fixed value sets; back status columns with a **computed integer criticality** filled
  in an `after('READ')` handler.
- Currency/amount pairs use `@Measures.ISOCurrency`; quantities use `@Measures.Unit`.
- **Fiori Elements create/edit requires `@odata.draft.enabled`** (or sticky sessions).

---

## 1. Annotated Schema

```cds
namespace sales;

using { managed, cuid, Currency, sap.common.CodeList } from '@sap/cds/common';

// Enum: fixed value set — CAP exposes as fixed-value ValueList in Fiori Elements automatically
type OrderStatus : String(20) enum {
    DRAFT     = 'DRAFT';
    SUBMITTED = 'SUBMITTED';
    APPROVED  = 'APPROVED';
    REJECTED  = 'REJECTED';
    COMPLETED = 'COMPLETED';
}

// Root entity
// `cuid`    → adds  key ID : UUID
// `managed` → adds  createdAt/createdBy, modifiedAt/modifiedBy (auto-filled)
entity SalesOrders : cuid, managed {
    orderNo      : String(20)  @mandatory;
    customer     : String(100) @mandatory;
    orderDate    : Date;
    status       : OrderStatus default 'DRAFT';

    // Money is ALWAYS a pair: amount + currency
    grossAmount  : Decimal(15,2);
    currency     : Currency;              // managed assoc to sap.common.Currencies

    // Criticality is COMPUTED on after('READ') — never stored as business data
    // 0 Neutral · 1 Negative(red) · 2 Critical(orange) · 3 Positive(green)
    statusCriticality : Integer;

    // Optimistic concurrency: etag on a managed timestamp
    modifiedAt   : Timestamp
                     @odata.etag
                     @cds.on.update: $now
                     @cds.on.insert: $now;

    // Owned children → Composition (cascade delete, part of the same draft)
    items        : Composition of many SalesOrderItems on items.parent = $self;

    // Reference to an independent entity → Association (no cascade, own lifecycle)
    salesArea    : Association to SalesAreas;
}

// Child entity (owned by SalesOrders)
entity SalesOrderItems : cuid {
    parent       : Association to SalesOrders;   // back-link for the composition
    position     : Integer;
    product      : String(40) @mandatory;
    quantity     : Integer    default 1;
    netAmount    : Decimal(15,2);
    currency     : Currency;
}

// Independent master data (referenced, not owned)
entity SalesAreas : cuid {
    name         : String(100) @mandatory @title;
    region       : String(40);
}

// Localization: translatable text
// `localized` makes name/description language-dependent;
// CAP creates the .texts table and serves the caller's language automatically
entity Materials : cuid, managed {
    materialNo   : String(40) @mandatory;
    name         : localized String(100) @title;
    description  : localized String(500);
}
```

---

## 2. Association vs Composition

| | **Association** | **Composition** |
|---|---|---|
| Relationship | References an independent entity | Owns a dependent child |
| Lifecycle | Target lives on its own | Child lives and dies with the parent |
| Delete behaviour | No cascade | **Cascade delete** |
| Drafts | Target is a separate draft root | Children are part of the **same draft** |
| Syntax | `Association to X` | `Composition of many Y on Y.parent = $self` |
| Pick when | Master/reference data, lookups | Header→items, owned sub-records |

**Rule of thumb:** owns → Composition; refers-to → Association.

---

## 3. OData V4 & Query Discipline

```json
"settings": {
  "operationMode": "Server",
  "autoExpandSelect": true,
  "earlyRequests": true,
  "odataVersion": "4.0"
}
```

- **`operationMode: 'Server'`** — paging, sorting, filtering on the server, never client-side.
- **`autoExpandSelect: true`** — let the framework derive `$select`/`$expand` from what the UI binds.
- **`earlyRequests: true`** — fire metadata/initial requests early for faster first render.

Query rules:

- Keep **list `$expand` shallow** — list rows rarely need children.
- **Expand detail only on the Object Page**, where the user is looking at one record.
- Push filtering/sorting to the server via `$filter`/`$orderby`; for aggregation use `$apply` (ALP).
- Compute set-based in `after('READ')`, never per-row queries inside a loop (N+1 trap).

---

## 4. Drafts Deep-Dive (`@odata.draft.enabled`)

```cds
service SalesOrderService @(requires: 'authenticated-user') {
  @odata.draft.enabled
  entity SalesOrders as projection on sales.SalesOrders;
  // Compositions (items) are part of the SAME draft as the parent
}
```

What CAP/FE do automatically when drafts are on:

- Generate draft administrative data and a draft table; expose `IsActiveEntity`/`HasDraftEntity`.
- Provide draft actions (`draftEdit`, `draftActivate`, `draftPrepare`) — FE wires the buttons.
- Treat compositions as part of the same draft (edit header + items together, activate atomically).

### When to keep drafts OFF

| Situation | Drafts |
|---|---|
| Status machine, mutation via bound actions | **OFF** (default) |
| Create-once then transition only | OFF |
| Read/analytics only | OFF |
| Long multi-field header+items editing, resumable | **ON** |

**Never half-configure drafts** — they are either fully on or off.

### Etag interplay

- **Drafts OFF:** the etag is the concurrency control. Client sends `If-Match`; stale value → `412`.
- **Drafts ON:** the draft lock prevents concurrent edits during the session; etag applies at activation.

Either way, `@odata.etag` belongs on the entity. Don't rely on drafts *instead of* an etag.

---

## 5. Service Layer & Handlers

### service.cds — project, don't redefine

```cds
using { sales } from '../db/schema';

service SalesOrderService @(path: '/odata/v4/salesorder', requires: 'authenticated-user') {

    entity SalesOrders as projection on sales.SalesOrders
      actions {
        action submit()  returns SalesOrders;
        action approve() returns SalesOrders;
        action reject(reason : String) returns SalesOrders;
      };

    entity SalesOrderItems as projection on sales.SalesOrderItems;

    @readonly entity SalesAreas    as projection on sales.SalesAreas;
    @readonly entity AuditEntries  as projection on sales.AuditEntries;
}
```

### service.js — handler class

```javascript
const cds = require('@sap/cds');
const log = cds.log('salesorder');

module.exports = class SalesOrderService extends cds.ApplicationService {
  async init() {
    const { SalesOrders, AuditEntries } = this.entities;

    // before: validate / guard
    this.before(['CREATE', 'UPDATE'], 'SalesOrders', (req) => {
      const { orderNo, customer, grossAmount } = req.data;
      if (orderNo !== undefined && !orderNo?.trim())
        req.error(400, 'ORDERNO_REQUIRED', 'orderNo');
      if (grossAmount !== undefined && grossAmount < 0)
        req.error(400, 'AMOUNT_NEGATIVE', 'grossAmount');
    });

    // Guard: block direct edits of `status` — moves only via actions
    this.before('UPDATE', 'SalesOrders', (req) => {
      if ('status' in req.data)
        req.error(400, 'STATUS_DIRECT_EDIT_FORBIDDEN', 'status');
    });

    // after: enrich / compute (set-based, no per-row queries)
    this.after('READ', 'SalesOrders', (data) => {
      for (const row of (Array.isArray(data) ? data : [data])) {
        if (row?.status !== undefined) row.statusCriticality = toCriticality(row.status);
      }
    });

    // on: custom actions (state transitions)
    this.on('submit',  'SalesOrders', (req) => this._transition(req, 'SUBMITTED', ['DRAFT']));
    this.on('approve', 'SalesOrders', (req) => this._transition(req, 'APPROVED',  ['SUBMITTED']));
    this.on('reject',  'SalesOrders', (req) => this._transition(req, 'REJECTED',  ['SUBMITTED'], req.data.reason));

    return super.init();
  }

  async _transition(req, target, allowedFrom, reason) {
    const tx  = cds.transaction(req);
    const key = req.params[req.params.length - 1];
    const { SalesOrders, AuditEntries } = this.entities;

    const order = await tx.run(SELECT.one.from(SalesOrders).where(key));
    if (!order) return req.error(404, 'ORDER_NOT_FOUND');

    if (!allowedFrom.includes(order.status))
      return req.error(409, 'INVALID_TRANSITION',
        `Cannot move from ${order.status} to ${target}.`);

    await tx.run(UPDATE(SalesOrders).set({ status: target }).where(key));
    await tx.run(INSERT.into(AuditEntries).entries({
      entity: 'SalesOrders', entityKey: order.ID,
      fromStatus: order.status, toStatus: target, reason,
      at: new Date().toISOString(), by: req.user?.id
    }));

    log.info(`SalesOrder ${order.ID}: ${order.status} → ${target}`);
    return { ...order, status: target, statusCriticality: toCriticality(target) };
  }
};

// 0 Neutral · 1 Negative(red) · 2 Critical(orange) · 3 Positive(green)
function toCriticality(status) {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED': return 3;
    case 'SUBMITTED': return 2;
    case 'REJECTED':  return 1;
    default:          return 0;
  }
}
```

### Handler-phase matrix

| Phase | CREATE | READ | UPDATE | DELETE | action |
| --- | --- | --- | --- | --- | --- |
| **before** | validate input, set defaults | auth checks | validate, guard status | check deletability | validate args, authorize |
| **on** | rarely (custom persistence) | rarely | rarely | rarely (soft-delete) | **the action body** |
| **after** | shape response | **compute criticality**, mask fields | shape response | cleanup/log | shape/return result |

### req.error taxonomy

| Code | Meaning | Typical use |
|---|---|---|
| **400** | Bad Request | Invalid/missing input, empty mandatory field |
| **403** | Forbidden | Authorization denied (usually via `@restrict`) |
| **404** | Not Found | Action on a non-existent key |
| **409** | Conflict | Invalid status transition |
| **412** | Precondition Failed | Stale etag, concurrent edit |
| **422** | Unprocessable | Valid shape but breaks a domain rule |

---

## 6. Bound-Action Checklist

A correct transition action always:

- Declared **bound** on the entity in `service.cds` (`actions { action submit() returns Entity; }`) and surfaced in the UI as `UI.DataFieldForAction` — **never** triggered from controller code.
- **Validates the transition** against allowed source states → `req.error(409, 'INVALID_TRANSITION', …)` on an illegal move.
- Reads, updates, and audits **inside one transaction** via `cds.transaction(req)` — so a failure rolls back both the status change and the audit row (atomic).
- **Writes an audit entry** in the same transaction (who/when/from/to/reason).
- Logs via `cds.log()`, returns the updated entity (with recomputed criticality).
- Has its own `@(requires: …)` in `@restrict` if the action needs a different role than the entity.

---

## 7. Computed Criticality — Why `after READ` and Not a Virtual Field

Keep a plain `Integer` column so `autoExpandSelect` selects it, then **always recompute on READ** so the value never goes stale:

1. Model `statusCriticality : Integer;` (plain column, not stored business data).
2. In `after('READ', '<Entity>', data)` iterate rows and set `row.statusCriticality = toCriticality(row.status)`.
3. In annotations, drive a `UI.DataPoint` with `Criticality: statusCriticality` and `CriticalityRepresentation: #WithIcon`, and hide the raw integer column via `@UI.Hidden`.

**Why not a virtual field:** virtual fields are not always selected by `autoExpandSelect` and can be omitted from `$select`. Computing on READ guarantees the value is present and consistent for every projection.

**Naming HARD CONSTRAINT:** Entities PascalCase, fields camelCase, services named `…Service`.

---

## 8. Common Pitfalls

| # | Symptom | Cause | Fix | Prevention |
| --- | --- | --- | --- | --- |
| 1 | `unresolved association` on `cds build` | Projected entity but not its association target | Project **both sides** in the service | When adding an entity with `Association to Y`, project `Y` too (or `@cds.autoexpose`) |
| 2 | Fiori list shows nothing / `$metadata` parse error | OData V2 model bound to V4 service | Use V4 model with `odataVersion: '4.0'` | V4 only (HARD CONSTRAINT); set `odataVersion` explicitly in manifest |
| 3 | No 403 ever / anyone can write | Missing `@restrict` on a writable entity | Add `@restrict` grants to **every** writable entity | Run `run_checks`/`clean_core_check`; review every new entity for grants |
| 4 | Lost updates — second save silently overwrites | No `@odata.etag` on the edited entity | Add `@odata.etag` to a managed `modifiedAt` | etag on every user-edited entity from the start (HARD CONSTRAINT) |
| 5 | Slow lists; DB hammered with many small reads | N+1: per-row query in `after('READ')` | Replace with one set-based query (see below) | Never query inside a per-row loop; compute set-based |
| 6 | Stale/missing criticality; status edited directly | Status PATCHed instead of via action; criticality stored not computed | Guard `status` in `before UPDATE`; move state via bound actions; compute criticality in `after READ` | Action-driven status machine; plain Integer column recomputed on READ |
| 7 | `console.log` output in logs / no log levels | Used `console.log` instead of `cds.log` | Use `cds.log('<area>')` with `.info/.warn/.error` | HARD CONSTRAINT: no `console.log`; one logger per service |
| 8 | Half-working draft UX (Edit button but Save fails) | Draft partially configured | Either fully enable `@odata.draft.enabled` (root only, compositions follow) or remove it | Never half-configure drafts; decide on/off upfront |
| 9 | Money shows without currency / wrong formatting | Bare amount field, no currency pairing | Pair amount with `Currency` and link via `@Measures.ISOCurrency` | Always model money as amount + currency code pair |
| 10 | Build green but `cds watch` 404s the service | Wrong `@path` or app bound to the wrong URL | Check `cds compile '*' --to serviceinfo`; align manifest `dataSources.uri` to the real path | Verify service URL after every projection/path change |
| 11 | `npm install` fails `ERESOLVE … peer @sap/cds` | DB driver major doesn't match CDS major | Use `@sap/cds ^9` + `@cap-js/sqlite ^2` (peers `>=9`) — never `--legacy-peer-deps` | Pin compatible majors from the start; copy `reference-apps/cap-fullstack-listreport/package.json` |
| 12 | `RangeError: Invalid time value` seeding a CSV | A seed-CSV row has the wrong number of fields, shifting values into a Date/Timestamp column | Re-align the row so every row has exactly one field per entity element, including the 4 `managed` audit columns | After editing seed data, count fields per row against the header; `managed` adds 4 trailing columns |
| 13 | Every OData call returns 401 in local dev | Service has `@requires`/`@restrict` but no `[development]` mocked auth profile is set | Add `"[development]": { "kind": "mocked", "users": {...} }` to `cds.requires.auth` in `package.json` | Never weaken annotations; gate dev vs prod with profiles; keep `"[production]": { "kind": "xsuaa" }` |
| 14 | Blank page / `sap-ui-core.js not found` for CAP-embedded Fiori app | `cds-plugin-ui5` missing from root deps, or `index.html` bootstrap inconsistent with `ui5.yaml` | Add `cds-plugin-ui5` to root devDeps; align bootstrap and `ui5.yaml` | See the `fiori-bootstrap` skill — "The CAP serving rule" |

### N+1 — Fix Pattern

```javascript
// ❌ ANTI-PATTERN: one SELECT per row → N+1
this.after('READ', 'SalesOrders', async (rows) => {
  for (const o of rows) {
    const items = await SELECT.from('SalesOrderItems').where({ parent_ID: o.ID });
    o.itemCount = items.length;
  }
});

// ✅ Set-based: a single grouped query for all rows
this.after('READ', 'SalesOrders', async (rows) => {
  const list = Array.isArray(rows) ? rows : [rows];
  if (!list.length) return;
  const ids = list.map(o => o.ID);
  const counts = await SELECT
    .from('SalesOrderItems')
    .columns('parent_ID', 'count(*) as n')
    .where({ parent_ID: { in: ids } })
    .groupBy('parent_ID');
  const byParent = Object.fromEntries(counts.map(c => [c.parent_ID, c.n]));
  for (const o of list) o.itemCount = byParent[o.ID] ?? 0;
});
```
