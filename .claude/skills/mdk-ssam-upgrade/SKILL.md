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

Use the actual values from Phase 1 output. Build the BLOCKING message dynamically:

```javascript
// After Phase 1 script runs, read its output and build the BLOCKING message
const msg = [
  "BLOCKING: Detected your workspace:",
  "  Standard: " + sap_dir + " (version: " + current_version + ")",
  "  Custom:   " + custom_dir,
  "  CIM:      " + cim_file,
  "",
  "I need ONE thing from you:",
  "  Path to the new SAPAssetManager ZIP (latest SAP release to upgrade to).",
  "",
  "Don't have it?",
  "  Download from: https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER",
  "  → Select your target version → Download metadata ZIP"
].join("\n");
console.log(msg);
```

Surface this as a BLOCKING question to the user. Wait for the ZIP path before continuing.

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

## Phase 5 — Upgrade custom files and produce output ZIP

**The existing custom project is never modified.**
All upgraded files are written to a temp folder and packaged into a new ZIP.
The developer unzips this alongside the new SAPAssetManager version.

**Step 1 — Extract new SAPAssetManager from ZIP:**

```javascript
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const AdmZip  = require("adm-zip");

const newSapZip  = String.raw`<NEW_SAP_ZIP>`;
const workDir    = path.join(os.tmpdir(), "ssam_upgrade_" + Date.now());
const newSapDir  = path.join(workDir, "new_sap");
const outputDir  = path.join(workDir, "output");

fs.mkdirSync(newSapDir,  { recursive: true });
fs.mkdirSync(outputDir,  { recursive: true });

const zip = new AdmZip(newSapZip);
zip.getEntries()
   .filter(e => e.entryName.includes("SAPAssetManager"))
   .forEach(e => zip.extractEntryTo(e, newSapDir, true, true));

console.log("New SAP extracted to: " + newSapDir);
```

**Step 2 — Identify CIM-registered files that need upgrading:**

```javascript
const cimFile   = String.raw`<cim_file>`;
const customDir = String.raw`<custom_dir>`;
const sapDir    = String.raw`<sap_dir>`;

const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const needsUpgrade = [];
const unchanged    = [];

for (const ip of (cim.IntegrationPoints || [])) {
  const source = ip.Source || "";  // /ZEquinorSSAM/Rules/WorkOrders/X.js
  const target = ip.Target || "";  // /SAPAssetManager/Rules/WorkOrders/X.js
  if (!source || !target || source.includes("SAPAssetManager")) continue;

  const customFile = path.join(projectDir, source.replace(/^\//, ""));
  const oldSapFile = path.join(projectDir, target.replace(/^\//, ""));
  const newSapFile = path.join(newSapDir,  target.replace(/^\//, ""));

  if (!fs.existsSync(oldSapFile) || !fs.existsSync(newSapFile)) continue;

  const oldContent = fs.readFileSync(oldSapFile, "utf8");
  const newContent = fs.readFileSync(newSapFile, "utf8");

  if (oldContent === newContent) {
    unchanged.push({ source, customFile, newSapFile });
  } else {
    needsUpgrade.push({ name: path.basename(source, ".js"), source, target, customFile, oldSapFile, newSapFile });
  }
}

console.log("Needs upgrade: " + needsUpgrade.length);
console.log("Unchanged SAP base: " + unchanged.length);
```

**Step 3 — Upgrade each file into output folder (never touch existing custom project):**

```javascript
function recalcImports(src, outputFile, newSapDir) {
  const fileDir = path.dirname(outputFile);
  return src.replace(
    /from\s+['"]((\.\.\/)+(?:SAPAssetManager\/[^'"]+))['"]/g,
    (match, importPath) => {
      const resolved = path.resolve(fileDir, importPath);
      if (!resolved.startsWith(path.resolve(newSapDir))) return match;
      const newRel = path.relative(fileDir, resolved).replace(/\/g, "/");
      return `from '${newRel.startsWith(".") ? newRel : "./" + newRel}'`;
    }
  );
}

function upgradeFile(ip) {
  const { source, customFile, oldSapFile, newSapFile } = ip;
  const customSrc  = fs.readFileSync(customFile,  "utf8");
  const oldSap     = fs.readFileSync(oldSapFile,  "utf8");
  const newSap     = fs.readFileSync(newSapFile,  "utf8");

  // Output path mirrors source path inside output folder
  const outputFile = path.join(outputDir, source.replace(/^\//, ""));
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  // No custom changes — take new SAP file directly
  if (oldSap === customSrc) {
    const updated = recalcImports(newSap, outputFile, newSapDir);
    fs.writeFileSync(outputFile, updated);
    return "no_custom_changes";
  }

  // Find custom additions (lines in custom not in old SAP)
  const oldSet = new Set(oldSap.split("
").map(l => l.trim()).filter(Boolean));
  const customLines = customSrc.split("
");
  const newLines    = newSap.split("
");
  const customAdditions = customLines.filter(l => l.trim() && !oldSet.has(l.trim()));
  const newSet = new Set(newLines.map(l => l.trim()).filter(Boolean));
  const uniqueCustom = customAdditions.filter(l => !newSet.has(l.trim()));

  // New SAP file as base + custom additions appended
  const result = [...newLines];
  if (uniqueCustom.length > 0) {
    result.push("", "// --- Custom additions (upgraded) ---");
    result.push(...uniqueCustom);
  }

  const updated = recalcImports(result.join("
"), outputFile, newSapDir);
  fs.writeFileSync(outputFile, updated);
  return "upgraded";
}

const results = { upgraded: [], no_change: [], failed: [] };
for (const r of needsUpgrade) {
  try {
    const status = upgradeFile(r);
    (status === "no_custom_changes" ? results.no_change : results.upgraded).push(r.name);
  } catch(e) {
    results.failed.push({ name: r.name, error: e.message });
  }
}

// Copy unchanged CIM-registered files to output (new SAP base)
for (const r of unchanged) {
  const outputFile = path.join(outputDir, r.source.replace(/^\//, ""));
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.copyFileSync(r.newSapFile, outputFile);
}

// Carry forward all files in custom project NOT in CIM
// These are standalone additions (new features, helpers, utilities)
// They don't override anything in SAPAssetManager — copy as-is, no upgrade needed
const cimSources = new Set(
  (cim.IntegrationPoints || [])
    .map(ip => path.resolve(projectDir, (ip.Source || "").replace(/^\//, "")))
);

function copyNonCimFiles(srcDir, relBase) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const relPath = path.join(relBase, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "Services") return; // handled separately below
      copyNonCimFiles(srcPath, relPath);
    } else if (!cimSources.has(path.resolve(srcPath))) {
      // Not in CIM — standalone addition, carry forward unchanged
      const outFile = path.join(outputDir, relPath);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.copyFileSync(srcPath, outFile);
    }
  }
}

copyNonCimFiles(customDir, path.basename(customDir));
console.log("✅ Standalone (non-CIM) files carried forward as-is");

// Always replace Services/ folder entirely from new SAP version
// Services/ contains OData metadata — never customised, must be latest version
const newServicesDir = path.join(newSapDir, "SAPAssetManager", "Services");
const outServicesDir = path.join(outputDir, path.basename(customDir), "Services");

if (fs.existsSync(newServicesDir)) {
  fs.mkdirSync(outServicesDir, { recursive: true });
  function copyDir(src, dst) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(dstPath, { recursive: true });
        copyDir(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }
  copyDir(newServicesDir, outServicesDir);
  console.log("✅ Services/ updated from new SAP version → " + outServicesDir);
} else {
  console.log("⚠ Services/ not found in new SAP ZIP — skipping");
}

console.log("Upgraded: " + results.upgraded.length);
console.log("No custom delta: " + results.no_change.length);
console.log("Failed: " + results.failed.length);
```

