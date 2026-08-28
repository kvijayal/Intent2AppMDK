---
name: mdk-ssam-upgrade
version: 0.5.0
description: >
  Use when upgrading SAP Service and Asset Manager (SSAM) to a new version using the
  SAP Metadata Upgrade Tool. Covers workspace detection, custom project detection from
  CIM file, CIM pre-audit, Metadata Upgrade Tool workflow, conflict resolution, and
  post-upgrade CIM verification. This skill is fully executable — follow each phase in
  order. Trigger on: "SSAM upgrade", "SAP Asset Manager upgrade", "upgrade SSAM",
  "Metadata Upgrade Tool", "SSAM metadata merge", "upgrade to new version SSAM",
  "SSAM 2305", "SSAM 2210", "SAPAssetManager upgrade", "merge custom metadata",
  "upgrade metadata ZIP", "3-way merge MDK", "new SAPAssetManager version",
  "SSAM customisation upgrade", "merge SSAM customisations".
source: SAP Service and Asset Manager Upgrade Guide 2305
---

# SSAM Upgrade — Metadata Upgrade Tool Workflow

## What this skill does

Guides the complete SSAM metadata upgrade using the SAP Metadata Upgrade Tool.
The tool merges your customised metadata with the new SAP out-of-box release.

**Developer provides:** Only the new `SAPAssetManager` ZIP (latest SAP release).
**Everything else is read from the workspace automatically.**

---

## Phase 1 — Detect workspace and derive all paths automatically

Given the new SAPAssetManager ZIP, detect everything else from the workspace.
The developer provides **only the new SAPAssetManager ZIP** — all other paths are found automatically.

```bash
# Step 1a — Find current SAPAssetManager in workspace
SAP_DIR=$(find . -type d -name "SAPAssetManager" -maxdepth 3 | head -1)
echo "Current standard project: $SAP_DIR"

# Step 1b — Find CIM file inside SAPAssetManager
CIM_FILE=$(find "$SAP_DIR" -name "*.CIM" -maxdepth 3 | head -1)
echo "CIM file: $CIM_FILE"

# Step 1c — Derive custom project name from CIM path entries
# CIM path attribute: path="/CustomProjectName/Rules/Folder/Rule.js"
# → extract the first path segment that is NOT SAPAssetManager
CUSTOM_NAME=$(grep -o 'path="[^"]*"' "$CIM_FILE" |   sed 's/path="\/\([^/]*\)\/.*//' |   grep -v "SAPAssetManager" |   sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
echo "Custom project name (from CIM): $CUSTOM_NAME"

# Step 1d — Find custom project in workspace
CUSTOM_DIR=$(find . -type d -name "$CUSTOM_NAME" -maxdepth 4 | head -1)
echo "Custom project path: $CUSTOM_DIR"

# Step 1e — Read current version from workspace
CURRENT_VERSION=$(cat "$SAP_DIR/Application.app" 2>/dev/null |   python3 -c "import json,sys; p=json.load(sys.stdin);   print(p.get('ApplicationVersion','unknown'))" 2>/dev/null)
echo "Current version: $CURRENT_VERSION"

# Step 1f — Read new version from the provided ZIP
NEW_VERSION=$(unzip -p "$NEW_SAP_ZIP" "*/Application.app" 2>/dev/null |   python3 -c "import json,sys; p=json.load(sys.stdin);   print(p.get('ApplicationVersion','unknown'))" 2>/dev/null)
echo "New version (from ZIP): $NEW_VERSION"
```

**Auto-detection logic:**

| What | How detected | BLOCKING if |
|---|---|---|
| Current `SAPAssetManager/` | `find . -name "SAPAssetManager"` | Not found in workspace |
| CIM file | `find` inside `SAPAssetManager/` | No `.CIM` file found |
| Custom project name | Most frequent non-SAP folder in CIM `path=` entries | Cannot parse CIM entries |
| Custom project folder | `find . -name "<CUSTOM_NAME>"` | Not found → ask user for path |
| Current SSAM version | `Application.app` in `SAPAssetManager/` | Log warning, continue |
| New SSAM version | `Application.app` inside new ZIP | Log warning, continue |

