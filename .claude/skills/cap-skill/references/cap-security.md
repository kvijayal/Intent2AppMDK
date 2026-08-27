# CAP Authorization & Security

Auth is a HARD CONSTRAINT: **every service has `@requires`; every writable entity has `@restrict`.**
Never weaken auth without explicit instruction. Canonical example:
`reference-apps/cap-fullstack-listreport/` (`srv/service.cds` restrictions + `xs-security.json` +
mocked `admin`/`editor`/`viewer`).

---

## 1. `@requires` / `@restrict` — Complete Example

```cds
using { sales } from '../db/schema';

// Service-level gate: nobody unauthenticated gets in.
service SalesOrderService @(path: '/odata/v4/salesorder', requires: 'authenticated-user') {

  // Writable entity: explicit grants per operation.
  entity SalesOrders @(restrict: [
    { grant: 'READ',                to: ['Viewer', 'Editor', 'Admin'] },
    { grant: ['CREATE', 'UPDATE'],  to: ['Editor', 'Admin'] },
    { grant: 'DELETE',              to: ['Admin'] },
    // Bound actions can also be granted by name:
    { grant: ['submit'],            to: ['Editor', 'Admin'] },
    { grant: ['approve', 'reject'], to: ['Admin'] }
  ]) as projection on sales.SalesOrders actions {
    action submit()  returns SalesOrders;
    action approve() returns SalesOrders;
    action reject(reason : String) returns SalesOrders;
  };

  entity SalesOrderItems @(restrict: [
    { grant: 'READ',                          to: ['Viewer', 'Editor', 'Admin'] },
    { grant: ['CREATE', 'UPDATE', 'DELETE'],  to: ['Editor', 'Admin'] }
  ]) as projection on sales.SalesOrderItems;

  // Read-only reference data: READ for everyone authenticated; no writes.
  @readonly entity SalesAreas as projection on sales.SalesAreas;
}
```

Rules this encodes:

- **Service** → `requires: 'authenticated-user'`. No anonymous access.
- **Every writable entity** → `@restrict` with explicit grants. Read-only data uses `@readonly`.
- **Least privilege:** Viewer reads; Editor reads + creates/updates; Admin everything incl. delete and approve.
- **Instance-based restriction** (optional) adds a `where`: `{ grant: 'READ', to: 'Editor', where: 'createdBy = $user' }`.

---

## 2. `xs-security.json` — Scopes → Role-Templates → Role-Collections

```json
{
  "xsappname": "salesorder",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.Viewer", "description": "Read sales orders" },
    { "name": "$XSAPPNAME.Editor", "description": "Create/update sales orders" },
    { "name": "$XSAPPNAME.Admin",  "description": "Full control incl. approve/delete" }
  ],
  "attributes": [],
  "role-templates": [
    {
      "name": "Viewer",
      "description": "Sales order viewer",
      "scope-references": ["$XSAPPNAME.Viewer"]
    },
    {
      "name": "Editor",
      "description": "Sales order editor",
      "scope-references": ["$XSAPPNAME.Viewer", "$XSAPPNAME.Editor"]
    },
    {
      "name": "Admin",
      "description": "Sales order admin",
      "scope-references": ["$XSAPPNAME.Viewer", "$XSAPPNAME.Editor", "$XSAPPNAME.Admin"]
    }
  ],
  "role-collections": [
    { "name": "SalesOrder_Viewer", "role-template-references": ["$XSAPPNAME.Viewer"] },
    { "name": "SalesOrder_Editor", "role-template-references": ["$XSAPPNAME.Editor"] },
    { "name": "SalesOrder_Admin",  "role-template-references": ["$XSAPPNAME.Admin"] }
  ]
}
```

How the layers connect:

- **Scope** = the atomic permission (`$XSAPPNAME.Editor`). The `$XSAPPNAME` prefix resolves to `xsappname`.
- **Role-template** = a named bundle of scopes. Higher roles include lower-role scopes (additive).
- **Role-collection** = what an admin assigns to a user/group in the BTP cockpit.

Grant matrix:

| Operation | Viewer | Editor | Admin |
| --- | --- | --- | --- |
| READ | ✅ | ✅ | ✅ |
| CREATE / UPDATE | ✗ | ✅ | ✅ |
| DELETE | ✗ | ✗ | ✅ |
| submit | ✗ | ✅ | ✅ |
| approve / reject | ✗ | ✗ | ✅ |

---

## 3. Dev (mocked users) vs Prod (xsuaa)

CAP swaps the auth strategy by profile — same `@requires`/`@restrict`, different identity source.

```json
{
  "cds": {
    "requires": {
      "auth": {
        "[development]": {
          "kind": "mocked",
          "users": {
            "alice": { "roles": ["Viewer"] },
            "bob":   { "roles": ["Editor"] },
            "carol": { "roles": ["Admin"] }
          }
        },
        "[production]": { "kind": "xsuaa" }
      }
    }
  }
}
```

- Run `cds watch` → browse with basic auth (`bob`/any password) to test Editor grants.
- `alice` confirms Viewer can't write (expect 403).
- The roles mirror the `xs-security.json` role-templates so dev behaviour matches prod.

---

## 4. Role-Based Logic in Handlers

Use `req.user.is()` for logic that `@restrict` cannot express declaratively:

```javascript
// Only Admins can change the status field
srv.before('UPDATE', 'Orders', (req) => {
  if (!req.user.is('Admin') && req.data.status !== undefined) {
    return req.error(403, 'Only Admins can change the order status.');
  }
});

// Strip sensitive fields from non-admin users
srv.after('READ', 'Orders', (results, req) => {
  if (!req.user.is('Admin')) {
    results.forEach(o => { delete o.internalNotes; delete o.costPrice; });
  }
});
```

---

## 5. No-Auth / Open Service (Explicit Override Only)

Use **only** when the developer explicitly selected "No authentication". Valid for read-only display
apps with no sensitive data, internal prototypes, or apps where auth is enforced upstream.

```cds
// No @requires = open service; mark @readonly so CAP blocks accidental writes
@path: '/odata/v4/locationmaster'
service LocationMasterService {
  @readonly
  entity FactoryLocationMasters as projection on db.FactoryLocationMasters;
}
```

```json
"cds": {
  "requires": {
    "auth": {
      "[development]": { "kind": "dummy" }
    }
  }
}
```

Rules for no-auth:

- Never use for services exposing PII, financial data, or anything classified above "internal".
- Do NOT add `@(requires: unrestricted)` — it is redundant and confusing.

---

## 6. HTTP Test Files — Role Testing

```http
### Read as Viewer
GET http://localhost:4004/odata/v4/salesorder/SalesOrders
Authorization: Basic alice pass

### Create as Editor
POST http://localhost:4004/odata/v4/salesorder/SalesOrders
Authorization: Basic bob pass
Content-Type: application/json

{ "orderNo": "SO-001", "customer": "Acme Corp", "grossAmount": 1000 }

### Delete attempt as Viewer — expect 403
DELETE http://localhost:4004/odata/v4/salesorder/SalesOrders(aaaaaaaa-0001-0000-0000-000000000001)
Authorization: Basic alice pass
```

---

## Security Checklist

- [ ] Service annotated with `@(requires: 'authenticated-user')`
- [ ] Every entity has `@restrict` — no entity left unannotated
- [ ] Grant matrix reviewed: correct roles per verb
- [ ] Bound action grants added by action name in `@restrict`
- [ ] Role names identical in CDS, `xs-security.json`, and mock users
- [ ] All roles tested — including negative 403 cases for lower-privilege users
- [ ] Sensitive fields stripped in `after('READ')` for non-admin roles
- [ ] No user IDs / emails hardcoded in access control logic

---

## RBAC Rules Summary

- ✅ `@restrict` is the primary enforcement layer — handlers are secondary.
- ✅ `req.user.is('RoleName')` for conditional logic — never check `req.user.id` or email.
- ✅ Follow least privilege — start restrictive, open up as needed.
- ✅ Test every role persona, including negative (403) cases.
- ✅ After changing `xs-security.json`, run `cf update-service` (not recreate) to preserve role assignments.
- ❌ Never leave entities without `@restrict` — missing annotation = open to all authenticated users.
- ❌ Never hardcode user IDs or emails in access control logic.
- ❌ Never expose sensitive fields to lower-privilege roles.
