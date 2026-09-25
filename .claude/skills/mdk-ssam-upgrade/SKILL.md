---
name: mdk-ssam-upgrade
version: 0.5.0
description: >
  Use when upgrading SAP Service and Asset Manager (SSAM) to a new version using the
  Automated SSAM upgrade — workspace detection, CIM pre-audit, file upgrade with
  conflict handling in plain English, output ZIP production. Fully executable — follow
  each phase in order. Trigger on: "SSAM upgrade", "SAP Asset Manager upgrade", "upgrade SSAM",
  "SSAM 2305", "SSAM 2210", "SAPAssetManager upgrade", "merge custom metadata",
  "upgrade metadata ZIP", "3-way merge MDK", "new SAPAssetManager version",
  "SSAM customisation upgrade", "merge SSAM customisations".
source: SAP Service and Asset Manager Upgrade Guide 2305
---

# SSAM Upgrade Workflow

## What this skill does

Guides the complete SSAM metadata upgrade

## Execution rules (read first)

- **Git is optional** — not required. The upgrade creates new files using pure Node.js (fs module). No merge tools needed.
- **Never inspect or list folder contents** — only read the specific files needed
- **Never run ls, dir, tree, or find on the workspace** outside of the targeted searches defined in each phase
- **Never ask the user to confirm bash/python steps** — run them silently
- **Show the user only:** phase completion lines, BLOCKING questions, and final results
- The user wants the upgrade done — not a tour of their folder structure

 automatically using Node.js — no external tools required.
The tool merges your customised metadata with the new SAP out-of-box release.

**Developer provides:** Only the new `SAPAssetManager` ZIP (latest SAP release).
**Everything else is read from the workspace automatically.**

---

## Phase 1 — Detect workspace (one script, silent, no folder browsing)

**Execute as a single Node.js script using the `Bash` tool with `node` command.**
**Never use `ls`, `dir`, `find`, `cat`, `grep`, or any other bash commands.**
**Save the script to a temp file and run it once — do not improvise individual commands.**

Save to `/tmp/ssam_detect.js` then run `node /tmp/ssam_detect.js`:

```javascript
const fs   = require("fs");
const path = require("path");

const projectDir = process.argv[2] || process.cwd();

// Step 1 — SAPAssetManager must be a direct subfolder of projectDir
const sapDir  = path.join(projectDir, "SAPAssetManager");
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
let customName = null, customDir = null;
if (cimFile) {
  try {
    const cim   = JSON.parse(fs.readFileSync(cimFile, "utf8"));
    const names = (cim.IntegrationPoints || [])
      .map(ip => (ip.Source || "").replace(/^\//, "").split("/")[0])
      .filter(n => n && n !== "SAPAssetManager");
    if (names.length) {
      customName = names.sort((a,b) =>
        names.filter(x=>x===b).length - names.filter(x=>x===a).length)[0];
      customDir = path.join(projectDir, customName);
      if (!fs.existsSync(customDir)) customDir = null;
    }
  } catch(e) { /* CIM parse error */ }
}

// Step 4 — Current version from Application.app
let currentVersion = "unknown";
if (sapFound) {
  try {
    const app = JSON.parse(fs.readFileSync(path.join(sapDir, "Application.app"), "utf8"));
    currentVersion = app.ApplicationVersion || "unknown";
  } catch(_) {}
}

console.log("sap_dir="         + (sapFound   ? sapDir    : "NOT_FOUND"));
console.log("cim_file="        + (cimFile    ? cimFile   : "NOT_FOUND"));
console.log("custom_name="     + (customName ? customName: "NOT_FOUND"));
console.log("custom_dir="      + (customDir  ? customDir : "NOT_IN_PROJECT_DIR"));
console.log("current_version=" + currentVersion);
```

**Run it:**
```
Bash: node /tmp/ssam_detect.js "<projectDir>"
```

**Do NOT run any other commands before or after this. Read the output and act on it.**

**After Phase 5 script runs:**
- Lines starting with `CATEGORY_E:` → surface each one as AskUserQuestion with three options:
  Drop as obsolete / Re-home the customization / Keep as standalone
