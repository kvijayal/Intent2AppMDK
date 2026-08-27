# CAP Remote Services and Transaction Patterns

---

## 1. cds.transaction(req) — correct multi-write pattern

Use `cds.transaction(req)` whenever a handler makes more than one DB write that must be atomic.
Passing `req` binds the transaction to the current request context (user, tenant, correlation ID).

```javascript
this.on('approve', 'Orders', async (req) => {
  const tx = cds.transaction(req);              // binds to current request
  const key = req.params[req.params.length - 1];

  const order = await tx.run(SELECT.one.from('Orders').where(key));
  if (!order) return req.error(404, 'ORDER_NOT_FOUND');
  if (order.status !== 'SUBMITTED') return req.error(409, 'INVALID_TRANSITION');

  await tx.run(UPDATE('Orders').set({ status: 'APPROVED' }).where(key));
  await tx.run(INSERT.into('AuditLog').entries({
    entityKey: order.ID, fromStatus: order.status, toStatus: 'APPROVED',
    changedAt: new Date().toISOString(), changedBy: req.user?.id
  }));

  return tx.run(SELECT.one.from('Orders').where(key));
});
```

---

## 2. cds.transaction() without req — CRITICAL

```javascript
// ❌ CRITICAL — new transaction with no request context; breaks tenant isolation
const tx = cds.transaction();  // no req!
await tx.run(UPDATE('Orders').set({ status: 'APPROVED' }).where(key));

// ✅ Fix: always pass req
const tx = cds.transaction(req);
```

---

## 3. cds.run() vs tx.run()

| Use | When |
|---|---|
| `await SELECT.from(...)` | Single read — CAP wraps it automatically |
| `await cds.run(SELECT.from(...))` | Explicit single CDS-managed operation |
| `const tx = cds.transaction(req); await tx.run(...)` | **Multiple writes that must be atomic** |

Never mix `cds.run()` and `tx.run()` in the same handler — pick one pattern.

---

## 4. cds.connect.to() — singleton pattern

`cds.connect.to()` establishes a service connection. It must be called **once per service**,
not once per request. Calling it inside a handler is a per-request connection-pool leak.

### CRITICAL: called inside handler

```javascript
// ❌ CRITICAL — new connection attempt on every request
this.on('sync', 'Orders', async (req) => {
  const externalSvc = await cds.connect.to('ExternalOrdersAPI'); // per request!
  const result = await externalSvc.run(SELECT.from('Orders'));
  return result;
});
```

### Correct: singleton in class init

```javascript
module.exports = class OrdersService extends cds.ApplicationService {
  async init() {
    this.externalSvc = await cds.connect.to('ExternalOrdersAPI'); // once at startup
    this.on('sync', 'Orders', (req) => this._sync(req));
    await super.init();
  }

  async _sync(req) {
    // propagate req so user identity and tenant travel with the call
    const result = await this.externalSvc.tx(req).run(SELECT.from('Orders'));
    return result;
  }
};
```

### Correct: singleton in cds.service.impl (module-level)

```javascript
let externalSvc; // module-level singleton

cds.service.impl(async function() {
  externalSvc = await cds.connect.to('ExternalOrdersAPI'); // runs once per process

  this.on('sync', 'Orders', async (req) => {
    const result = await externalSvc.tx(req).run(SELECT.from('Orders'));
    return result;
  });
});
```

---

## 5. req propagation for external service calls — WARNING

Calling an external service without `.tx(req)` drops the current user identity, tenant, and
correlation headers. The backend sees a technical user, not the real caller.

```javascript
// ❌ WARNING — request context lost; backend sees no user identity
const result = await this.externalSvc.run(SELECT.from('ExternalOrders'));

// ✅ Fix: propagate req
const result = await this.externalSvc.tx(req).run(SELECT.from('ExternalOrders'));
```

---

## 6. Null-check on remote service results — WARNING

OData remote services return `null` (not `[]`) for empty result sets from some adapters.

```javascript
// ❌ WARNING — crashes if remote returns null
const orders = await this.externalSvc.tx(req).run(SELECT.from('Orders'));
return orders.map(o => o.ID); // TypeError: Cannot read properties of null

// ✅ Fix:
const orders = await this.externalSvc.tx(req).run(SELECT.from('Orders')) ?? [];
return orders.map(o => o.ID);
```

---

## Grep commands for detection

```bash
# cds.connect.to() inside handler functions (should be at module/class init level)
grep -n "cds\.connect\.to" srv/*.js

# cds.transaction() without req argument
grep -n "cds\.transaction()" srv/*.js | grep -v "cds\.transaction(req"

# External service calls without .tx(req) propagation
grep -n "\.\(run\|send\|read\|create\|update\|delete\)(" srv/*.js | grep -v "\.tx(req)"

# tx.run() without await
grep -n "tx\.run(" srv/*.js | grep -v "await"
```
