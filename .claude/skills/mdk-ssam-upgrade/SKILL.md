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

Guides the complete SSAM metadata upgrade

## Execution rules (read first)

- **Git is optional** — not required. The upgrade creates new files using pure Node.js (fs module). No merge tools needed.
- **Never inspect or list folder contents** — only read the specific files needed
- **Never run ls, dir, tree, or find on the workspace** outside of the targeted searches defined in each phase
- **Never ask the user to confirm bash/python steps** — run them silently
- **Show the user only:** phase completion lines, BLOCKING questions, and final results
- The user wants the upgrade done — not a tour of their folder structure

 using the SAP Metadata Upgrade Tool.
The tool merges your customised metadata with the new SAP out-of-box release.

**Developer provides:** Only the new `SAPAssetManager` ZIP (latest SAP release).
**Everything else is read from the workspace automatically.**

---

## Phase 1 — Detect workspace (one script, silent, no folder browsing)

**Rules:**
- Run as ONE script. Do not run multiple bash/ls/dir commands.
- Do not browse the GIT root or any parent folder.
- Do not look for ZIPs of the custom project — it is always a folder.
- Do not inspect folder contents beyond what is needed.
- Only ask the user if `SAPAssetManager/` or the CIM-derived custom folder cannot be located.

```javascript
// Node.js — runs on Windows without python/python3 ambiguity
const fs   = require("fs");
const path = require("path");

const projectDir = String.raw`<projectDir>`;  // from agent brief

// Step 1 — SAPAssetManager must be a direct subfolder of projectDir
const sapDir = path.join(projectDir, "SAPAssetManager");
const sapFound = fs.existsSync(sapDir) && fs.statSync(sapDir).isDirectory();

// Step 2 — CIM file at root of SAPAssetManager (one level only)
let cimFile = null;
if (sapFound) {
  for (const f of fs.readdirSync(sapDir)) {
    if (f.toLowerCase().endsWith(".cim")) {
      cimFile = path.join(sapDir, f);
      break;
    }
  }
}

// Step 3 — Derive custom project name from CIM IntegrationPoints[].Source
// Source entries look like: "/ZEquinorSSAM/Rules/WorkOrders/X.js"
// → top-level folder = "ZEquinorSSAM"
let customName = null;
let customDir  = null;
if (cimFile) {
  try {
    const cim  = JSON.parse(fs.readFileSync(cimFile, "utf8"));
    const names = (cim.IntegrationPoints || [])
      .map(ip => (ip.Source || "").replace(/^\//, "").split("/")[0])
      .filter(n => n && n !== "SAPAssetManager");
    if (names.length) {
      // Most frequent name = custom project folder
      customName = names.sort((a,b) =>
        names.filter(x=>x===b).length - names.filter(x=>x===a).length)[0];
      // Custom project sits alongside SAPAssetManager — same parent folder
      customDir = path.join(projectDir, customName);
      if (!fs.existsSync(customDir)) customDir = null;
    }
  } catch(e) { /* CIM parse error — will BLOCK below */ }
}

// Step 4 — Current version from SAPAssetManager/Application.app
let currentVersion = "unknown";
if (sapFound) {
  try {
    const app = JSON.parse(fs.readFileSync(path.join(sapDir,"Application.app"),"utf8"));
    currentVersion = app.ApplicationVersion || app._ApplicationVersion || "unknown";
  } catch(_) {}
}

console.log("sap_dir="    + (sapFound  ? sapDir      : "NOT_FOUND"));
console.log("cim_file="   + (cimFile   ? cimFile     : "NOT_FOUND"));
console.log("custom_name="+ (customName? customName  : "NOT_FOUND"));
console.log("custom_dir=" + (customDir ? customDir   : "NOT_IN_PROJECT_DIR"));
console.log("current_version=" + currentVersion);
```

**After script runs — act on results immediately:**

| Result | Action |
|---|---|
| `sap_dir=NOT_FOUND` | Reply: "SAPAssetManager/ not found in `<projectDir>`. Please provide the full path to your SAPAssetManager folder or the folder that contains it." Re-run Phase 1 with the new path. |
| `cim_file=NOT_FOUND` | Reply: "No .CIM file found in SAPAssetManager/. Please confirm the CIM file location." |
| `custom_name=NOT_FOUND` | Reply: "No custom project entries found in CIM. Please provide the name of your custom project folder." |
| `custom_dir=NOT_IN_PROJECT_DIR` | Reply: "Custom project folder `<custom_name>` not found alongside SAPAssetManager/ in `<projectDir>`. Please provide the full path to your `<custom_name>` folder, or reply 'create' to scaffold it." |
| All found | Print one line: `✓ SAPAssetManager/ (v<currentVersion>) · CIM: <cimFile> · Custom: <customDir>` → proceed to Phase 2. |

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

