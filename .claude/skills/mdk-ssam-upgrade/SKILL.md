---
name: mdk-ssam-upgrade
version: 0.4.0
description: >
  Use when upgrading SAP Service and Asset Manager (SSAM) to a new version using the
  SAP Metadata Upgrade Tool. Covers workspace detection, CIM pre-audit, Metadata Upgrade
  Tool workflow, conflict resolution, and post-upgrade validation. This skill is fully
  executable — follow each phase in order. Trigger on: "SSAM upgrade", "SAP Asset Manager
  upgrade", "upgrade SSAM", "Metadata Upgrade Tool", "SSAM metadata merge", "upgrade to
  new version SSAM", "SSAM 2305", "SSAM 2210", "SAPAssetManager upgrade", "merge custom
  metadata", "upgrade tool SSAM", "SSAM conflict", "SNOTE SSAM", "apply SAP notes",
  "SSAM backend compatibility", "upgrade metadata ZIP", "3-way merge MDK", "ZEquinorSSAM
  upgrade", "new SAPAssetManager version".
source: SAP Service and Asset Manager Upgrade Guide 2305
---

# SSAM Upgrade Skill

## Workspace structure (what this skill expects)

```
Workspace/
  SAPAssetManager/          ← SAP standard project (read-only reference)
    ZEquinorSSAM.CIM        ← CIM file lives here
    Rules/, Pages/, ...
  ZEquinorSSAM/             ← Custom implementation
    Rules/, Pages/, Actions/
```

**Developer provides:** Only the new `SAPAssetManager` ZIP (latest SAP release).
**Read from workspace automatically:** `SAPAssetManager/`, `ZEquinorSSAM/`, CIM file.

---

## Phase 1 — Detect workspace

Run these bash commands. BLOCKING on any failure.

```bash
# Detect projects
SAP_DIR=$(find . -type d -name "SAPAssetManager" -maxdepth 3 | head -1)
CUSTOM_DIR=$(find . -type d -name "ZEquinorSSAM" -maxdepth 3 | head -1)
CIM_FILE=$(find . -name "*.CIM" -maxdepth 5 | head -1)

echo "Standard: $SAP_DIR"
echo "Custom:   $CUSTOM_DIR"
echo "CIM:      $CIM_FILE"

# Current version
cat "$SAP_DIR/Application.app" 2>/dev/null | \
  python3 -c "import json,sys; p=json.load(sys.stdin); print('Version:', p.get('ApplicationVersion','unknown'))" 2>/dev/null
```

**If `SAPAssetManager/` not found:**
```
BLOCKING: Cannot find SAPAssetManager folder in workspace.
Please open the SSAM project root and re-run.
```

**If `ZEquinorSSAM/` not found:**
```
BLOCKING: Cannot find ZEquinorSSAM folder in workspace.
Please confirm the custom project folder name.
```

**If no `.CIM` file found:**
```
BLOCKING: Cannot find .CIM file (expected at SAPAssetManager/ZEquinorSSAM.CIM).
Please confirm its location.
```

---

## Phase 2 — Ask for the one required input

If `ssamNewVersionZip` not in brief:
```
BLOCKING: Found your workspace:
  Standard: <SAP_DIR> (version: <current_version>)
  Custom:   <CUSTOM_DIR>
  CIM:      <CIM_FILE>

I need ONE input from you:
  Path to the new SAPAssetManager ZIP (latest SAP release to upgrade to).

Don't have it? Download from:
  https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER
  → Select your target version → Download metadata ZIP
```

---

## Phase 3 — Backend compatibility check

Read current version and confirm compatibility with the target version.

| SSAM App | Min S/4HANA | Min Add-On |
|---|---|---|
| 2010 | 1909 SP08 | S4MFND 100 SP08 |
| 2005 | 1909 SP07 | S4MFND 100 SP07 |
| 1911 | 1909 SP06 | S4MFND 100 SP06 |

If incompatible → BLOCKING with minimum required version.

---

## Phase 4 — CIM pre-audit from workspace

Run before anything else. Fix gaps before upgrading.

```bash
CIM_FILE="./SAPAssetManager/ZEquinorSSAM.CIM"

# Registered in CIM
grep -o 'name="[^"]*"' "$CIM_FILE" | \
  sed 's/name="//;s/"//' | sort > /tmp/cim_before.txt
echo "CIM entries: $(wc -l < /tmp/cim_before.txt)"

# Custom JS rules
find ./ZEquinorSSAM/Rules -name "*.js" 2>/dev/null | \
  xargs -I{} basename {} .js | sort > /tmp/js_before.txt
echo "Custom rules: $(wc -l < /tmp/js_before.txt)"

# Missing from CIM
echo "=== Not registered in CIM (MUST FIX before upgrade) ==="
comm -23 /tmp/js_before.txt /tmp/cim_before.txt

# Stale entries
echo "=== Stale CIM entries (rules no longer exist) ==="
comm -13 /tmp/js_before.txt /tmp/cim_before.txt
```

**If missing entries found:**
```
BLOCKING: Found <n> ZEquinorSSAM rules not registered in CIM:
  <list each missing rule>

Add these to SAPAssetManager/ZEquinorSSAM.CIM before upgrading:
  <Rule name="RuleName"
        path="/ZEquinorSSAM/Rules/Folder/RuleName.js"
        overrides="/SAPAssetManager/Rules/Folder/RuleName.js" />

Reply when fixed.
```

---

## Phase 5 — SAP Notes check

```
BLOCKING: Before proceeding, confirm:
Have you applied all required SAP Notes for this upgrade?
Key note: SAP Note 2924633 (SAP Asset Manager — Upgrade Procedure)

Reply "yes" to continue, or "no" for guidance on applying notes via SNOTE.
```