**If custom project not found in workspace:**
```
BLOCKING: Detected custom project name "<CUSTOM_NAME>" from CIM file
but could not find this folder in your workspace.

Please provide the path to your custom project folder
(e.g. /Users/you/projects/ZEquinorSSAM  or  ./ZEquinorSSAM)
```

**Report detected state before proceeding:**
```
Detected workspace:
  Current standard:  <SAP_DIR>        (version: <CURRENT_VERSION>)
  CIM file:          <CIM_FILE>
  Custom project:    <CUSTOM_DIR>      (name: <CUSTOM_NAME>, derived from CIM)
  Upgrading to:      <NEW_VERSION>     (from <NEW_SAP_ZIP>)
```

---

## Phase 2 — Ask for the one required input

Once workspace is confirmed, ask for the single input needed:

```
BLOCKING:
Detected your workspace:
  Standard: <SAP_DIR> (version: <current_version>)
  Custom:   <CUSTOM_DIR>
  CIM:      <CIM_FILE>

I need ONE thing from you:
  Path to the new SAPAssetManager ZIP (latest SAP release to upgrade to).

Don't have it?
  Download from: https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER
  → Select your target version → Download metadata ZIP
```

---

## Phase 3 — CIM pre-audit

Read and validate the CIM before running the upgrade tool.
Fix any gaps now — a broken CIM before upgrade makes the auto-merge less reliable.

```bash
CIM_FILE="<detected CIM path>"
CUSTOM_DIR="<detected custom project>"

# All rules registered in CIM
grep -o 'path="[^"]*"' "$CIM_FILE" | \
  grep -v "SAPAssetManager" | \
  sed 's/path="\/\([^/]*\)\/Rules\/.*\/\([^/]*\)\.js"/\2/' | \
  sort > /tmp/cim_rules.txt
echo "CIM entries: $(wc -l < /tmp/cim_rules.txt)"

# All rule JS files in custom project
find "./$CUSTOM_DIR/Rules" -name "*.js" 2>/dev/null | \
  xargs -I{} basename {} .js | sort > /tmp/custom_rules.txt
echo "Custom rules: $(wc -l < /tmp/custom_rules.txt)"

# Rules in custom project NOT registered in CIM (must fix before upgrade)
echo "=== Missing from CIM (FIX BEFORE UPGRADE) ==="
comm -23 /tmp/custom_rules.txt /tmp/cim_rules.txt

# CIM entries pointing to rules that no longer exist (stale)
echo "=== Stale CIM entries (rules no longer exist) ==="
comm -13 /tmp/custom_rules.txt /tmp/cim_rules.txt
```

**BLOCKING if missing entries found:**
```
BLOCKING: Found <n> rules in <CUSTOM_DIR>/Rules/ not registered in CIM:
  <list each missing rule file>

Add to <CIM_FILE> for each:
  <Rule name="RuleName"
        path="/<CUSTOM_DIR>/Rules/Folder/RuleName.js"
        overrides="/SAPAssetManager/Rules/Folder/RuleName.js" />

Reply when fixed.
```

---

## Phase 4 — Metadata Upgrade Tool workflow

```
Tool: SAP Service and Asset Manager Metadata Upgrade Tool
Type: Cross-platform Electron app (macOS / Windows)
Download: https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER
          (requires TEA — Test and Evaluation Agreement)
```