## Phase 3 — CIM pre-audit (one Node.js script, silent)

**The CIM file is the source of truth for what needs upgrading.**
Only files listed in CIM `IntegrationPoints[].Source` are upgrade candidates.
New files in the custom project with no CIM entry are standalone additions —
they do NOT override anything in SAPAssetManager and are ignored during upgrade.

Run silently. Do not show individual commands to the user.

```javascript
const fs   = require("fs");
const path = require("path");

const cimFile   = String.raw`<cim_file>`;
const customDir = String.raw`<custom_dir>`;

const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const entries = (cim.IntegrationPoints || [])
  .filter(ip => ip.Source && ip.Target && !ip.Source.includes("SAPAssetManager"));

// Validate each CIM entry — check the custom file actually exists
const valid   = [];
const missing = [];

for (const ip of entries) {
  // Source path comes directly from CIM — use it relative to projectDir
  const fullPath = path.join(projectDir, ip.Source.replace(/^\//, ""));
  if (fs.existsSync(fullPath)) {
    valid.push({ source: ip.Source, target: ip.Target, file: fullPath });
  } else {
    missing.push(ip.Source);
  }
}

console.log("cim_entries=" + entries.length);
console.log("valid="       + valid.length);
console.log("missing="     + JSON.stringify(missing));
```

**After script runs:**
- `missing` not empty → BLOCKING: "These CIM entries point to files that don't exist in `<customDir>`: `<list>`. Were these files deleted or moved? Remove stale CIM entries or provide correct paths before continuing."
- All valid → print `✓ CIM pre-audit: <n> entries validated` → proceed to Phase 4

**Note:** Files in `<customDir>` that have NO CIM entry are standalone additions
(new features, helpers, utilities). They are not touched during the upgrade.

## Phase 4 — Metadata Upgrade Tool workflow

```
Tool: SAP Service and Asset Manager Metadata Upgrade Tool
Type: Cross-platform Electron app (macOS / Windows)
Download: https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER
          (requires TEA — Test and Evaluation Agreement)
```

**Step 1 — Prepare the customised ZIP:**

The tool requires two ZIPs. You already have the new version ZIP.
Now create the customised ZIP from your workspace:

```javascript
// Create customised ZIP using Node.js — no bash zip command needed
const fs       = require("fs");
const path     = require("path");
const archiver = require("archiver"); // bundled with Claude Code environment

const sapDir    = String.raw`<sap_dir>`;
const customDir = String.raw`<custom_dir>`;
const outZip    = path.join(require("os").tmpdir(), "customised_ssam.zip");

const output  = fs.createWriteStream(outZip);
const archive = archiver("zip", { zlib: { level: 6 } });
archive.pipe(output);
archive.directory(sapDir,    "SAPAssetManager");
archive.directory(customDir, path.basename(customDir));
archive.finalize();
output.on("close", () => console.log("Created: " + outZip + " (" + archive.pointer() + " bytes)"));
```

This ZIP contains your current SAPAssetManager (baseline) and custom project.

**Step 1b — Upload both ZIPs:**
```
Launch the Metadata Upgrade Tool (Electron app)
→ click Upload

  Customised metadata ZIP: /tmp/customised_ssam.zip
    (your current SAPAssetManager + <CUSTOM_DIR> combined)

  New version ZIP: <NEW_SAP_ZIP>
    (the new SAP release downloaded from SAP Help Portal)

→ click Upload to start processing
```

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

