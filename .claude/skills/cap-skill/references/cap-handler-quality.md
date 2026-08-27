# CAP Handler Quality

## What this file adds beyond cap-handlers.md

`cap-handlers.md` documents correct *syntax* — registration, error codes, logging, query patterns.
This file documents how to *assess architectural quality* — is the handler doing the right thing
in the right phase, is it the right OData operation type, and is it structured for maintainability?

---

## 1. Handler-phase matrix

| Operation | `before` | `on` | `after` |
|---|---|---|---|
| CREATE | Validate required fields; set defaults; reject duplicate keys | Rarely — only for custom persistence (e.g. fan-out to multiple tables) | Shape response; compute derived fields |
| READ | Auth pre-checks (rarely needed — prefer `@restrict`) | Rarely — only for completely custom data source | **Compute criticality**; mask sensitive fields; add derived display values |
| UPDATE | Validate changed fields; guard direct edits of state fields | Rarely — only for custom persistence | Shape response; recompute derived fields |
| DELETE | Check deletability (entity in wrong state); cascade-delete anything not handled by Composition | Rarely — soft-delete only | Cleanup, logging |
| Bound action | Validate action parameters; re-check authorization | **The action body** — state transition, atomicity, audit | Return enriched entity |

### Phase compliance rules

**Flag as CRITICAL:**
- `after('READ')` makes a per-row DB query — N+1, degrades under any real data volume.

**Flag as WARNING:**
- `before` reads the DB beyond a quick `SELECT.one` existence check — data fetching belongs in `on`.
- `on` handler for plain CRUD with no custom logic — the framework handles it; delete the handler.
- `around` used without a clear cross-cutting reason (timing, feature flags).

---

## 2. Function vs Action (read-only vs side-effect)

The distinction is enforced by OData: functions use GET, actions use POST.

| Use | Type | OData method | Rule |
|---|---|---|---|
| Calculate/derive a value — no DB write | `function` | GET | Must be `function`, not `action` |
| State transition, DB write, audit trail | `action` | POST | Must be `action`, not `function` |
| Operates on a specific entity instance | Bound action/function | — | Declare in `actions { }` / `functions { }` block |
| Service-level operation, no entity context | Unbound action/function | — | Declare at service level |

**Flag as WARNING:**
- A CDS `function` handler writes to the database — functions must be read-only.
- An `action` only returns a computed value with no side effects — should be a `function`.
- An unbound action receives an entity key and acts only on that record — should be bound.
- An unbound action is triggered from Fiori Elements standard buttons — FE `UI.DataFieldForAction` requires bound actions.
- An unbound action has no `@restrict` — entity-level restrictions do not propagate to unbound actions.

---

## 3. Handler size and extraction

A handler is an **orchestrator**, not an implementor. Complex logic belongs in `srv/lib/`.

**Size guidelines (flag as WARNING when exceeded):**

| Handler type | Guideline | Flag when |
|---|---|---|
| `before` validate | ≤ 20 lines | > 30 lines |
| `on` action | ≤ 60 lines | > 80 lines |
| `after` enrich | ≤ 25 lines | > 40 lines |
| Full handler file | ≤ 200 lines | > 300 lines |

**Extraction triggers — flag as WARNING when:**
- The same helper logic appears in 2+ handlers — extract to `srv/lib/`.
- Business rule logic (domain calculations, validation predicates) is implemented directly in the handler.
- Complex anonymous function inside `cds.service.impl` — extract to named private method (`_approve`, `_buildPayload`).

**Correct extraction structure:**
```
srv/
  service.js          — handler registration only, delegates to lib/
  lib/
    validators.js     — validation predicates
    transitions.js    — state machine logic
    payloadBuilder.js — payload construction
```

**Size measurement command:**
```bash
# Count non-blank, non-comment lines per handler file
for f in srv/*.js; do
  lines=$(grep -c . "$f" 2>/dev/null || echo 0)
  echo "$lines  $f"
done | sort -rn

# List all handler registrations with line numbers
grep -n "this\.\(on\|before\|after\|around\)" srv/*.js
```

---

## 4. Correct patterns per operation type

### Bound action

```javascript
module.exports = class OrdersService extends cds.ApplicationService {
  async init() {
    this.on('approve', 'Orders', (req) => this._approve(req));
    await super.init();
  }

  async _approve(req) {
    const { Orders, AuditEntries } = this.entities;
    const tx = cds.transaction(req);
    const key = req.params[req.params.length - 1];

    const order = await tx.run(SELECT.one.from(Orders).where(key));
    if (!order) return req.error(404, 'ORDER_NOT_FOUND');
    if (order.status !== 'SUBMITTED') return req.error(409, 'INVALID_TRANSITION');

    await tx.run(UPDATE(Orders).set({ status: 'APPROVED' }).where(key));
    await tx.run(INSERT.into(AuditEntries).entries({
      entity: 'Orders', entityKey: order.ID,
      fromStatus: order.status, toStatus: 'APPROVED',
      at: new Date().toISOString(), by: req.user?.id
    }));

    return tx.run(SELECT.one.from(Orders).where(key));
  }
};
```