**Step 1 — Upload (no ZIP preparation needed):**
```
Launch the Metadata Upgrade Tool (Electron app)
→ click "Upload"

  Current project (your customised version):
    Browse to: <SAP_DIR>/          ← current SAPAssetManager from workspace
    The tool also reads:  <CUSTOM_DIR>/  ← auto-detected from CIM

  New version (latest SAP release):
    Browse to: <NEW_SAP_ZIP>       ← the ZIP you downloaded from SAP

→ click "Upload" to start processing
```
The tool reads `SAPAssetManager/` and `<CUSTOM_DIR>/` directly from the filesystem —
no ZIP preparation required. The only ZIP is the new SAP release you downloaded.

**Step 2 — Review file tree:**
Files organised by type: Page / Rule / Action / Properties/i18n

**Step 3 — Auto-merge non-customised files:**
Click the blue Merge icon for files that exist only in SAP standard (no custom changes).

**Step 4 — Manual merge for custom project files:**
For every file under `<CUSTOM_DIR>/`:
- Open in Merge Editor
- Use **"Prioritize custom, integrate new"** strategy
- Your custom code preserved for conflicting properties
- New SAP properties added automatically

**Step 5 — CIM file — auto-merged by the skill (not manual):**

After the tool exports the upgraded ZIP, the skill merges the CIM automatically:

```python
import xml.etree.ElementTree as ET

# Parse both CIM files
current_tree = ET.parse('<CIM_FILE>')          # current workspace CIM
new_tree     = ET.parse('<NEW_VERSION_CIM>')   # CIM from new SAP ZIP

current_root = current_tree.getroot()
new_root     = new_tree.getroot()

merged_entries = []

# Rule 1: Keep ALL entries where path points to custom project
for entry in current_root.findall('.//Rule'):
    path = entry.get('path', '')
    if '<CUSTOM_NAME>' in path:
        merged_entries.append(entry)   # always keep custom rules

# Rule 2: Take SAP standard entries from NEW version
for entry in new_root.findall('.//Rule'):
    path = entry.get('path', '')
    if 'SAPAssetManager' in path:
        merged_entries.append(entry)   # take SAP entries from new version

# Rule 3: Check for new SAP entries not in current CIM
current_names = {e.get('name') for e in current_root.findall('.//Rule')}
for entry in new_root.findall('.//Rule'):
    name = entry.get('name', '')
    if name not in current_names:
        merged_entries.append(entry)   # add new SAP rules from new version
        print(f"New SAP rule added: {name}")

# Write merged CIM
merged_root = ET.Element(current_root.tag, current_root.attrib)
for entry in merged_entries:
    merged_root.append(entry)
ET.ElementTree(merged_root).write('<CIM_FILE>', encoding='utf-8', xml_declaration=True)
print(f"Merged CIM: {len(merged_entries)} entries")
```

**What the auto-merge does:**
- Custom rules (`path` contains `<CUSTOM_NAME>`) → always preserved
- SAP standard rules → taken from new version (picks up new SAP entries automatically)
- New rules added in new SAP version → added automatically
- Rules removed from new SAP version → dropped automatically

**Step 6 — Batch auto-merge remaining:**
```
Home Page → AUTO MERGE
→ Download the Batch Merge Results report
→ Review: Changed / Processed / Unchanged / Removed counts
```

**Step 7 — Export:**
Download the upgraded metadata ZIP from the tool.

---

## Conflict resolution strategies

| Strategy | Use when |
|---|---|
| Keep custom | Custom logic must be preserved entirely, no new SAP features needed |
| Replace with new | File has no real customisations |
| **Prioritize custom + integrate new** *(recommended)* | Most files — keeps your changes, adds SAP new properties |

**Example conflict (Page file — OnPress of a button):**
```json
// Both custom and new SAP modify OnPress:
"custom": { "OnPress": "/<CUSTOM_DIR>/Rules/MyRule.js" }
"new SAP": { "OnPress": "/SAPAssetManager/Rules/NewRule.js", "Caption": "$(L,done)" }

// "Prioritize custom + integrate new" result:
"resolved": {
  "OnPress": "/<CUSTOM_DIR>/Rules/MyRule.js",   ← your rule preserved
  "Caption": "$(L,done)"                          ← new SAP property added
}
```

