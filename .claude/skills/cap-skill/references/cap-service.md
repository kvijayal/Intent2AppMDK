# CAP Service Definition

## Rules

### Service Structure
1. One service per business domain — never put unrelated entities in one service
2. Service file naming: `srv/<domain>-service.cds` + `srv/<domain>-service.js`
3. ALWAYS annotate the service with `@(requires: 'authenticated-user')` — no anonymous access
4. Use `as projection on db.<Entity>` — never redefine entity structure inside the service

### Access Control — MANDATORY
5. EVERY exposed entity MUST have a `@restrict` annotation — no exceptions
6. Omitting `@restrict` = open access to all authenticated users — this is a security bug
7. Use additive roles: `['Viewer','Editor','Admin']` not just `Admin` for read
8. Restrict to minimum required: start with least privilege, open up as needed

### Actions & Functions
9. **Bound action** = operates on a specific entity instance → `entity Orders actions { action approve(); }`
10. **Unbound action** = service-level operation → `action sendBulkNotification(...)`
11. **Function** = read-only, no side effects → `function getStatus(...) returns String`
12. Actions use `POST`, Functions use `GET` in OData
13. Annotate `@Core.OperationAvailable` to control when action buttons are enabled in Fiori

### Draft Support
14. Add `@odata.draft.enabled` for any entity that requires create/edit/save flows in Fiori Elements
15. Never implement custom draft logic — CAP handles it automatically
16. Draft entities automatically get `IsActiveEntity`, `HasDraftEntity`, `DraftAdministrativeData`

## Correct Pattern

```cds
using { my.app as db } from '../db/schema';

service OrdersService @(requires: 'authenticated-user') {

  @odata.draft.enabled
  entity Orders @(restrict: [
    { grant: 'READ',              to: ['Viewer', 'Editor', 'Approver', 'Admin'] },
    { grant: ['CREATE','UPDATE'], to: ['Editor', 'Admin'] },
    { grant: 'DELETE',            to: 'Admin' }
  ]) as projection on db.Orders
    actions {
      @(Core.OperationAvailable: { $edmJson: { $Ne: [{ $Path: 'status' }, 'Approved'] } })
      action approve() returns Orders;
    };

  @readonly
  entity OrderItems @(restrict: [
    { grant: 'READ', to: ['Viewer', 'Editor', 'Approver', 'Admin'] }
  ]) as projection on db.OrderItems;
}
```

## Anti-Patterns — Never Do These

```cds
// ❌ No authentication requirement
service OrdersService { entity Orders as projection on db.Orders; }

// ❌ Entity without @restrict — open to all authenticated users
service OrdersService @(requires: 'authenticated-user') {
  entity Orders as projection on db.Orders;  // missing @restrict!
}

// ❌ Redefining entity structure in service — define in db/, use projection
service OrdersService {
  entity Orders { key ID: UUID; title: String; }
}
```

## Actions Pattern

```cds
// Bound action — operates on a specific instance
service OrdersService @(requires: 'authenticated-user') {
  entity Orders as projection on db.Orders
    actions {
      // Available only when status is not 'Approved'
      @(Core.OperationAvailable: { $edmJson: { $Ne: [{ $Path: 'status' }, 'Approved'] } })
      action approve()  returns Orders;
      action reject(reason: String) returns Orders;
    };

  // Unbound action — service-level
  action sendReminders(daysOverdue: Integer) returns String;

  // Function — read-only, no side effects
  function getOrderSummary(year: Integer) returns array of {
    month: Integer; count: Integer; total: Decimal;
  };
}
```

## Error Handling

| Error | Fix |
|---|---|
| `401 Unauthorized` | Add `@(requires: 'authenticated-user')` to service |
| `403 Forbidden` | Check `@restrict` grants include the user's role |
| `Draft not working` | Ensure `@odata.draft.enabled` is on the service projection, not the db entity |
| `Action not found` | Verify action is in the `actions { }` block of the entity projection |