```javascript
// Auto-merge CIM: keep custom entries, take SAP standard entries from new version
const fs   = require("fs");
const path = require("path");

const cimFile    = String.raw`<cim_file>`;
const newCimFile = path.join(require("os").tmpdir(), "new_ssam", "SAPAssetManager",
                             path.basename(cimFile));

const current = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const newVer  = fs.existsSync(newCimFile)
              ? JSON.parse(fs.readFileSync(newCimFile, "utf8")) : { IntegrationPoints: [] };

const customEntries = (current.IntegrationPoints || [])
  .filter(ip => !ip.Source.includes("SAPAssetManager"));
const sapEntries = (newVer.IntegrationPoints || [])
  .filter(ip => ip.Source.includes("SAPAssetManager"));

current.IntegrationPoints = [...customEntries, ...sapEntries];
fs.writeFileSync(cimFile, JSON.stringify(current, null, 4));
console.log("CIM merged: " + customEntries.length + " custom + " + sapEntries.length + " SAP entries");
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

**All scripts run silently using Node.js. No bash commands. No user confirmation per step.**

**Step 1 — Extract new SAPAssetManager from ZIP:**

```javascript
const AdmZip = require("adm-zip");
const path   = require("path");
const os     = require("os");

const newSapZip  = String.raw`<NEW_SAP_ZIP>`;   // from Phase 2
const extractDir = path.join(os.tmpdir(), "new_ssam");

const zip     = new AdmZip(newSapZip);
const entries = zip.getEntries().filter(e => e.entryName.includes("SAPAssetManager"));
entries.forEach(e => zip.extractEntryTo(e, extractDir, true, true));
console.log("Extracted " + entries.length + " files to " + extractDir);
```

**Step 2 — Identify CIM-registered files that need upgrading:**

**Only process files listed in the CIM.** Files in the custom project with no CIM entry
are standalone additions — skip them entirely.

```javascript
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const cimFile    = String.raw`<cim_file>`;
const projectDir = String.raw`<projectDir>`;  // workspace root
const newSapZip  = String.raw`<NEW_SAP_ZIP>`; // extracted to /tmp/new_ssam

const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const needsUpgrade = [];
const unchanged    = [];
const skipped      = [];