---

## Phase 5 — Upgrade custom files, auto-merge CIM, and verify

**Step 1 — Extract new SAPAssetManager ZIP to temp:**
```bash
unzip -o <NEW_SAP_ZIP> "SAPAssetManager/*" -d /tmp/new_ssam
echo "New version extracted to /tmp/new_ssam"
```

**Step 2 — Identify which custom files need upgrading:**

Read CIM `overrides` attribute to find every custom rule and the SAP file it overrides.
Compare old SAP standard vs new SAP standard — if changed, the custom file needs upgrading.

```python
import xml.etree.ElementTree as ET, subprocess, os

tree = ET.parse(CIM_FILE)
needs_upgrade = []

for rule in tree.findall(".//Rule"):
    custom_path    = rule.get("path", "")       # /ZEquinorSSAM/Rules/X.js
    overrides_path = rule.get("overrides", "")  # /SAPAssetManager/Rules/X.js
    if not overrides_path or CUSTOM_NAME not in custom_path:
        continue
    old_sap = "." + overrides_path              # current workspace SAP file
    new_sap = "/tmp/new_ssam" + overrides_path  # new version SAP file
    if not os.path.exists(new_sap):
        continue
    diff = subprocess.run(["diff", old_sap, new_sap], capture_output=True)
    if diff.returncode != 0:
        needs_upgrade.append({
            "name":    rule.get("name"),
            "custom":  "." + custom_path,
            "old_sap": old_sap,
            "new_sap": new_sap
        })

print(f"{len(needs_upgrade)} custom files need upgrading")
for r in needs_upgrade:
    print(f"  {r['name']}")
```

**Step 3 — 3-way merge each custom file:**

The correct approach: start from the new SAP 2305 base, apply only the custom delta on top.

```
BASE:   old SAP 2205 WorkOrders_Detail.js  (what custom was written against)
THEIRS: custom 2205 WorkOrders_Detail.js   (your changes on top of 2205)
OURS:   new SAP 2305 WorkOrders_Detail.js  (new foundation)

Result: 2305 base + only your custom changes applied on top
```

```python
import shutil

def upgrade_custom_rule(old_sap, custom_file, new_sap):
    """
    Merge result is always written back to the custom project file.
    custom_file path is e.g. ./ZEquinorSSAM/Rules/WorkOrders/WorkOrders_Detail.js
    """
    # Ensure the custom project directory exists
    os.makedirs(os.path.dirname(custom_file), exist_ok=True)

    # Check if developer made any custom changes at all
    delta = subprocess.run(["diff", old_sap, custom_file], capture_output=True)
    if delta.returncode == 0:
        # No custom changes — take new SAP file, save to custom project
        shutil.copy(new_sap, custom_file)
        print(f"  No custom delta — 2305 SAP file saved to {custom_file}")
        return "no_custom_changes"

    # 3-way merge:
    #   ancestor = old SAP 2205 (common base)
    #   ours     = new SAP 2305 (new foundation to start from)
    #   theirs   = custom file  (changes to apply on top)
    # Result is written directly into the custom project file
    shutil.copy(new_sap, custom_file)  # start from 2305 base in custom file
    result = subprocess.run([
        "git", "merge-file", "--stdout",
        custom_file,  # new SAP 2305 base (now in custom project)
        old_sap,      # old SAP 2205 (common ancestor)
        custom_file   # your custom changes to apply on top
    ], capture_output=True, text=True)

    # Write merged result back to custom project file
    with open(custom_file, "w") as f:
        f.write(result.stdout)

    if result.returncode == 0:
        print(f"  Clean merge saved → {custom_file}")
        return "clean_merge"
    else:
        n = result.stdout.count("<<<<<<<")
        print(f"  {n} conflict(s) — resolve manually in {custom_file}")
        return "has_conflicts"

clean, no_change, conflicts = [], [], []
for r in needs_upgrade:
    # custom_file path already points into <CUSTOM_DIR> — written back there
    status = upgrade_custom_rule(r["old_sap"], r["custom"], r["new_sap"])
    (clean if status == "clean_merge"
     else no_change if status == "no_custom_changes"
     else conflicts).append(r["name"])

print(f"\nResults written to <CUSTOM_DIR>:")
print(f"  Clean merges (2305 base + custom delta): {len(clean)}")
print(f"  No custom delta (2305 SAP saved):        {len(no_change)}")
print(f"  Conflicts needing manual resolution:     {len(conflicts)}")
if conflicts:
    print(f"\nResolve conflict markers in these files inside <CUSTOM_DIR>:")
    for name in conflicts:
        r = next(x for x in needs_upgrade if x["name"] == name)
        print(f"  {r['custom"]}")

print(f"\nClean merges (2305 base + custom delta): {len(clean)}")
print(f"No custom delta (2305 SAP taken):        {len(no_change)}")
print(f"Conflicts needing manual review:         {len(conflicts)}")
```