If "no" → explain SNOTE process:
```
Apply notes via SAP GUI → SNOTE transaction:
1. Read note carefully — check pre/post steps and prerequisites
2. Goto → SAP Note Browser → select note → F8 to implement
3. Verify status: "Can be Implemented" or "Obsolete version Implemented"
4. Complete any post-implementation steps
```

---

## Phase 6 — Prepare the customized ZIP for the tool

The Metadata Upgrade Tool needs both projects as one ZIP:

```bash
# Create the customized ZIP from workspace
cd <workspace_root>
zip -r /tmp/customized_ssam.zip SAPAssetManager/ ZEquinorSSAM/
echo "Created: /tmp/customized_ssam.zip ($(du -sh /tmp/customized_ssam.zip | cut -f1))"
```

---

## Phase 7 — Metadata Upgrade Tool workflow

```
Tool: SAP Service and Asset Manager Metadata Upgrade Tool (Electron app)
Download: https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER (TEA agreement required)
Platform: macOS or Windows
```

**Step 1 — Upload:**
```
Launch tool → click "Upload"
  Customized ZIP: /tmp/customized_ssam.zip
  New version ZIP: <ssamNewVersionZip>
→ click "Upload"
```

**Step 2 — Review file tree:**
Files organized by type: Page / Rule / Action / Properties/i18n

**Step 3 — Auto-merge non-customized files:**
Click blue Merge icon for files you haven't customized.

**Step 4 — Manual merge for ZEquinorSSAM files:**
Click each ZEquinorSSAM file → open Merge Editor.
- Center panel = your custom version
- Use arrows for block-level changes
- Strategy: **Prioritize custom, integrate new** (recommended)

**Step 5 — CIM file — always manual (critical):**
Open `ZEquinorSSAM.CIM` in Merge Editor.
- Never auto-merge the CIM file
- Strategy: **Prioritize custom, integrate new**
- Verify all ZEquinorSSAM entries survive the merge

**Step 6 — Batch auto-merge remaining:**
Home Page → AUTO MERGE → download Batch Merge Results report

**Step 7 — Export:**
Download the upgraded metadata ZIP from the tool.

**Conflict resolution strategies:**

| Strategy | Use when |
|---|---|
| Keep custom | Your logic must be 100% preserved, no new SAP features needed |
| Replace with new | File has no real customizations |
| **Prioritize custom + integrate new** *(recommended)* | Most files — keeps your changes, adds SAP new properties |

---

## Phase 8 — Extract and verify

```bash
# Extract upgraded ZIP back to workspace
unzip -o <upgraded_zip> -d <workspace_root>

# CIM post-upgrade verification
find ./ZEquinorSSAM/Rules -name "*.js" | \
  xargs -I{} basename {} .js | sort > /tmp/js_after.txt
grep -o 'name="[^"]*"' ./SAPAssetManager/ZEquinorSSAM.CIM | \
  sed 's/name="//;s/"//' | sort > /tmp/cim_after.txt

echo "=== Missing from CIM (ADD THESE) ==="
comm -23 /tmp/js_after.txt /tmp/cim_after.txt

echo "=== Stale CIM entries (REMOVE THESE) ==="
comm -13 /tmp/js_after.txt /tmp/cim_after.txt
```

Fix any CIM gaps found. Then validate:

```bash
npx @sap/mdk-tools validate --project .
```

Or via MCP:
```
mcp__mdk__mdk-manage { "folderRootPath": ".", "operation": "validate" }
```

---

## Phase 9 — Post-upgrade checklist

- [ ] All ZEquinorSSAM customizations present in merged output
- [ ] Every `.js` in `ZEquinorSSAM/Rules/` has a CIM entry
- [ ] No stale CIM entries for removed rules
- [ ] Rule names in CIM match file names exactly (case-sensitive)
- [ ] `mdk_manage validate` → 0 errors
- [ ] `ApplicationVersion` bumped in `.project.json` (MAJOR if schema changed)
- [ ] Offline app: `OnWillUpdate` + `OnDidUpdate` implemented (see `mdk-app-update` skill)
- [ ] Deployed to DEV → tested → promoted to QA → PROD

---

## Backend compatibility reference

### S/4HANA

| SSAM | Min S/4HANA | S4MFND | S4MERP | S4MISU |
|---|---|---|---|---|
| 2010 | 1909 SP08 | 100 SP08 | 100 SP08 | 100 SP06 |
| 2005 | 1909 SP07 | 100 SP07 | 100 SP07 | 100 SP05 |
| 1911 | 1909 SP06 | 100 SP06 | 100 SP06 | 100 SP04 |
| 4.0  | 1909 SP04 | 100 SP04 | 100 SP04 | 100 SP02 |

### ERP Mobile Add-On

| Add-On | Date | 2010 | 2005 | 1911 | 4.0 |
|---|---|---|---|---|---|
| SP07 (SMFND 630_740 SP07) | OCT 2020 | ✅ | ✅ | ✅ | ✅ |
| SP06 | MAY 2020 | ❌ | ✅ | ✅ | ✅ |
| SP05 | NOV 2019 | ❌ | ❌ | ✅ | ✅ |
| SP03 | JUN 2019  | ❌ | ❌ | ❌ | ✅ |

See SAP Note 2924633 for exact upgrade procedure per version.

---

## Related skills
- `mdk-ssam-patterns` — ZEquinorSSAM conventions, CIM entries for new rules
- `mdk-app-update` — OnWillUpdate/OnDidUpdate for schema-breaking upgrades
- `mdk-environment-deploy` — deploy upgraded app to dev/QA/prod
- `mdk-migration` — MDK schema version matrix
