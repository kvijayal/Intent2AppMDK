# CAP Async/Await Patterns

Async mistakes in CAP handlers cause silent failures, unhandled rejections, and data corruption.
There is no runtime warning — the service responds 200 while the DB operation was never committed.

---

## Rules

**Flag as CRITICAL:**
- DB operation called without `await` — fire-and-forget; response sent before operation completes.
- `async` function mixes `.then()` + `.catch()` chaining with `async/await` in the same body — ambiguous error handling.

**Flag as WARNING:**
- Multiple independent DB reads in the same handler called sequentially — combine with `Promise.all`.
- Error caught but not surfaced — empty `.catch(() => {})` or bare `try {} catch {}` with no `req.error`.
- Handler declared `async` but never uses `await` — the `async` is superfluous.

---

## Correct: sequential awaits when order matters

```javascript
this.on('approve', 'Orders', async (req) => {
  const tx = cds.transaction(req);
  const key = req.params[req.params.length - 1];

  const order = await tx.run(SELECT.one.from('Orders').where(key)); // must exist first
  if (!order) return req.error(404, 'ORDER_NOT_FOUND');

  await tx.run(UPDATE('Orders').set({ status: 'APPROVED' }).where(key)); // then update
  await tx.run(INSERT.into('AuditLog').entries({ ... }));               // then log

  return tx.run(SELECT.one.from('Orders').where(key));
});
```

---

## Correct: parallel awaits when order does not matter

```javascript
this.on('getContext', async (req) => {
  // These two reads are independent — run in parallel
  const [order, supplier] = await Promise.all([
    SELECT.one.from('Orders').where(req.params[0]),
    SELECT.one.from('Suppliers').where({ ID: req.data.supplierID })
  ]);

  if (!order) return req.error(404, 'ORDER_NOT_FOUND');
  return { order, supplier };
});
```

---

## CRITICAL: missing await on DB operation

```javascript
// ❌ CRITICAL — INSERT runs fire-and-forget; response sent before it completes
this.on('submit', 'Orders', async (req) => {
  INSERT.into('AuditLog').entries({ action: 'submit', at: new Date() }); // no await!
  return req.data;
});

// ✅ Fix:
  await INSERT.into('AuditLog').entries({ action: 'submit', at: new Date() });
```

---

## CRITICAL: mixing .then() and async/await

```javascript
// ❌ CRITICAL — mixed styles; error handling is ambiguous
this.on('approve', 'Orders', async (req) => {
  return SELECT.one.from('Orders')
    .where(req.params[0])
    .then(async (order) => {
      await UPDATE('Orders').set({ status: 'APPROVED' }).where(req.params[0]);
      return order;
    })
    .catch((err) => req.error(500, err.message));
});

// ✅ Fix: use async/await throughout
this.on('approve', 'Orders', async (req) => {
  try {
    const order = await SELECT.one.from('Orders').where(req.params[0]);
    if (!order) return req.error(404, 'ORDER_NOT_FOUND');
    await UPDATE('Orders').set({ status: 'APPROVED' }).where(req.params[0]);
    return order;
  } catch (err) {
    return req.error(500, err.message);
  }
});
```

---

## WARNING: swallowed errors

```javascript
// ❌ WARNING — error caught but caller gets 200 on failure
this.on('approve', 'Orders', async (req) => {
  try {
    await UPDATE('Orders').set({ status: 'APPROVED' }).where(req.params[0]);
  } catch (e) {
    // silent — nothing here
  }
  return 'done';
});

// ✅ Fix:
  } catch (e) {
    return req.error(500, 'APPROVAL_FAILED', e.message);
  }
```

---

## WARNING: sequential reads that could be parallel

```javascript
// ❌ WARNING — 2 independent queries running serially
const order = await SELECT.one.from('Orders').where(key);
const config = await SELECT.one.from('Config').where({ key: 'approvalThreshold' });

// ✅ Fix: run in parallel
const [order, config] = await Promise.all([
  SELECT.one.from('Orders').where(key),
  SELECT.one.from('Config').where({ key: 'approvalThreshold' })
]);
```

---

## WARNING: async handler that never awaits

```javascript
// ❌ WARNING — async keyword superfluous; misleads readers
this.before('READ', 'Orders', async (req) => {
  if (!req.user) req.error(401, 'NOT_AUTHENTICATED'); // no await anywhere
});

// ✅ Fix: remove async
this.before('READ', 'Orders', (req) => {
  if (!req.user) req.error(401, 'NOT_AUTHENTICATED');
});
```

---

## Grep commands for detection

```bash
# Handler functions without async that call DB operations (potential missing await context)
grep -n "this\.\(on\|before\|after\)" srv/*.js | grep -v "async"

# DB calls not preceded by await on the same line (fire-and-forget candidates)
grep -n "\(INSERT\|UPDATE\|DELETE\|SELECT\)\..*(" srv/*.js | grep -v "await"

# .then() chaining inside handler files (mixing styles)
grep -n "\.then(" srv/*.js

# tx.run() without await
grep -n "tx\.run(" srv/*.js | grep -v "await"
```
