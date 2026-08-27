# CAP Schema Modelling

## Rules

### Structure
1. ALL entities go in `db/schema.cds` — never define domain entities in `srv/`
2. Every entity MUST have a primary key — use `cuid` aspect (auto UUID) unless a natural key is required
3. ALWAYS apply `managed` aspect for audit fields (`createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`)
4. Use a `namespace` at the top of every `.cds` file to avoid naming conflicts

### Types & Fields
5. Use `String(length)` with an explicit length for bounded strings — never bare `String` for key fields
6. Use `Decimal(precision, scale)` for monetary values — never `Double` or `Float`
7. Use `Date`, `Time`, `DateTime`, `Timestamp` from CDS — never raw strings for date/time fields
8. Define enums as CDS `type` with `enum` — never hardcode magic strings in entities

### Associations & Compositions
9. `Association to` = loose reference (no cascade) — use for cross-aggregate references
10. `Composition of many` = owned children (cascade delete) — use for line items, addresses, attachments
11. Always name the back-link in compositions: `on items.parent = $self`
12. Never create circular compositions

### Aspects & Reuse
13. Extract repeated field groups into `aspect` definitions — never copy-paste fields across entities
14. Use built-in aspects first: `cuid`, `managed`, `temporal` — only create custom aspects for domain concepts

## Correct Pattern

```cds
namespace my.app;
using { cuid, managed } from '@sap/cds/common';

entity Orders : cuid, managed {
  orderNumber : String(20)  @mandatory;
  status      : String(20)  default 'New' @assert.range enum {
    New; Pending; Approved; Rejected;
  };
  totalAmount : Decimal(15, 2);
  currency    : String(3)   default 'EUR';
  items       : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : cuid, managed {
  order       : Association to Orders;
  description : String(255) @mandatory;
  quantity    : Integer     @assert.range: [1, 9999];
  unitPrice   : Decimal(15, 2);
}
```

## Anti-Patterns — Never Do These

```cds
// ❌ No key
entity Bad { name: String; }

// ❌ No managed aspect — no audit trail
entity Bad : cuid { name: String; }

// ❌ Magic string enum — hardcoded in JS
entity Bad : cuid, managed { status: String; }

// ❌ Domain entity in srv/ — define in db/, expose via projection
service MyService { entity Orders { ... } }
```

## CSV Seed Data — UUID Rule (CRITICAL)

When an entity uses the `cuid` aspect, its `ID` field is typed as `cds.UUID`. Any seed data
with non-UUID IDs will cause a `400 - Element "ID" does not contain a valid UUID` error.

### Readable UUID pattern for seed data

```
<entity-prefix>-<entity-number>-0000-0000-<sequence>
```

| Entity | Row | UUID |
|---|---|---|
| Orders (1st entity) | Row 1 | `aaaaaaaa-0001-0000-0000-000000000001` |
| Orders (1st entity) | Row 2 | `aaaaaaaa-0001-0000-0000-000000000002` |
| OrderItems (2nd entity) | Row 1 | `bbbbbbbb-0002-0000-0000-000000000001` |

### FK columns must reference the exact parent UUID

```csv
# db/data/my.app-Orders.csv
ID,orderNumber,status
aaaaaaaa-0001-0000-0000-000000000001,ORD001,New
aaaaaaaa-0001-0000-0000-000000000002,ORD002,Pending

# db/data/my.app-OrderItems.csv
ID,order_ID,description,quantity
bbbbbbbb-0002-0000-0000-000000000001,aaaaaaaa-0001-0000-0000-000000000001,Item A,5
```

### Checklist — after writing every CSV file
- [ ] Every `ID` value matches `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` format
- [ ] Every FK column (e.g. `order_ID`) references a UUID that exists in the parent CSV
- [ ] No short IDs (`01`, `ord-01`, `item-01`) anywhere in any CSV

## Error Handling

| Error | Fix |
|---|---|
| `No model found` | Run from CAP project root; run `npm install` if missing |
| `Duplicate entity name` | Check namespace; use `validate_namespace` before creating |
| `Association target not found` | Ensure target entity is in same model or imported via `using` |
| `400 - Element "ID" does not contain a valid UUID` | Replace all ID values in CSV files with UUID-format strings |
