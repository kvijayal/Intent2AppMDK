# SSAM Conflict Categories — Reference

Detailed definitions, detection rules, and worked examples for each category
produced by the SSAM Upgrade Conflict Analyzer.

---

## ABSORBED — SAP standard now delivers this functionality

### Definition
The new SAP standard version has incorporated functionality that your custom override
was previously adding. Using your override after upgrade would duplicate the standard
behavior and may cause conflicts or unexpected results.

### Detection rule
Custom additions = lines in your custom file that are NOT in the old standard.
Only **meaningful lines** are counted — structural noise is excluded:
braces, single keywords (`return`, `else`), comments, and lines shorter than 5 characters.

**Tiered thresholds** (avoids false positives on generic code):
- 1–2 meaningful additions → **100% must appear** in the new standard (exact match)
- 3+ meaningful additions → **≥50% must appear** in the new standard

This means even a single-line customization can be detected as ABSORBED if that
exact meaningful line is now part of the SAP standard.

### What to do
**Remove the custom override** from the Z project and remove its CIM entry.
The new SAP standard already contains the functionality. Keeping the custom override
can cause: duplicate logic, shadow functions, unexpected behavior when SAP's version
and your version disagree.

### Example
```
Old SAPAssetManager/Rules/WorkOrders/GetPriority.js  → had 40 lines, no priority filter
Custom ZEquinorSSAM/Rules/WorkOrders/GetPriority.js   → added 15 lines to filter by priority

New SAPAssetManager/Rules/WorkOrders/GetPriority.js  → now has those 15 lines built in
→ Result: ABSORBED (custom additions are in the new standard)
→ Action:  Delete ZEquinorSSAM/Rules/WorkOrders/GetPriority.js, remove CIM entry
```

---

## INCOMPATIBLE — Standard API has changed, custom code breaks

### Definition
The new SAP standard version has removed or renamed properties, functions, or binding
paths that your custom code references. After upgrade your custom override will reference
identifiers that no longer exist in the standard, causing runtime errors.

### Detection rule
Lines removed from the standard (present in old version, absent in new) contain
identifiers (property names, function names, binding paths) that also appear in the
custom source file.

Identifier extraction covers:
- JSON property names: `"PropertyName":`
- JS function declarations: `function FunctionName(`, `const FunctionName =`
- Property access: `.PropertyName`
- String binding keys: `"BindingKey"`

### Rename detection (FIX: no longer just "identifier removed")
For each broken reference, the analyzer also searches for the most likely **rename
candidate** in the new standard using **camelCase token similarity**:

1. Split both identifiers into tokens: `WorkOrderType` → `[work, order, type]`
2. Score overlap: shared tokens ÷ max(token counts)
3. Best candidate with score ≥ 0.5 is surfaced as a rename hint with confidence %

Examples:
| Removed | New Standard Added | Tokens Shared | Confidence |
|---|---|---|---|
| `WorkOrderType` | `MaintenanceOrderType` | order, type | 67% |
| `WOPriority` | `WorkOrderPriority` | priority | 50% |
| `Priority` | `CustomerName` | (none) | — (not shown) |

When confidence ≥ 80%: reliable rename — update your code to use the new name.
When confidence 50–79%: strong hint — verify in SAP release notes before changing.
When no candidate found: check SAP SSAM release notes for the replacement API.

### What to do
**Modify the custom override** to use the new API. Steps:
1. Open the new standard file and find what replaced the removed identifier
2. Update the custom override to use the new API
3. Re-test with `mdk-manage validate`

If the removed identifier has no replacement in the new standard, the feature
may have been redesigned — check the SAP SSAM release notes.

### Example
```
Old standard had: "WorkOrderType": "PM01"
Custom code references: WorkOrderType in a filter rule

New standard removed WorkOrderType, replaced with "MaintenanceOrderType"
→ Result: INCOMPATIBLE (custom rule references removed identifier)
→ Action:  Update ZEquinorSSAM/Rules/WorkOrders/MyFilter.js to use MaintenanceOrderType
```

---

## TARGET-MOVED — Standard file relocated or renamed

### Definition
The CIM entry's Target path no longer exists in the new SAP standard. The standard
file was either renamed, moved to a different folder, or deleted. The CIM entry
will be invalid after upgrade.

### Sub-types

| Sub-type | Detection | Action |
|---|---|---|
| **Moved** | File with same name found at different path in new standard | Update CIM Target to new path |
| **Renamed** | File not found by name — check folder for similar names | Update CIM Source+Target to match new name |
| **Deleted** | File not found anywhere in new standard | Remove CIM entry; check if SAP removed this feature |