**Outcome per file:**

| Scenario | Result |
|---|---|
| Developer made no custom changes | New SAP 2305 file used directly |
| Custom changes on different lines from SAP 2305 changes | Clean — 2305 base with your custom logic on top |
| Both custom and SAP 2305 changed the same lines | Conflict markers in file — manual resolution needed |

**Resolving conflicts:**
```
<<<<<<< 2305 SAP base (new SAP logic)
  SAPs new implementation of these lines
=======
  Your custom implementation
>>>>>>> custom

Keep SAP 2305 new logic as the foundation.
Re-apply your custom intent on top without breaking the new SAP logic.
```

**Step 4 — Auto-merge CIM file:**

Run the CIM auto-merge from Phase 4:
- Keep custom `path` entries (your rules)
- Take SAP standard entries from new version
- Add new SAP rules introduced in 2305
- Drop rules removed from 2305

**Step 5 — Verify and validate:**
```bash
# Confirm no custom files are missing
find ./<CUSTOM_DIR>/Rules -name "*.js" | sort > /tmp/rules_after.txt
grep -o 'path="[^"]*"' <CIM_FILE> | grep -v SAPAssetManager | \
  sed 's/path=".*\/\([^/]*\)\.js"/\1/' | sort > /tmp/cim_after.txt
echo "=== Missing from CIM ===" && comm -23 /tmp/rules_after.txt /tmp/cim_after.txt
echo "=== Stale CIM entries ===" && comm -13 /tmp/rules_after.txt /tmp/cim_after.txt

# Validate
npx @sap/mdk-tools validate --project <workspace_root>
```

BLOCKING if validate errors or unresolved conflicts remain.

## Phase 6 — Post-upgrade checklist

- [ ] All `<CUSTOM_DIR>` customisations present in merged output
- [ ] Every `.js` in `<CUSTOM_DIR>/Rules/` has a CIM entry
- [ ] No stale CIM entries for removed rules
- [ ] CIM `path` attributes use correct custom project folder name
- [ ] `mdk_manage validate` → 0 errors
- [ ] `ApplicationVersion` bumped in `.project.json`
        (MAJOR version if schema changed)
- [ ] Offline app: `OnWillUpdate` + `OnDidUpdate` implemented
        (see `mdk-app-update` skill)
- [ ] Deploy: DEV → test → QA → PROD
        (see `mdk-environment-deploy` skill)

---

## Related skills
- `mdk-ssam-patterns` — day-to-day SSAM conventions, CIM entries for new rules
- `mdk-app-update` — OnWillUpdate/OnDidUpdate for schema-breaking upgrades
- `mdk-environment-deploy` — deploy upgraded app to dev/QA/prod