for (const ip of (cim.IntegrationPoints || [])) {
  const source = ip.Source || "";  // e.g. /ZEquinorSSAM/Rules/WorkOrders/X.js
  const target = ip.Target || "";  // e.g. /SAPAssetManager/Rules/WorkOrders/X.js

  if (!source || !target || source.includes("SAPAssetManager")) continue;

  // Paths come directly from CIM — no folder scanning needed
  const customFile = path.join(projectDir, source.replace(/^\//, ""));
  const oldSapFile = path.join(projectDir, target.replace(/^\//, ""));
  const newSapFile = path.join(os.tmpdir(), "new_ssam", target.replace(/^\//, ""));

  if (!fs.existsSync(oldSapFile) || !fs.existsSync(newSapFile)) {
    skipped.push(source);
    continue;
  }

  const oldContent = fs.readFileSync(oldSapFile, "utf8");
  const newContent = fs.readFileSync(newSapFile, "utf8");

  if (oldContent === newContent) {
    unchanged.push(source);
  } else {
    needsUpgrade.push({ name: path.basename(source, ".js"), customFile, oldSapFile, newSapFile });
  }
}

console.log("CIM entries: " + (needsUpgrade.length + unchanged.length + skipped.length));
console.log("Needs upgrade: " + needsUpgrade.length);
console.log("Unchanged: " + unchanged.length);
console.log("Skipped (file missing): " + skipped.length);
needsUpgrade.forEach(r => console.log("  → " + r.name));
```

**Step 3 — Create upgraded custom files:**

For each CIM-registered file — create a new version based on the new SAP standard,
with the custom logic carried forward. No merge tool needed.

```javascript
const fs   = require("fs");
const path = require("path");

function recalcImports(src, customFile, sapDir) {
  // Fix import paths — custom files use absolute paths to SAPAssetManager
  // Recalculate relative path from the custom file's location to each SAP module
  const customFileDir = path.dirname(customFile);
  return src.replace(
    /from\s+['"]((\.\.\/)+(?:SAPAssetManager\/[^'"]+))['"]/g,
    (match, importPath) => {
      const resolved = path.resolve(customFileDir, importPath);
      if (!resolved.startsWith(path.resolve(sapDir))) return match;
      const newRel = path.relative(customFileDir, resolved).replace(/\\/g, "/");
      return `from '${newRel.startsWith(".") ? newRel : "./" + newRel}'`;
    }
  );
}

function upgradeFile(oldSapFile, customFile, newSapFile, sapDir) {
  const oldSap    = fs.readFileSync(oldSapFile, "utf8");
  const customSrc = fs.readFileSync(customFile,  "utf8");
  const newSap    = fs.readFileSync(newSapFile,  "utf8");

  // No custom changes at all — take new SAP file directly
  if (oldSap === customSrc) {
    const updated = recalcImports(newSap, customFile, sapDir);
    fs.writeFileSync(customFile, updated);
    return "no_custom_changes";
  }

  // Identify custom lines — lines in customSrc that differ from oldSap
  const oldLines    = oldSap.split("\n");
  const customLines = customSrc.split("\n");
  const newLines    = newSap.split("\n");

  // Build a map of line index → custom content for lines the developer changed
  const customDelta = new Map();
  const maxOld = Math.max(oldLines.length, customLines.length);
  for (let i = 0; i < maxOld; i++) {
    if ((customLines[i] ?? "") !== (oldLines[i] ?? "")) {
      customDelta.set(i, customLines[i] ?? "");
    }
  }

  // Start from new SAP file, overlay custom changes at same line positions
  const result = [...newLines];
  for (const [i, customLine] of customDelta) {
    if (i < result.length) {
      result[i] = customLine;   // replace with custom version
    } else {
      result.push(customLine);  // append if beyond new SAP file length
    }
  }

  // Fix import paths in the result
  const updated = recalcImports(result.join("\n"), customFile, sapDir);
  fs.writeFileSync(customFile, updated);
  return "upgraded";
}

// Process all CIM-registered files
const results = { upgraded: [], no_change: [], failed: [] };
for (const r of needsUpgrade) {
  try {
    const status = upgradeFile(r.oldSapFile, r.customFile, r.newSapFile, sapDir);
    if (status === "no_custom_changes") results.no_change.push(r.name);
    else                                results.upgraded.push(r.name);
  } catch (e) {
    results.failed.push({ name: r.name, error: e.message });
  }
}

console.log("Upgraded (new SAP base + custom logic): " + results.upgraded.length);
console.log("No custom delta (new SAP taken directly): " + results.no_change.length);
console.log("Failed: " + results.failed.length);
if (results.failed.length > 0)
  results.failed.forEach(r => console.log("  FAILED: " + r.name + " — " + r.error));
```

**What this does per file:**

| Case | Result |
|---|---|
| No custom changes vs old SAP | New SAP file taken directly, import paths adjusted |
| Custom changes exist | New SAP file created, custom logic overlaid at same line positions, import paths adjusted |

No git. No merge-file. No conflict markers. Just a new file created for each CIM entry.


**What this does per file:**
1. 3-way merge (base=old SAP, custom=your changes, new=new SAP) line by line
2. Import path style differences (relative vs absolute, same module) → keep custom version, no conflict
3. After clean merge → `recalcImports()` recalculates every `../../../../SAPAssetManager/...`
   import to the correct relative path from the custom file's location
4. Genuine conflicts (both custom and SAP changed the same logic lines) → conflict markers written


**Only genuine conflicts are flagged** — where both the developer AND SAP changed the same
lines to different logic. Import path style differences are resolved automatically in favour
of the custom version (absolute paths).

**Step 3b — Add CIM entries for every upgraded file:**

```javascript
// After merge — ensure every upgraded file has a CIM entry
const cimData = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const existingSources = new Set((cimData.IntegrationPoints||[]).map(ip=>ip.Source));

for (const r of needsUpgrade) {
  const source = "/" + path.relative(path.dirname(customDir), r.customFile).replace(/\\/g,"/");
  const target = "/" + path.relative(path.dirname(sapDir),    r.oldSapFile).replace(/\\/g,"/");
  if (!existingSources.has(source)) {
    cimData.IntegrationPoints = cimData.IntegrationPoints || [];
    cimData.IntegrationPoints.push({ Source: source, Target: target });
    console.log("Added CIM entry: " + source);
  }
}
fs.writeFileSync(cimFile, JSON.stringify(cimData, null, 4));
console.log("CIM updated");
```

**Step 4 — Auto-merge CIM file (SAP standard entries):**
- Keep: entries where Source contains custom project name
- Take: SAP standard entries from new version
- Add: new SAP rules introduced in new version
- Drop: rules removed from new version

**Step 5 — Validate:**
```
mcp__mdk__mdk-manage { "folderRootPath": "<customDir>", "operation": "validate" }
```
Result must be 0 errors. If errors remain → BLOCKING with error list.

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
