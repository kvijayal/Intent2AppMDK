*Part of the cap-skill index. Load during code review (Cat 7) or after scaffolding to catch structural issues early.*

# Project Structure Grep Inventory

Run all applicable commands from the project root. Each prints nothing on pass; any output is a finding.

---

## 1. Dead handler files (CAP_PRESENT)

`srv/*.js` files that are not registered as CDS service implementations are dead — they never run.

```bash
for f in srv/*.js; do
  grep -qE "cds\.service\.impl|extends cds\." "$f" || echo "ORPHANED: $f"
done
```

**Pass:** no output. Any printed file = WARNING — either register it with `cds.service.impl` or delete it.

---

## 2. Duplicate service definitions (CAP_PRESENT)

Two services with the same name cause CDS to silently use one and ignore the other.

```bash
grep -rn "^service " srv/*.cds | awk -F: '{print $NF}' | sort | uniq -d
```

**Pass:** no output. Any printed name = CRITICAL — merge or rename the duplicate service.

---

## 3. Fragment files outside `webapp/fragments/` (UI_PRESENT)

XML fragments placed outside the canonical `fragments/` folder break lazy-load resolution and BAS Page Map.

```bash
find app -name "*.fragment.xml" ! -path "*/fragments/*" 2>/dev/null
```

**Pass:** no output. Any printed path = WARNING — move to `webapp/fragments/`.

---

## 4. Duplicate UI control IDs (UI_PRESENT)

Duplicate IDs in the same view or fragment cause runtime errors and unpredictable data binding.

```bash
grep -rn 'id="' app/*/webapp/view app/*/webapp/fragments 2>/dev/null \
  | awk -F'"' '{print $2}' | sort | uniq -d
```

**Pass:** no output. Any printed ID = CRITICAL — IDs must be unique per view scope.

---

## 5. Deprecated API inventory (UI_PRESENT)

Scans for removed/deprecated APIs that will fail on UI5 2.x or generate console warnings.

```bash
grep -rn \
  "sap\.ui\.getCore\|sap\.ui\.commons\|ODataModel\b\|jQuery\.ajax\|\.then(" \
  app/*/webapp 2>/dev/null | grep -v "node_modules"
```

**Pass:** no output. Findings by pattern:

| Pattern | Severity | Fix |
|---|---|---|
| `sap.ui.getCore` | WARNING | Replace with `Core` import from `sap/ui/core/Core` |
| `sap.ui.commons.*` | CRITICAL | Replace with `sap.m.*` equivalent |
| `ODataModel\b` | CRITICAL | Replace with `sap.ui.model.odata.v4.ODataModel` |
| `jQuery.ajax` | CRITICAL | Remove — use `fetch()` or OData model |
| `.then(` | WARNING | Review for mixed async patterns (see `cap-async.md`) |

---

## 6. `package.json` cleanliness (always)

Flags known problem entries that cause non-reproducible builds or version confusion.

```bash
grep -n "legacy-peer-deps\|cds-plugin-ui5" package.json
```

- `--legacy-peer-deps` in any script = WARNING — masks peer dependency conflicts; fix the conflict instead.
- `cds-plugin-ui5` in root `devDependencies` = expected for CAP-embedded Fiori ✅ — its **absence** for a CAP+Fiori project = WARNING (blank page on `cds watch`).

---

## 7. Bootstrap config consistency (UI_PRESENT)

Catches mixed CDN/local UI5 bootstrap configuration that produces a blank page after deploy.

```bash
grep -rn "sap-ui-bootstrap\|framework:" app/*/webapp/index.html app/*/ui5.yaml 2>/dev/null
```

Rules:
- **CDN pattern** (recommended): `index.html` has CDN `src` URL → `ui5.yaml` must have **no** `framework:` block.
- **Local pattern**: `index.html` has relative `src` → `ui5.yaml` must have a full `framework:` block with `name`, `version`, and `libraries`.
- Never mix: CDN `src` + `framework:` block = double-load WARNING; relative `src` + no `framework:` = 404 on bootstrap CRITICAL.
