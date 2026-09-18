---
name: mdk-ssam-patterns
version: 0.4.0
description: >
  Use when working on SSAM (SAP Asset Manager) MDK projects. Covers protected folder rules,
  custom Z project (e.g. ZCustomSSAM) conventions, CIM file management, how to read
  SAPAssetManager for reference without modifying it, and how to implement enhancements
  in the correct project folders. Trigger on: "SSAM", "SAPAssetManager", "ZCustomSSAM", "Z project", "custom project",
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
  <CUSTOM_DIR>/       ← ALL custom code goes here (name derived from CIM)
    Rules/             ← custom JavaScript rules
    Pages/             ← custom page overrides
    Actions/           ← custom action overrides
```

| Rule | Why |
|---|---|
| Never write to `SAPAssetManager/` | Breaking changes when SAP releases updates — your changes get overwritten |
| Always implement in `<CUSTOM_DIR>/` (detected from CIM) | Upgrade-safe — SAP updates only touch their own folder |
| Never copy-paste from `SAPAssetManager/` and modify | Creates maintenance nightmare — use override pattern instead |
| Always add CIM entry for new rules | Missing CIM entry = rule not registered = silent failures |

---

## How to read SAPAssetManager for reference

Use Claude Code `Read` tool directly — no bash needed:
```
Read: SAPAssetManager/Rules/WorkOrders/WorkOrders_Detail.js
Read: SAPAssetManager/Pages/WorkOrders/WorkOrders_ListPage.page
```

To search for files by keyword — use `Glob` or `Grep` tool:
```
Glob: SAPAssetManager/Rules/**/*WorkOrder*.js
Grep: "WorkOrders_Detail" in SAPAssetManager/Pages/
```

**Use the existing code as a reference — never modify it.**

---

## Override pattern — how to implement enhancements

### Step 1 — Find the rule/page to override in SAPAssetManager

Use `Grep` tool: search for the function name in `SAPAssetManager/Rules/`
Use `Glob` tool: find files by name pattern in `SAPAssetManager/`

### Step 2 — Create equivalent file in custom project

Mirror the folder structure from `SAPAssetManager/`:
- Original: `SAPAssetManager/Rules/WorkOrders/WorkOrders_IsVisible.js`
- Override:  `<CUSTOM_DIR>/Rules/WorkOrders/WorkOrders_IsVisible.js`

Use `Write` tool to create the file at the correct path in `<CUSTOM_DIR>/`.

### Step 3 — Implement the enhancement
```javascript
// <CUSTOM_DIR>/Rules/WorkOrders/WorkOrders_IsVisible.js
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

Use `Edit` tool to add the entry to the CIM file at `SAPAssetManager/<name>.cim`:

---

## CIM file management

The `.CIM` file registers every custom rule so the MDK runtime knows to use it.
**Every new rule in `<CUSTOM_DIR>/` must have a corresponding CIM entry.**

### CIM entry format (JSON)

The CIM file is JSON format. Add a new entry to `IntegrationPoints` array:

```json
{
  "Source": "/<CUSTOM_DIR>/Rules/WorkOrders/WorkOrders_IsVisible.js",
  "Target": "/SAPAssetManager/Rules/WorkOrders/WorkOrders_IsVisible.js"
}
```

- `Source` — path to your custom file in `<CUSTOM_DIR>/`
- `Target` — path to the SAP standard file it overrides in `SAPAssetManager/`

Use `Edit` tool to add this entry to the `IntegrationPoints` array in the CIM file.

### How to check for missing CIM entries

Run this silent Node.js check:
```javascript
const fs = require("fs"), path = require("path");
const cimFile   = String.raw`<CIM_FILE>`;
const customDir = String.raw`<CUSTOM_DIR>`;
const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const registered = new Set((cim.IntegrationPoints||[])
  .map(ip=>path.basename(ip.Source||"",".js")));
const rules = [];
function scan(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    const p = path.join(d,e.name);
    if (e.isDirectory()) scan(p);
    else if (e.name.endsWith(".js")) rules.push(path.basename(e.name,".js"));
  }
}
scan(path.join(customDir,"Rules"));
const missing = rules.filter(r=>!registered.has(r));
const stale   = [...registered].filter(r=>!rules.includes(r));
console.log("Missing from CIM:", missing);
console.log("Stale CIM entries:", stale);
```

---

## Checklist before committing SSAM changes

- [ ] No files modified in `SAPAssetManager/`
- [ ] All new files created in `<CUSTOM_DIR>/` only
- [ ] Every new `.js` rule has a CIM entry in the CIM file
- [ ] Rule names match between file name and CIM entry
- [ ] `mdk_manage validate` passes 0 errors
- [ ] Tested against SAPAssetManager base without custom code (regression)


---

## Upgrading SSAM to a new version

For upgrading between SSAM versions (running the SAP Metadata Upgrade Tool,
applying SAP Notes, merging customized metadata with new out-of-box releases),
see the `mdk-ssam-upgrade` skill.