- Lines starting with `category_b` / `category_c` → log silently, no user action needed
- Report summary: `X upgraded (Category C), Y taken from SAP (Category B), Z Category E decisions`

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
// Source entries look like: "/<CUSTOM_NAME>/Rules/WorkOrders/X.js"
// → top-level folder = "<CUSTOM_NAME>" (derived from most frequent prefix)
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
| `sap_dir=NOT_FOUND` | `BLOCKING: SAPAssetManager/ not found in <projectDir>. Provide the full path to SAPAssetManager/ or the folder containing it.` |
| `cim_file=NOT_FOUND` | `BLOCKING: No .CIM file found in SAPAssetManager/. Please confirm the CIM file location.` |
| `custom_name=NOT_FOUND` | `BLOCKING: No custom project entries in CIM IntegrationPoints. Please provide your custom project folder name.` |
| `custom_dir=NOT_IN_PROJECT_DIR` | `BLOCKING: Custom project "<custom_name>" not found alongside SAPAssetManager/. Provide full path or reply "create" to scaffold it.` |
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

## Phase 3 — CIM pre-audit

**Save the script below to `/tmp/ssam_cim_audit.js` and run:**
```
Bash: node /tmp/ssam_cim_audit.js "<cimFile>" "<customDir>"
```
**Do NOT run any other commands. Do NOT read files individually. Run the script once, read the output.**

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

h should be used?
   → Use the new SSAM version (recommended if you are not sure)
   → Keep my custom version
   → Keep both — add my custom lines after the new SSAM version"
```

## Phase 4 — Upgrade custom files and produce output ZIP

**CRITICAL — READ BEFORE RUNNING:**
- **NEVER modify, backup, replace, or delete any file in the existing workspace**
- **NEVER touch `SAPAssetManager/`** — it is read-only source material
- **NEVER touch `<CUSTOM_DIR>/`** — it is read-only source material
- All output goes to a **new temp folder** (`outputDir`) and then into a **ZIP file**
- The existing project stays 100% untouched — the developer uses the ZIP for the new version

**Ask Q1 (save location) and Q2 (zip or folder) BEFORE running this script.**

**Save the script below to `C:\\Temp\\ssam_upgrade.js` (Windows) or `/tmp/ssam_upgrade.js` (Mac/Linux) and run:**
```
Bash: node <script_path> "<cimFile>" "<customDir>" "<sapDir>" "<newSapZip>" "<projectDir>" "<outputPath>" "<format>"
```
- `<outputPath>` = developer's chosen save location from Q1 (never a temp/scratchpad folder)
- `<format>` = `zip` or `folder` from Q2

**Do NOT run any other commands. Run the script once — it saves directly to the developer's chosen path.**

**Do NOT call `mdk-create` after upgrade.**
The upgraded Z project already has the correct `.project.json`, `Application.app` and full structure
taken from the new SAP version — calling `mdk-create` would overwrite them with blank defaults
causing file name mismatches and validation errors.

```javascript
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const AdmZip  = require("adm-zip");

// Args: node /tmp/ssam_upgrade.js "<cimFile>" "<customDir>" "<sapDir>" "<newSapZip>" "<projectDir>" "<outputPath>" "<format>"
// outputPath = developer-chosen save location (never a temp/scratchpad folder)
// format     = "zip" or "folder"
const [,, cimFile, customDir, sapDir, newSapZip, projectDir, outputPath, format] = process.argv;
const customName  = path.basename(customDir);
const saveFormat  = (format || "zip").toLowerCase();
const saveTo      = outputPath || path.dirname(customDir); // fallback to same folder as project

// ── Step 1: Extract new SAPAssetManager from ZIP to temp (read-only reference) ──
// Save entire Phase 5 as /tmp/ssam_upgrade.js and run: node /tmp/ssam_upgrade.js
const newSapDir = path.join(os.tmpdir(), "ssam_new_" + Date.now());
fs.mkdirSync(newSapDir, { recursive: true });
const zipIn = new AdmZip(newSapZip);
zipIn.getEntries()
  .filter(e => e.entryName.includes("SAPAssetManager"))
  .forEach(e => zipIn.extractEntryTo(e, newSapDir, true, true));

// Find extracted SAPAssetManager folder
const newSapExtracted = path.join(newSapDir, "SAPAssetManager");
console.log("New SAP extracted to: " + newSapExtracted);

// ── Step 2: Identify CIM-registered files needing upgrade ──
const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const needsUpgrade = [], unchanged = [];