**Step 4 — Auto-merge CIM and write to output folder:**

Read current CIM, merge with new SAP CIM entries, write to output folder:

```javascript
const cimData    = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const newCimFile = path.join(newSapDir, "SAPAssetManager", path.basename(cimFile));
const outputCim  = path.join(outputDir, path.basename(cimFile));

const customEntries = (cimData.IntegrationPoints || [])
  .filter(ip => !ip.Source.includes("SAPAssetManager"));
const newCim = fs.existsSync(newCimFile)
  ? JSON.parse(fs.readFileSync(newCimFile, "utf8")) : { IntegrationPoints: [] };
const sapEntries = (newCim.IntegrationPoints || [])
  .filter(ip => ip.Source.includes("SAPAssetManager"));

cimData.IntegrationPoints = [...customEntries, ...sapEntries];
fs.writeFileSync(outputCim, JSON.stringify(cimData, null, 4));
console.log("CIM merged → " + outputCim);
```

**Step 5 — Package output folder into ZIP:**

```javascript
const outputZip = path.join(
  path.dirname(customDir),
  path.basename(customDir) + "_upgraded_" + new Date().toISOString().slice(0,10) + ".zip"
);

const outZip = new AdmZip();
outZip.addLocalFolder(outputDir, path.basename(customDir));
outZip.writeZip(outputZip);

console.log("\n✅ Upgraded ZIP created: " + outputZip);
console.log("   Contains: " + results.upgraded.length + " upgraded files, " +
            results.no_change.length + " unchanged, " + results.failed.length + " failed");
console.log("\nNext steps:");
console.log("  1. Extract " + path.basename(outputZip) + " alongside your new SAPAssetManager folder");
console.log("  2. Open the extracted folder in VS Code with the new SAPAssetManager");
console.log("  3. Run mdk_manage validate to confirm 0 errors");
console.log("  4. Deploy to DEV for testing before promoting to QA/PROD");
```

**Existing custom project at `<customDir>` is completely untouched.**

## Phase 6 — Post-upgrade checklist

**The upgraded ZIP has been delivered. Existing custom project is completely untouched.**

**What the ZIP contains:**
- CIM-registered files — upgraded (new SAP base + your custom logic applied on top)
- Non-CIM files — carried forward as-is (standalone additions, new features you built)
- `Services/` folder — replaced entirely from new SAP version (latest OData metadata)
- Updated CIM file — your custom entries kept + new SAP standard entries merged in

**Path to ZIP:** `<CUSTOM_NAME>_upgraded_<date>.zip` — same folder as existing custom project.

**Developer steps:**
- [ ] Extract the ZIP alongside your new `SAPAssetManager/` folder
- [ ] Open VS Code with: new `SAPAssetManager/` + extracted `<CUSTOM_NAME>/` in same workspace
- [ ] Run `mdk_manage validate` → must be 0 errors
- [ ] Bump `ApplicationVersion` in `.project.json` (MAJOR if schema changed)
- [ ] Offline app: implement `OnWillUpdate` + `OnDidUpdate` — see `mdk-app-update` skill
- [ ] Deploy DEV → test → QA → PROD — see `mdk-environment-deploy` skill

**Old project** at `<customDir>` is safe to compare against or roll back to at any time.

---

## Related skills
- `mdk-ssam-patterns` — day-to-day SSAM conventions, CIM entries for new rules
- `mdk-app-update` — OnWillUpdate/OnDidUpdate for schema-breaking upgrades
- `mdk-environment-deploy` — deploy upgraded app to dev/QA/prod
