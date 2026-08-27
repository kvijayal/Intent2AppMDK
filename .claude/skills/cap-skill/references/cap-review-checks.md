*Part of the cap-skill index. Load this file during code review when `CAP_PRESENT`.*

# CAP Review Checks — Correctness & Authorization

Condensed review checklist for Categories 1 and 2. For detailed fix patterns and code examples,
load `cap-modeling.md` (bound actions, N+1), `cap-handler-quality.md` (phases, size), `cap-async.md`
(await, transactions), `cap-remote.md` (remote services).

---

## Category 1 — CDS/CAP Correctness

### Projections and associations
- Every `as projection on` exposes both sides of any `Association` it uses — broken projection = 404 on expand.
- No bare `Association to` in a service entity without a matching `$expand` target in the service.

### Handler registration
- All handlers registered **inside** `cds.service.impl(async function(srv) { ... })` — never at module scope.
- No `throw new Error()` in handlers — use `req.error(code, msg)` or `req.reject(code, msg)` so CAP handles HTTP status and OData error body correctly.
- Every `await` in an `on` handler wrapped in `try/catch` — unhandled rejections in `on` crash the service process.
- No `req.user.id` or `req.user.email` for access control — use `req.user.is('RoleName')`.

### Schema / data correctness
- No `Double` or `Float` for monetary fields — `Decimal(precision, scale)` only.
- No bare `String` (no length) on key or mandatory fields — use `String(n)`.
- Status/enum fields use a named CDS type with `@assert.range` — prevents out-of-enum writes silently passing through. **Placement rule (commonly violated):** the enum type definition MUST live in `db/schema.cds` as a top-level `type`, then the entity field references it. It is **invalid CDS syntax** to put an inline `enum { }` block inside an `annotate ... with { }` block — the IDE reports `Mismatched 'enum'` and the constraint is silently ignored. Correct pattern:
  ```cds
  // db/schema.cds — correct: named type
  type OrderStatus : String(20) enum { New; Pending; Approved; Rejected; }
  entity Orders { status : OrderStatus @assert.range; }

  // annotations.cds — WRONG: enum in annotate block — parse error
  // annotate Orders with { status @assert.range enum { New; } }  ← NEVER DO THIS
  ```
- Required fields carry `@mandatory` — triggers Fiori asterisk and CAP server-side validation.
- `namespace` declaration at the top of every `.cds` file.
- FK columns in child CSV files reference UUIDs that exist in the parent CSV (`db/data/`).

### Entity design
- **`@odata.etag`** on every user-editable entity:
  ```cds
  modifiedAt @odata.etag @cds.on.update: $now;
  ```
  Missing = silent lost-update when two users save concurrently. **HARD CONSTRAINT — flag as CRITICAL.**
- Every monetary `Decimal` field paired with a `Currency` association annotated `@Measures.ISOCurrency`:
  ```cds
  amount   : Decimal(15,2);
  currency : Association to sap.common.Currencies;
  annotate MyEntity with { amount @Measures.ISOCurrency: currency_code; }
  ```

### Computed/criticality fields
- Criticality and other computed fields must be plain `Integer` columns recomputed in `after('READ')` — NOT `virtual` fields.
  `virtual` fields are not reliably selected by `autoExpandSelect` in Fiori Elements, causing blank status indicators.

### Bound-action completeness
For every bound action in the service:
- Declared in `service.cds` actions block; surfaced via `UI.DataFieldForAction` — never invoked from controller code.
- `@(Core.OperationAvailable: ...)` set — button hidden when action is not valid for current record state.
- State transition validated against allowed source states → `req.error(409, ...)` on illegal move.
- DB update + audit entry inside one `cds.transaction(req)` — atomic rollback on failure.
- Returns the updated entity with recomputed criticality so the UI reflects the new state immediately.

---

## Category 2 — Authorization Completeness

### Service-level
- `@requires: 'authenticated-user'` (or a specific role) on every service definition.

### Entity-level
- `@restrict` on every writable entity — omission = any authenticated user can write. **CRITICAL.**
- `@restrict` verbs (`READ`, `CREATE`, `UPDATE`, `DELETE`) match the grant matrix in `Application-Architecture.md`.
- A `before <VERB>` handler with no matching `@restrict` grant = dead code (WARNING — the before never fires).

### Unbound actions
- Every unbound action must carry its own explicit `@restrict` — entity-level restrictions do not propagate to unbound actions. Missing = open to all authenticated users (CRITICAL).

### xs-security.json ↔ CDS consistency
- Role names in `@restrict` annotations must **exactly** match (case-sensitive) the `name` field of role-templates in `xs-security.json`.
- Mock user `roles` array in `package.json [development]` must reference the same role names.
  Mismatch = 403 on `cds watch` for the affected persona.

### Development auth profile
- `package.json` must have `cds.requires.auth.[development]` with `kind: "mocked"` and one user per role:
  ```json
  "auth": {
    "kind": "xsuaa",
    "[development]": {
      "kind": "mocked",
      "users": {
        "viewer": { "password": "pass", "roles": ["Viewer"] },
        "editor": { "password": "pass", "roles": ["Editor"] },
        "admin":  { "password": "pass", "roles": ["Admin"]  }
      }
    }
  }
  ```
  Absent = 401 on every `cds watch` call. **WARNING.**

### Per-user data isolation
- `where: '$user'` present in `@restrict` wherever the design requires records visible only to their creator/assignee.

### Sensitive field stripping
- Entities exposing fields restricted to higher-privilege roles must strip those fields in `after('READ')` for lower-privilege callers:
  ```javascript
  srv.after('READ', 'Orders', (results, req) => {
    if (!req.user.is('Admin')) {
      results.forEach(o => { delete o.internalCost; delete o.marginNotes; });
    }
  });
  ```
  Missing stripping = data exposure to lower-privilege users. **CRITICAL.**
