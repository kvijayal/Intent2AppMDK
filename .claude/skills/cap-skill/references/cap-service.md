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

// ❌ Code-list / value-help entity defined OUTSIDE the service block
//    It compiles fine but is never mounted as an OData endpoint — value-help
//    dropdowns silently 404 at runtime with no visible error in the UI.
service OrdersService @(requires: 'authenticated-user') {
  entity Orders as projection on db.Orders;
}
@readonly entity StatusValues as projection on db.StatusValues;  // ← WRONG: outside block

// ✅ Correct — all value-help entities inside the service block
service OrdersService @(requires: 'authenticated-user') {
  entity Orders      as projection on db.Orders;
  @readonly entity StatusValues as projection on db.StatusValues;  // ← inside block
}
```

**Rule: every entity referenced by a `@Common.ValueList CollectionPath` annotation MUST be declared inside the `service { }` block.** Top-level entity projections are valid CDS syntax for reuse/extension, but they are never exposed as OData entity sets. The Fiori Elements value-help machinery calls `GET /odata/v4/<service>/<CollectionPath>` — if that entity is not inside the service, the response is `404 Invalid resource path` and the dropdown stays empty with no console error visible to the user.

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

## Lookup / Value Help Function

Any field whose valid values come from a finite list (plant, cost centre, material type, etc.)
**must** be backed by a CAP function that returns that list — even if the data is mocked locally.
Without this function the UI SelectDialog has nothing to bind to, and the value help is not built.

### CDS — type + function definition

```cds
// Type for one result row
type PlantResult {
  plant       : String(4);
  description : String(50);
}

service MyService @(requires: 'authenticated-user') {
  // ...entities...

  // Value-help lookup — no @restrict needed (read-only, authenticated-user is enough)
  function getPlants(companyCode: String(4)) returns array of PlantResult;
}
```

### Handler — `srv/service.js`

```javascript
srv.on('getPlants', (req) => {
  // Replace with a real SELECT / remote call in production
  const MOCK_PLANTS = [
    { plant: '1000', description: 'Plant Hamburg' },
    { plant: '1001', description: 'Plant Berlin'  },
    { plant: '1100', description: 'Plant Munich'  },
    { plant: '2000', description: 'Plant Walldorf' },
  ];
  cds.log('srv').info('getPlants', { companyCode: req.data.companyCode });
  return MOCK_PLANTS;
});
```

### OData call from the UI

```
GET /odata/v4/my-service/getPlants(companyCode='1000')
Accept: application/json
```

Response shape: `{ "value": [ { "plant": "1000", "description": "Plant Hamburg" }, ... ] }`

### Coverage gate

A value help function is **required** whenever:
- the Requirement Register contains a MultiInput / dropdown / search-help on a code field, OR
- the UI view has `showValueHelp="true"` on any input.

Verify the function exists in the CDS service, the handler is registered, and the UI controller
calls it (see `fiori-freestyle/references/value-help-select-dialog.md` for the full UI pattern).

## Error Handling

| Error | Fix |
|---|---|
| `401 Unauthorized` | Add `@(requires: 'authenticated-user')` to service |
| `403 Forbidden` | Check `@restrict` grants include the user's role |
| `Draft not working` | Ensure `@odata.draft.enabled` is on the service projection, not the db entity |
| `Action not found` | Verify action is in the `actions { }` block of the entity projection |
