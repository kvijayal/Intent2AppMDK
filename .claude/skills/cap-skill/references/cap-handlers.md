# CAP Service Handlers

## Rules

### Handler Structure
1. Always use `cds.service.impl(async function(srv) { ... })` as the module export
2. Register handlers inside the `impl` function — never at module level
3. Group handlers by entity, in order: `before` → `on` → `after`
4. Keep handler files small — extract complex logic to `srv/lib/` utility modules

### Error Handling
5. Use `req.error(httpCode, message)` for user-facing validation errors — never `throw new Error()`
6. Use `req.reject(httpCode, message)` to abort immediately (same as error but stops processing)
7. Use `req.warn(message)` for non-blocking warnings
8. Wrap `await` calls in `try/catch` — unhandled rejections crash the service

### Logging
9. Use `cds.log('my-module')` for structured logging — never `console.log` in production
10. Log at appropriate levels: `.debug()` for tracing, `.info()` for key events, `.error()` for failures

### Queries (cds.ql)
11. Use `SELECT.from(Entity).where({...})` — never raw SQL strings
12. Use `SELECT.one.from(Entity).where({...})` when expecting a single result
13. Always `await` queries — forgetting `await` returns a query object, not data
14. Use `req.data` to access the request payload in `before`/`on` handlers
15. Use `req.query` to access the parsed OData query in `on READ` handlers

### Authorization in Handlers
16. Use `req.user.is('RoleName')` for conditional logic — never check email/ID for access control
17. Declarative `@restrict` is the primary enforcement — handlers add logic `@restrict` cannot express
18. Always re-check authorization in handlers that perform privileged operations

### Performance
19. Never loop single-row inserts — use `INSERT.into(Entity).entries([...])` for bulk
20. Use `SELECT.columns(...)` to project only needed fields — never `SELECT *` in production
21. Use `req.query.SELECT.limit` awareness — always support pagination

## Correct Pattern

```javascript
const cds = require('@sap/cds');
const log = cds.log('orders-service');

module.exports = cds.service.impl(async function (srv) {

  // Validation before CREATE
  srv.before('CREATE', 'Orders', (req) => {
    if (!req.data.quantity || req.data.quantity <= 0) {
      req.error(400, 'Quantity must be greater than zero.');
    }
  });

  // Enrich after READ
  srv.after('READ', 'Orders', (results) => {
    results.forEach(order => {
      order.criticality = order.status === 'Approved' ? 3
                        : order.status === 'Pending'  ? 2
                        : order.status === 'Rejected' ? 1 : 0;
    });
  });

  // Role-based field filtering
  srv.after('READ', 'Orders', (results, req) => {
    if (!req.user.is('Admin')) {
      results.forEach(o => { delete o.internalNotes; });
    }
  });

  // Bound action implementation
  srv.on('approve', 'Orders', async (req) => {
    if (!req.user.is('Approver') && !req.user.is('Admin')) {
      return req.error(403, 'Approval requires Approver or Admin role.');
    }
    const [order] = await SELECT.from('Orders').where({ ID: req.params[0].ID });
    if (!order) return req.error(404, 'Order not found.');
    await UPDATE('Orders').set({ status: 'Approved' }).where({ ID: req.params[0].ID });
    log.info('Order approved', { ID: req.params[0].ID, by: req.user.id });
    return SELECT.one.from('Orders').where({ ID: req.params[0].ID });
  });

});
```

## Anti-Patterns — Never Do These

```javascript
// ❌ Raw throw — no user-friendly message
srv.before('CREATE', 'Orders', (req) => {
  if (!req.data.name) throw new Error('Name required'); // use req.error()
});

// ❌ console.log in production
console.log('Order created:', req.data); // use cds.log()

// ❌ Missing await on query
const order = SELECT.one.from('Orders').where({ ID: id }); // returns query builder, not data

// ❌ Checking user identity instead of role
if (req.user.id === 'admin@company.com') { ... } // use req.user.is('Admin')

// ❌ Raw SQL — injection risk
const result = await cds.run(`SELECT * FROM Orders WHERE status = '${status}'`);
```

## Error Handling Reference

| Method | HTTP Code | Use When |
|---|---|---|
| `req.error(400, msg)` | 400 | Invalid input / validation failure |
| `req.error(403, msg)` | 403 | Authorization denied |
| `req.error(404, msg)` | 404 | Record not found |
| `req.error(409, msg)` | 409 | Conflict (duplicate, state violation) |
| `req.reject(422, msg)` | 422 | Unprocessable — abort immediately |
