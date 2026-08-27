---
name: mdk-ssam-patterns
version: 0.4.0
description: >
  Use when working on SSAM (SAP Asset Manager) MDK projects. Covers protected folder rules,
  ZEquinorSSAM implementation conventions, CIM file management for new rules, how to read
  SAPAssetManager for reference without modifying it, and how to implement enhancements
  in the correct project folders. Trigger on: "SSAM", "SAPAssetManager", "ZEquinorSSAM",
  "CIM file", "CIM entry", "asset manager", "enhancement", "existing MDK project",
  "SSAM project", "asset manager project", "equinor", "ZEquinor", "protected folder",
  "implementation folder", "read only folder", "don't modify", "custom logic MDK",
  "extend MDK app", "override MDK rule", "add to SSAM", "SSAM enhancement".
source: Intent2App — SSAM project-specific, not covered by @sap/mdk-mcp-server
---

# SSAM MDK Project Patterns

Rules and conventions for working on SAP Asset Manager (SSAM) MDK projects.
These are non-negotiable — violating them breaks the base product or makes upgrades impossible.

---

## Folder structure rules (hard constraints)

```
Project root/
  SAPAssetManager/     ← READ ONLY — never modify or generate files here
  ZEquinorSSAM/        ← ALL custom code goes here
    Rules/             ← custom JavaScript rules
    Pages/             ← custom page overrides
    Actions/           ← custom action overrides
    ZEquinorSSAM.CIM   ← MUST be updated for every new rule
```

| Rule | Why |
|---|---|
| Never write to `SAPAssetManager/` | Breaking changes when SAP releases updates — your changes get overwritten |
| Always implement in `ZEquinorSSAM/` | Upgrade-safe — SAP updates only touch their own folder |
| Never copy-paste from `SAPAssetManager/` and modify | Creates maintenance nightmare — use override pattern instead |
| Always add CIM entry for new rules | Missing CIM entry = rule not registered = silent failures |

---

## How to read SAPAssetManager for reference

```bash
# Find an existing rule to understand the pattern
find ./SAPAssetManager -name "*.js" | grep -i "workorder\|equipment" | head -10

# Read an existing rule to understand its structure
cat ./SAPAssetManager/Rules/WorkOrders/WorkOrders_Detail.js

# Find the page that calls a rule
grep -r "WorkOrders_Detail" ./SAPAssetManager/Pages/ | head -5
```

**Use the existing code as a reference — never modify it.**

---

## Override pattern — how to implement enhancements

### Step 1 — Find the rule/page to override in SAPAssetManager
```bash
grep -r "FunctionToOverride\|RuleToChange" ./SAPAssetManager/Rules/ | head -10
```

### Step 2 — Create equivalent file in ZEquinorSSAM
Mirror the folder structure from `SAPAssetManager/`:
```bash
# If the original is:
# SAPAssetManager/Rules/WorkOrders/WorkOrders_IsVisible.js

# Create your override at:
# ZEquinorSSAM/Rules/WorkOrders/WorkOrders_IsVisible.js
```

### Step 3 — Implement the enhancement
```javascript
// ZEquinorSSAM/Rules/WorkOrders/WorkOrders_IsVisible.js
// Enhancement: also hide completed work orders for non-admin users
export default function WorkOrders_IsVisible(clientAPI) {
  const status = clientAPI.binding.Status;
  const isAdmin = clientAPI.context.applicationContext.userId === 'admin';
  
  // Custom logic
  if (status === 'Completed' && !isAdmin) return false;
  
  // Fall through to standard visibility
  return true;
}
```

### Step 4 — Add CIM entry (mandatory)

```bash
# Open ZEquinorSSAM.CIM and add entry for new rule
```

---

## CIM file management

The `.CIM` file registers every custom rule so the MDK runtime knows to use it.
**Every new rule in `ZEquinorSSAM/` must have a corresponding CIM entry.**

### CIM entry format

```xml
<!-- ZEquinorSSAM.CIM -->
<Rule name="WorkOrders_IsVisible"
      path="/ZEquinorSSAM/Rules/WorkOrders/WorkOrders_IsVisible.js"
      description="Custom visibility rule — hides completed orders for non-admin users"
      overrides="/SAPAssetManager/Rules/WorkOrders/WorkOrders_IsVisible.js" />
```

### How to check for missing CIM entries

```bash
# List all .js files in ZEquinorSSAM/Rules
find ./ZEquinorSSAM/Rules -name "*.js" | sort > /tmp/rules.txt

# List all rules registered in CIM
grep -o 'name="[^"]*"' ./ZEquinorSSAM/ZEquinorSSAM.CIM | sort > /tmp/cim.txt

# Show rules missing from CIM
diff /tmp/rules.txt /tmp/cim.txt
```

---

## Checklist before committing SSAM changes

- [ ] No files modified in `SAPAssetManager/`
- [ ] All new files created in `ZEquinorSSAM/` only
- [ ] Every new `.js` rule has a CIM entry in `ZEquinorSSAM.CIM`
- [ ] Rule names match between file name and CIM entry
- [ ] `mdk_manage validate` passes 0 errors
- [ ] Tested against SAPAssetManager base without custom code (regression)


---

## Upgrading SSAM to a new version

For upgrading between SSAM versions (running the SAP Metadata Upgrade Tool,
applying SAP Notes, merging customized metadata with new out-of-box releases),
see the `mdk-ssam-upgrade` skill.
