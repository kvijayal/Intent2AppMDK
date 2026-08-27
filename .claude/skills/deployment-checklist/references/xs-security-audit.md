*Part of the deployment-checklist skill. Load when auditing an existing `xs-security.json` before deploy.*

# xs-security.json Audit Rules

These are **audit rules** — checks against an existing file.
For the xs-security.json structure and template, see `cap-skill` → `cap-security.md` §2.

**Guard: Paths A, B, and D. Skip entirely for Path C (ABAP Frontend — no XSUAA needed).**

---

## When `xs-security.json` is absent

Record CRITICAL: "`xs-security.json` is absent — XSUAA cannot be provisioned."

Include the expected file content as the fix snippet, using the template in `cap-security.md` §2,
substituting `xsappname` with `MTA_ID` and adding one scope + role-template per role found in
`@restrict` annotations in `srv/service.cds`.

---

## When `xs-security.json` exists — field-by-field checks

### `xsappname`
Must match `MTA_ID` exactly (case-sensitive). Mismatch = WARNING.

```bash
node -e "const f=require('./xs-security.json'); console.log(f.xsappname)"
```

A mismatched `xsappname` means the `$XSAPPNAME` prefix in scope names resolves to the wrong value,
causing role-template lookups to fail silently after deploy.

---

### `tenant-mode`
Must be `"dedicated"`. Missing or set to `"shared"` without explicit multi-tenant design = WARNING.

```bash
node -e "const f=require('./xs-security.json'); console.log(f['tenant-mode'])"
```

---

### Scope completeness

Extract expected roles from:
- Path A / D: unique role names from every `to:` value in `@restrict` annotations in `srv/service.cds`
- Path B: the grant matrix in `deliverables/Technical-Design-Document.md`
- Purely `@readonly` service with no `@restrict` roles: empty `scopes` array is correct — do not flag.

For each expected role `{RoleName}`, `scopes` must contain an entry with `"name": "$XSAPPNAME.{RoleName}"`.

```bash
node -e "const f=require('./xs-security.json'); f.scopes.forEach(s=>console.log(s.name))"
```

Missing scope = **CRITICAL** — the role-template that references it will fail XSUAA validation at deploy time.

Fix snippet (add to `scopes` array):
```json
{ "name": "$XSAPPNAME.{RoleName}", "description": "{RoleName} access" }
```

---

### Role-template completeness

For each expected role `{RoleName}`, `role-templates` must contain an entry with `"name": "{RoleName}"`.

```bash
node -e "const f=require('./xs-security.json'); f['role-templates'].forEach(r=>console.log(r.name))"
```

Missing role-template = **CRITICAL** — there is no template for the BTP admin to create a Role Collection from.

---

### Scope-cumulation pattern

More privileged roles must include all scopes of less privileged roles — roles are additive, not flat.

| Pattern | Assessment |
|---|---|
| `Editor` includes `$XSAPPNAME.Viewer` + `$XSAPPNAME.Editor` | ✅ Correct |
| `Admin` includes Viewer + Editor + Admin scopes | ✅ Correct |
| Every role has exactly one scope matching its own name | ⚠ WARNING — flat pattern; a user assigned Editor cannot read |

```bash
node -e "
const f = require('./xs-security.json');
f['role-templates'].forEach(r => {
  console.log(r.name + ' → ' + (r['scope-references'] || []).join(', '));
});"
```

A role-template with only one scope (its own) when other lower-privilege scopes exist = **WARNING**.
Fix: add all lower-privilege scope references to the higher-privilege role-template.