### What to do
**Update the CIM Target path** to the new location before running the upgrade.
Use the `mdk-ssam-guide` skill's CIM management pattern to edit the CIM file.

If the file was deleted from the standard, decide whether to:
- Keep your custom file as an UNCONSTRAINED standalone addition (remove CIM entry)
- Remove the custom file entirely if it relied on the standard artifact

### Example
```
Old: Target = /SAPAssetManager/Rules/Util/Logger.js
New: File not found at that path; found at /SAPAssetManager/Rules/Common/Logger.js

→ Result: TARGET-MOVED (same file, new folder)
→ Action:  Edit CIM: change Target to /SAPAssetManager/Rules/Common/Logger.js
```

---

## NEEDS-REVIEW — Complex change, automated analysis inconclusive

### Definition
The standard file has changed significantly, but the automated analysis cannot
determine with confidence whether the custom override is affected. Common causes:

- Standard file was substantially rewritten (>20 lines removed) — custom code
  may reference logic that was restructured, not just removed
- Change type is ambiguous (both additions and removals, no clear identifier overlap)
- Custom file has complex inter-dependencies with other files

### What to do
**Manually compare the three versions:**
1. Open old standard file: `SAPAssetManager/Rules/.../File.js`
2. Open new standard file: same path in new SAPAssetManager version
3. Open custom override: `<CUSTOM_DIR>/Rules/.../File.js`
4. Look for: function renames, property restructures, new required parameters
5. Decide: SAFE (update after comparison) or INCOMPATIBLE (modify needed)

### Example
```
Old standard: 80 lines
New standard: 120 lines (35 lines removed, 75 lines added) — substantial rewrite
Custom override: adds 12 lines of custom filtering logic

→ Result: NEEDS-REVIEW (large rewrite, unclear impact on custom additions)
→ Action:  Manually compare — the custom filtering logic may still apply,
           but the integration points may have moved
```

---

## SAFE — Standard unchanged or only additively extended

### Definition
The standard file is either identical between old and new versions, or the changes
are purely additive (new lines added) and do not affect any identifiers referenced
by the custom override.

### Sub-types

| Sub-type | Detection |
|---|---|
| **Unchanged** | `oldSapContent === newSapContent` |
| **Additive-safe** | Standard changed but: no lines removed from standard that are referenced by custom code |

### What to do
**Carry forward as-is.** The custom override remains valid and will work correctly
with the new standard version. The `mdk-ssam-upgrade` skill handles this as
"Category C" (merge: custom additions appended to new SAP base).

### Example
```
Old standard: 60 lines
New standard: 60 lines (identical)
Custom override: adds 8 lines for equipment-specific filtering

→ Result: SAFE (standard unchanged)
→ Action:  mdk-ssam-upgrade carries forward automatically
```

---

## UNCONSTRAINED — Pure custom addition (no standard override)

### Definition
A file exists in the Z project folder but has **no CIM entry** pointing to a
standard equivalent. This is a pure addition — a new rule, page, or action
that implements functionality not present in the SAP standard.

These files are not "overriding" anything — they extend the application with
custom-only features.

### What to do
**Carry forward as-is.** These files are unaffected by SAP standard changes.
The `mdk-ssam-upgrade` skill carries them forward as standalone files.

If you find an UNCONSTRAINED file that should have a CIM entry (e.g., it was
meant to override a standard file), add the CIM entry now before upgrading.

### Example
```
ZEquinorSSAM/Rules/Equipment/EquipmentRiskScore.js — no CIM entry
This rule calculates a company-specific risk score — pure custom functionality

→ Result: UNCONSTRAINED
→ Action:  Carry forward automatically during upgrade
```

---

## Reading the Migration Action Plan

The report's Migration Action Plan table lists all HIGH and MEDIUM items in
priority order. Use it to estimate upgrade effort:

| Action | Typical effort |
|---|---|
| Remove (ABSORBED) | Low — delete file + remove CIM entry |
| Modify (INCOMPATIBLE) | Medium — update custom code to new API |
| Update CIM Target (TARGET-MOVED) | Low — edit one JSON field in CIM |
| Manual review (NEEDS-REVIEW) | Variable — depends on change complexity |
| None (SAFE / UNCONSTRAINED) | None — handled automatically |

**Upgrade effort estimate:**
- 0 HIGH items: Low effort — run `mdk-ssam-upgrade` directly
- 1–5 HIGH items: Medium effort — address HIGH items first, then upgrade
- 5+ HIGH items: High effort — significant custom code rework before upgrade
