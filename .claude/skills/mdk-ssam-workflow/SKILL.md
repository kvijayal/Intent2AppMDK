---
name: mdk-ssam-workflow
version: 1.0.0
description: >
  Reference patterns and templates for the SAP Asset Manager (SSAM) workflow in Intent2App.
  Covers generic SSAM project structure (not Equinor-specific), CIM file creation/management,
  Z/custom project scaffolding, standard override patterns, Z naming conventions, and
  post-customization validation checklist. Load when working through the SSAM Upgrade or
  Customize flows triggered from the /intent command. Trigger on: "SAP Asset Manager",
  "SSAM workflow", "SSAM customize", "SSAM upgrade", "CIM file", "Z project", "Z override",
  "standard override", "SSAM standard artifact", "custom MDK project", "SSAM project structure".
source: Intent2App — SAP Asset Manager workflow patterns (generic, not customer-specific)
---

# SAP Asset Manager (SSAM) Workflow Reference

Patterns, templates, and conventions for the SSAM Upgrade and Customize flows.
These are referenced by the `/intent` SSAM Workflow section — do not run this skill standalone.

---

## SSAM project structure (generic)

```
WorkspaceRoot/
  SAPAssetManager/          ← SAP standard project — READ ONLY; never generate or modify files here
    Application.app         ← contains ApplicationVersion
    .project.json           ← contains SdkVersion (MDK schema version)
    Pages/
    Rules/
    Actions/
    Services/
    i18n/
    <optional> ZCustom.CIM  ← CIM file may live here (varies by project)

  ZCustomProject/           ← Customer Z project — ALL custom code goes here
    Pages/
    Rules/
    Actions/
    i18n/
    ZCustomProject.CIM      ← or the CIM may live in SAPAssetManager/
```

> **Note:** The exact folder names depend on the specific customer project. The Z project name
> is typically prefixed with `Z` (e.g. `ZEquinorSSAM`, `ZCustomSSAM`, `ZMyCompanySSAM`).
> Always detect the actual names from the workspace — never assume `ZEquinorSSAM`.

### Hard constraints

| Rule | Why |
|---|---|
| Never write to `SAPAssetManager/` | SAP updates overwrite it — customer changes are lost |
| All custom code → Z project only | Upgrade-safe; SAP never touches the Z folder |
| Every new Z rule → CIM entry | Missing entry = rule never invoked; silent failure |
| Preserve relative path structure | MDK runtime resolves artifacts by relative path |
| Ask permission before destructive ops | Prevent accidental loss of existing customizations |

---

## CIM file — format and creation template

The `.cim` file (JSON format) declares the custom component and its integration points.
It lives in the **root of `SAPAssetManager/`** — not inside the Z project, not in the workspace root.

### Detect CIM location

```bash
# Search ONLY in the root of SAPAssetManager/ — maxdepth 1
find "$SAP_DIR" -maxdepth 1 \( -name "*.CIM" -o -name "*.cim" \) 2>/dev/null | head -5
```

### CIM file — name and location

| Field | Value |
|---|---|
| Filename | `ZSAPAssetManager.cim` |
| Location | `$SAP_DIR/ZSAPAssetManager.cim` (root of the SAP standard project) |
| Format | JSON |

### CIM creation template

Use this when the `.cim` file is missing and the user has approved creating it.
Write to `$SAP_DIR/ZSAPAssetManager.cim`:

```json
{
    "ProjectName": "ZSAPAssetManager",
    "ApplicationName": "ZSAPAssetManager",
    "ComponentVersion": "2405.3.1.010",
    "IntegrationPoints": [
        {
            "Source": "/AssetManagerAddon/Services/ZAssetManager.service",
            "Target": "/SAPAssetManager/Services/AssetManager.service"
        }
    ]
}
```

> `ComponentVersion` should match the current SSAM release version if known. The default
> `2405.3.1.010` is the template value — update it to match the project's actual version.

> After creating the file, set `cimFile = "$SAP_DIR/ZSAPAssetManager.cim"` and continue.

### Adding an integration point for a new customization

When a new Z artifact is created that overrides or extends a standard service/component,
add a new entry to the `IntegrationPoints` array:

```json
{
    "Source": "/AssetManagerAddon/Rules/ZCalculatePriority.js",
    "Target": "/SAPAssetManager/Rules/CalculatePriority.js"
}
```

`Source` = path to the Z/custom artifact. `Target` = path to the standard artifact it replaces or extends.

---

## Z project creation template

When the user approves creating a new Z/custom project from scratch:

### Folder structure to create

```bash
# Replace ZCustomProject with the agreed project name
Z_PROJECT="ZCustomProject"
mkdir -p "$Z_PROJECT/Rules"
mkdir -p "$Z_PROJECT/Pages"
mkdir -p "$Z_PROJECT/Actions"
mkdir -p "$Z_PROJECT/i18n"
echo "Z project structure created at: $Z_PROJECT"
```

### Minimal CIM file for new Z project

Create `$Z_PROJECT/${Z_PROJECT}.CIM` with the CIM creation template above,
replacing `name="ZCustomProject"` with the actual project name.

---

## Standard override pattern (quick reference)

When overriding an existing SAP standard artifact:

```
1. Find the standard file in SAPAssetManager/:
   find $SAP_DIR -name "*OperationName*" -type f
   find $SAP_DIR -name "*.js" | xargs grep -l "functionName" | head -5

2. Record its relative path from $SAP_DIR:
   e.g. Rules/Operations/ConfirmOperation.js

3. Build the Z equivalent path:
   Z_FILE="$zProjectDir/Rules/Operations/ConfirmOperation.js"

4. Check if Z override already exists:
   [ -f "$Z_FILE" ] && echo EXISTS || echo MISSING

5. If MISSING — ask permission, then:
   mkdir -p "$(dirname $Z_FILE)"
   cp "$SAP_DIR/Rules/Operations/ConfirmOperation.js" "$Z_FILE"

6. If EXISTS — inspect it:
   cat "$Z_FILE"   ← understand existing customization before modifying

7. Modify ONLY $Z_FILE — never touch $SAP_DIR/...

8. Add/verify CIM entry for the override.
```

---

## Z naming conventions

| Situation | Naming rule | Example |
|---|---|---|
| Overriding a standard artifact | Keep the original filename | `ConfirmOperation.js` (NOT `ZConfirmOperation.js`) |
| New customer-specific artifact | Add `Z` prefix | `ZCalculatePriority.js` |
| New page (no standard equivalent) | Add `Z` prefix | `ZWorkOrderSummary.page` |
| New action (no standard equivalent) | Add `Z` prefix | `ZCreateServiceTicket.action` |

**Why keep the original filename for overrides?**
The MDK runtime and CIM file resolve artifacts by path. If the Z override path matches the
standard path (same relative structure, same filename), the override is recognized correctly.
Renaming breaks the override registration.

**Why `Z` prefix for new artifacts?**
New artifacts have no standard file to match. The `Z` prefix immediately identifies them as
customer-specific and prevents naming collisions with future SAP standard additions.

---

## Finding artifacts in the standard project

### Find a page by keyword

```bash
find "$SAP_DIR/Pages" -name "*.page" | xargs grep -l "<keyword>" 2>/dev/null | head -10
find "$SAP_DIR/Pages" -name "*<keyword>*" 2>/dev/null | head -10
```

### Find a rule by function name

```bash
find "$SAP_DIR/Rules" -name "*.js" | xargs grep -l "<functionName>" 2>/dev/null | head -10
find "$SAP_DIR/Rules" -name "*<keyword>*" 2>/dev/null | head -10
```

### Find an action by keyword

```bash
find "$SAP_DIR/Actions" -name "*.action" | xargs grep -l "<keyword>" 2>/dev/null | head -10
find "$SAP_DIR/Actions" -name "*<keyword>*" 2>/dev/null | head -10
```

### Find which page uses a specific rule

```bash
grep -r "<RuleName>" "$SAP_DIR/Pages" 2>/dev/null | head -10
```

### Detect full relative path (for Z structure replication)

```bash
# Given a found file path, compute its relative path from SAP_DIR
FOUND_FILE="/path/to/SAPAssetManager/Rules/Operations/ConfirmOperation.js"
RELATIVE="${FOUND_FILE#$SAP_DIR/}"
# Result: Rules/Operations/ConfirmOperation.js
echo "Relative path: $RELATIVE"
echo "Z target:     $zProjectDir/$RELATIVE"
```

---

## Post-customization validation checklist

After any SSAM customization (override or new artifact):

- [ ] Modified file is in `$zProjectDir/` — confirmed with `ls -la "$Z_FILE"`
- [ ] `SAPAssetManager/` is unchanged — `git diff --name-only | grep SAPAssetManager` returns nothing
- [ ] CIM entry added/exists for every modified or new Z artifact
- [ ] CIM entry `name` matches the filename (without extension) exactly (case-sensitive)
- [ ] Relative folder structure matches the standard project structure
- [ ] MDK validation passes: `mcp__mdk__mdk-manage` with `{ "operation": "validate" }`
- [ ] For new JS rules: exported as default function, no syntax errors
- [ ] For new pages: `_Name` matches filename without extension, `_Type` is `"Page"`
- [ ] For page overrides: all referenced rules and actions exist in Z project or SAPAssetManager

---

## CIM integrity check commands

```bash
# Find all JS rules in Z project
find "$zProjectDir/Rules" -name "*.js" 2>/dev/null | xargs -I{} basename {} .js | sort > /tmp/ssam_js.txt

# Find all rules registered in CIM
grep -o 'name="[^"]*"' "$cimFile" 2>/dev/null | sed 's/name="//;s/"//' | sort > /tmp/ssam_cim.txt

# Rules in Z project but NOT in CIM (must register these)
echo "=== Missing CIM entries (MUST ADD) ==="
comm -23 /tmp/ssam_js.txt /tmp/ssam_cim.txt

# Rules in CIM but NOT in Z project (stale entries — review)
echo "=== Stale CIM entries (REVIEW) ==="
comm -13 /tmp/ssam_js.txt /tmp/ssam_cim.txt
```

---

## Related skills

- `mdk-ssam-patterns` — ZEquinorSSAM-specific conventions and override patterns
- `mdk-ssam-upgrade` — SAP Metadata Upgrade Tool workflow (phases 1–9)
- `mdk-app-update` — `OnWillUpdate`/`OnDidUpdate` for schema-breaking upgrades
- `mdk-environment-deploy` — deploy upgraded/customized app to dev/QA/prod
- `mdk-patterns` — general MDK artifact schemas (pages, actions, rules)