### Unbound action (service-level, no entity context)

```cds
// srv/service.cds — must have explicit @restrict
service OrdersService @(requires: 'authenticated-user') {
  @(requires: 'Admin')
  action sendReminders(daysOverdue: Integer) returns String;
}
```

```javascript
this.on('sendReminders', async (req) => {
  const { daysOverdue } = req.data;
  const cutoff = new Date(Date.now() - daysOverdue * 86400000).toISOString();
  const overdue = await SELECT.from('Orders').where({ status: 'SUBMITTED', createdAt: { '<=': cutoff } });
  return `${overdue.length} reminders sent`;
});
```

### Function (read-only, GET)

```cds
service OrdersService @(requires: 'authenticated-user') {
  function getOrderSummary(year: Integer) returns array of {
    month: Integer; count: Integer; total: Decimal;
  };
}
```

```javascript
this.on('getOrderSummary', async (req) => {
  const { year } = req.data;
  // SELECT only — no INSERT/UPDATE/DELETE
  return SELECT.from('Orders')
    .columns('month(orderDate) as month', 'count(*) as count', 'sum(grossAmount) as total')
    .where({ year: { '=': year } })
    .groupBy('month(orderDate)');
});
```

### Before — validation patterns

```javascript
// Validate on CREATE and UPDATE (req.data contains only changed fields on UPDATE)
this.before(['CREATE', 'UPDATE'], 'Orders', (req) => {
  const { orderNo, grossAmount } = req.data;
  if (orderNo !== undefined && !orderNo?.trim())
    req.error(400, 'ORDERNO_REQUIRED', 'orderNo');
  if (grossAmount !== undefined && grossAmount < 0)
    req.error(400, 'AMOUNT_NEGATIVE', 'grossAmount');
});

// Guard: prevent direct status edits — state machine only via actions
this.before('UPDATE', 'Orders', (req) => {
  if ('status' in req.data)
    req.error(400, 'STATUS_DIRECT_EDIT_FORBIDDEN', 'status');
});
```

### After — enrichment patterns (set-based only)

```javascript
// Compute criticality — never per-row query
this.after('READ', 'Orders', (data) => {
  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    if (row?.status !== undefined)
      row.statusCriticality = toCriticality(row.status);
  }
});

// Mask sensitive fields for non-admin users
this.after('READ', 'Orders', (data, req) => {
  if (!req.user.is('Admin')) {
    const rows = Array.isArray(data) ? data : [data];
    rows.forEach(r => { delete r.internalNotes; delete r.supplierMargin; });
  }
});
```

---

## 5. Anti-patterns — code smell catalogue

### CRITICAL

```javascript
// ❌ CRITICAL — N+1: per-row DB query in after READ
this.after('READ', 'Orders', async (rows) => {
  for (const o of rows) {
    o.details = await SELECT.from('Details').where({ order_ID: o.ID }); // N queries
  }
});

// ❌ CRITICAL — fire-and-forget insert; no error surface
INSERT.into(AuditLog).entries({ ... }); // missing await

// ❌ CRITICAL — cds.transaction() without req breaks request context
const tx = cds.transaction(); // no req argument — fix: cds.transaction(req)
```

### WARNING

```javascript
// ❌ WARNING — business logic inline instead of extracted to srv/lib/
cds.service.impl(function() {
  this.on('submit', 'POs', async (req) => {
    // 80 lines of logic here — extract to _submit() or lib/
  });
});

// ❌ WARNING — on handler for standard CRUD with no custom logic
this.on('READ', 'Orders', async (req) => {
  return SELECT.from('Orders'); // framework does this — delete the handler
});

// ❌ WARNING — function with side effects (should be an action)
this.on('calculateDiscount', async (req) => {
  await UPDATE('Orders').set({ discount: 0.1 }).where(...); // WRITE in a function!
});

// ❌ WARNING — req.data mutated in after handler (too late)
this.after('CREATE', 'Orders', (data, req) => {
  req.data.status = 'DRAFT'; // already persisted — set defaults in before() instead
});

// ❌ WARNING — status field directly editable (no before guard)
// Anyone with PATCH can set status='APPROVED' without going through the action
// Fix: add before('UPDATE') that rejects 'status' in req.data

// ❌ WARNING — unbound action missing @restrict
service OrdersService {
  action sendReminders(daysOverdue: Integer) returns String; // no @restrict — anyone can call
}
```