for (const ip of (cim.IntegrationPoints || [])) {
  const source = ip.Source || "";
  const target = ip.Target || "";
  if (!source || !target || source.includes("SAPAssetManager")) continue;

  // Read directly from workspace — no copying
  const customFile = path.join(projectDir, source.replace(/^\//, ""));
  const oldSapFile = path.join(projectDir, target.replace(/^\//, ""));
  const newSapFile = path.join(newSapDir,  target.replace(/^\//, ""));

  if (!fs.existsSync(oldSapFile) || !fs.existsSync(newSapFile)) continue;

  const oldContent = fs.readFileSync(oldSapFile, "utf8");
  const newContent = fs.readFileSync(newSapFile, "utf8");
  if (oldContent === newContent) unchanged.push({ source, customFile, newSapFile });
  else needsUpgrade.push({ name: path.basename(source,".js"), source, target, customFile, oldSapFile, newSapFile });
}
console.log("Needs upgrade: " + needsUpgrade.length + " | Unchanged: " + unchanged.length);

// ── Step 3: Build upgraded files into outputDir ──
const customName = path.basename(customDir);

// Helpers write upgraded files to outputDir — Step 4 packages them into ZIP
function addToZip(zipPath, fileContent) {
  const fullPath = path.join(outputDir, zipPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, fileContent);
}
function addFileToZip(zipPath, srcPath) {
  const fullPath = path.join(outputDir, zipPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.copyFileSync(srcPath, fullPath);
}

// 3a: Upgrade CIM-registered files (new SAP base + custom logic)
function recalcImports(src, zipFilePath, sapDir) {
  const fileDir = path.dirname(path.join("/", zipFilePath));
  return src.replace(
    /from\s+['"]((\.\.\/)+(?:SAPAssetManager\/[^'"]+))['"]/g,
    (match, importPath) => {
      const resolved = path.resolve(fileDir, importPath);
      if (!resolved.startsWith("/SAPAssetManager")) return match;
      const rel = path.relative(fileDir, resolved).replace(/\\/g, "/");
      return `from '${rel.startsWith(".") ? rel : "./" + rel}'`;
    }
  );
}

function upgradeFile(r) {
  const customSrc = fs.readFileSync(r.customFile, "utf8");
  const oldSap    = fs.readFileSync(r.oldSapFile, "utf8");
  const newSap    = fs.readFileSync(r.newSapFile,  "utf8");
  const zipPath   = customName + "/" + r.source.replace(/^\/[^/]+\//, "");

  // Category B: no custom changes — take new SAP directly
  if (oldSap === customSrc) {
    addToZip(zipPath, recalcImports(newSap, zipPath, sapDir));
    return "category_b";
  }

  const oldSet = new Set(oldSap.split("\n").map(l=>l.trim()).filter(Boolean));
  const customAdditions = customSrc.split("\n")
    .filter(l => l.trim() && !oldSet.has(l.trim()));
  const newLines = newSap.split("\n");
  const newSet   = new Set(newLines.map(l=>l.trim()).filter(Boolean));
  const unique   = customAdditions.filter(l => !newSet.has(l.trim()));

  const merged = [...newLines, ...(unique.length ? ["","// --- Custom additions ---",...unique] : [])];
  addToZip(zipPath, recalcImports(merged.join("\n"), zipPath, sapDir));
  // Category C: clean merge — custom additions appended to new SAP base
  // If same lines changed in both — ask user in plain English which version to keep
  return "category_c";
}

const results = { upgraded:[], no_change:[], failed:[] };
for (const r of needsUpgrade) {
  try {
    const s = upgradeFile(r);
    (s === "no_custom_changes" ? results.no_change : results.upgraded).push(r.name);
  } catch(e) { results.failed.push({ name: r.name, error: e.message }); }
}

// 3b: Unchanged CIM files — take new SAP version
for (const r of unchanged) {
  const zipPath = customName + "/" + r.source.replace(/^\/[^/]+\//, "");
  addFileToZip(zipPath, r.newSapFile);
}

// 3c: Standard MDK files in Z project — always from new SAP version
const standardMdkFiles = [".project.json","Application.app","metadata.json",
                           "package.json",".eslintrc",".gitignore","jsconfig.json"];
const cimSources = new Set((cim.IntegrationPoints||[])
  .map(ip => path.basename(ip.Source||"")));
for (const file of standardMdkFiles) {
  const newFile = path.join(newSapDir, "SAPAssetManager", file);
  if (fs.existsSync(newFile) && !cimSources.has(file)) {
    addFileToZip(customName + "/" + file, newFile);
    console.log("  standard upgraded: " + file);
  }
}

// 3d: Non-CIM standalone files — carry forward from workspace as-is
function addStandaloneFiles(srcDir, zipBase) {
  if (!fs.existsSync(srcDir)) return;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, e.name);
    const zipPath = zipBase + "/" + e.name;
    if (e.isDirectory()) {
      if (e.name === "Services") continue; // handled separately
      addStandaloneFiles(srcPath, zipPath);
    } else if (!cimSources.has(e.name) && !standardMdkFiles.includes(e.name)) {
      addFileToZip(zipPath, srcPath);
    }
  }
}
addStandaloneFiles(customDir, customName);
console.log("✅ Standalone files added as-is");

// 3e: Services/ — always from new SAP version (newSapExtracted has correct latest content)
// Copy from newSapExtracted (the extracted new SAPAssetManager) not from old sapDir
const newServicesDir = path.join(newSapExtracted, "Services");
if (fs.existsSync(newServicesDir)) {
  // Read destination name from old custom project's .service.metadata
  // so service files point to the correct Mobile Services destination
  let destName = null;
  try {
    const meta = JSON.parse(fs.readFileSync(
      path.join(customDir, ".service.metadata"), "utf8"));
    destName = (meta.mobile && meta.mobile.destinations && meta.mobile.destinations[0])
      ? meta.mobile.destinations[0].name : null;
  } catch(_) {}

  // Mirror exact structure from newSapExtracted/Services/ — same folders, same filenames
  function addServiceDir(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const srcPath = path.join(dir, e.name);
      // Build zip path preserving full relative structure from Services/ root
      const relPath = path.relative(newServicesDir, srcPath).replace(/\\/g, "/");
      const zipPath = customName + "/Services/" + relPath;

      if (e.isDirectory()) {
        addServiceDir(srcPath);  // recurse — preserves subfolder structure
      } else if (e.name.endsWith(".service") && destName) {
        // Update Destination in .service files to match project's Mobile Services destination
        let svc = fs.readFileSync(srcPath, "utf8");
        svc = svc.replace(/"Destination"\s*:\s*"[^"]*"/g,
          `"Destination": "${destName}"`);
        addToZip(zipPath, svc);
      } else {
        // All other files (XML, metadata etc.) — copy exactly as-is from new SAP version
        addFileToZip(zipPath, srcPath);
      }
    }
  }
  addServiceDir(newServicesDir);
  console.log("✅ Services/ structure mirrors SAPAssetManager/Services/ exactly");
  console.log("✅ Services/ from new SAP version (destination: " + (destName || "unchanged") + ")");

  // Also copy .service.metadata from new SAP version — contains updated OData definitions
  const newMeta = path.join(newSapExtracted, ".service.metadata");
  if (fs.existsSync(newMeta)) {
    addFileToZip(customName + "/.service.metadata", newMeta);
    console.log("✅ .service.metadata updated from new SAP version");
  }
}

// 3f: Upgrade CIM Target paths + merge SAP entries → add to ZIP
// CIM always lives in SAPAssetManager/ root — never in the Z project
let newCimFile = null;
for (const dir of [path.join(newSapDir,"SAPAssetManager"), newSapDir]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir))
    if (f.toLowerCase().endsWith(".cim")) { newCimFile = path.join(dir,f); break; }
  if (newCimFile) break;
}

const targetMap = new Map();
let newSchemaVersion = null;
let newComponentVersion = null;
if (newCimFile) {
  const newCim = JSON.parse(fs.readFileSync(newCimFile,"utf8"));
  // Capture schema/component version from new SAP CIM
  newSchemaVersion    = newCim.SchemaVersion    || newCim._SchemaVersion    || null;
  newComponentVersion = newCim.ComponentVersion || newCim._ComponentVersion || null;
  for (const ip of (newCim.IntegrationPoints||[]))
    if (ip.Source && ip.Target) targetMap.set(path.basename(ip.Source), ip.Target);
}

// If CIM has no SchemaVersion, read from new SAPAssetManager Application.app
if (!newSchemaVersion) {
  const newAppFile = path.join(newSapDir, "SAPAssetManager", "Application.app");
  if (fs.existsSync(newAppFile)) {
    try {
      const app = JSON.parse(fs.readFileSync(newAppFile,"utf8"));
      newSchemaVersion = app._SchemaVersion || app.SchemaVersion || null;
    } catch(_) {}
  }
}

const customEntries = (cim.IntegrationPoints||[])
  .filter(ip => !ip.Source.includes("SAPAssetManager"))
  .map(ip => {
    const newTarget = targetMap.get(path.basename(ip.Source));
    return newTarget && newTarget !== ip.Target ? {...ip, Target: newTarget} : ip;
  });

const sapEntries = newCimFile
  ? JSON.parse(fs.readFileSync(newCimFile,"utf8")).IntegrationPoints
      .filter(ip => ip.Source.includes("SAPAssetManager"))
  : (cim.IntegrationPoints||[]).filter(ip => ip.Source.includes("SAPAssetManager"));

// Update CIM with new version info and merged entries
cim.IntegrationPoints = [...customEntries, ...sapEntries];
if (newSchemaVersion)    cim.SchemaVersion    = newSchemaVersion;
if (newComponentVersion) cim.ComponentVersion = newComponentVersion;

// Write upgraded CIM directly into the NEW SAPAssetManager folder on disk
// The CIM belongs in the latest SAP version — not in the old project, not in the ZIP
const newCimOutputPath = path.join(newSapExtracted, path.basename(cimFile));
fs.writeFileSync(newCimOutputPath, JSON.stringify(cim, null, 4));
console.log("✅ CIM upgraded and written to new SAPAssetManager:");
console.log("   Location:  " + newCimOutputPath);
console.log("   Schema:    " + (newSchemaVersion    || "unchanged"));
console.log("   Version:   " + (newComponentVersion || "unchanged"));
console.log("   Custom entries: " + customEntries.length + " (Target paths upgraded)");
console.log("   SAP entries:    " + sapEntries.length);

// ── Step 4: Save output to developer's chosen location ──
console.log("\n📦 Saving to: " + saveTo + " (format: " + saveFormat + ")");

if (saveFormat === "zip") {
  // Save as ZIP to developer's chosen path
  const outZip = new AdmZip();
  outZip.addLocalFolder(newSapExtracted, "SAPAssetManager");
  outZip.addLocalFolder(path.join(outputDir, customName), customName);
  const date = new Date().toISOString().slice(0,10);
  const zipPath = path.join(saveTo, customName + "_upgraded_" + date + ".zip");
  fs.mkdirSync(saveTo, { recursive: true });
  outZip.writeZip(zipPath);
  console.log("\n✅ ZIP saved: " + zipPath);
  console.log("   Contains: SAPAssetManager/ (new) + " + customName + "/ (upgraded)");
} else {
  // Save as extracted folders to developer's chosen path
  function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      if (e.isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  }
  const newSapDest   = path.join(saveTo, "SAPAssetManager");
  const customDest   = path.join(saveTo, customName);
  fs.mkdirSync(saveTo, { recursive: true });
  copyDir(newSapExtracted, newSapDest);
  copyDir(path.join(outputDir, customName), customDest);
  console.log("\n✅ Folder saved: " + saveTo);
  console.log("   SAPAssetManager/ → " + newSapDest);
  console.log("   " + customName + "/ → " + customDest);
}

console.log("\nUpgrade stats: " + results.upgraded.length + " upgraded, " +
            results.no_change.length + " unchanged, " + results.failed.length + " failed");g("\nZIP contains:");
console.log("  " + customName + "/  — Z files upgraded + standard MDK at new version");
console.log("  SAPAssetManager/  — CIM with upgraded Target paths");
console.log("\nNext: extract alongside new SAPAssetManager → validate → deploy DEV");
```

## Phase 5 — Post-upgrade checklist

**What the output ZIP contains:**

```
<CUSTOM_DIR>_upgraded_<date>.zip
  SAPAssetManager/          ← NEW version (latest SAP release)
    <CUSTOM_NAME>.cim       ← CIM upgraded: Target paths + SchemaVersion updated
    Application.app         ← latest SAP version
    Pages/ Rules/ Actions/ Services/ i18n/ ...

  <CUSTOM_DIR>/             ← upgraded Z custom project
    Rules/                  ← your custom files on new SAP base
    Pages/
    Services/               ← replaced from new SAP version
    .project.json           ← new SAP version
    Application.app         ← new SAP version
    (non-CIM files)         ← carried forward as-is
```

**Quality checklist — apply before packaging (load `mdk-quality-checklist` skill):**
- [ ] Every upgraded `.js` rule exports default named function
- [ ] No hardcoded strings — user-visible text in i18n
- [ ] All Promises have `.catch()` handlers
- [ ] Import paths use correct relative paths to SAPAssetManager/
- [ ] No files written to SAPAssetManager/
- [ ] Every Z rule file has a CIM entry (Source + Target only)

**Developer steps after extracting ZIP:**
- [ ] Verify CIM is in `SAPAssetManager/` root — not inside `<CUSTOM_DIR>/`
- [ ] Open the extracted workspace in VS Code
- [ ] Run `mdk_manage validate` → 0 errors
- [ ] Bump `ApplicationVersion` in `.project.json`
- [ ] Offline app: `OnWillUpdate` + `OnDidUpdate` — see `mdk-deployment-guide` skill
- [ ] Deploy DEV → QA → PROD — see `mdk-deployment-guide` skill

**Old project** at original locations is completely untouched.

---

## Related skills
- `mdk-ssam-guide` — day-to-day SSAM conventions, CIM entries for new rules
- `mdk-deployment-guide` — OnWillUpdate/OnDidUpdate for schema-breaking upgrades
- `mdk-deployment-guide` — deploy upgraded app to dev/QA/prod
