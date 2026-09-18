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

**The existing workspace is never modified — read from workspace, write directly into ZIP.**

```javascript
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const AdmZip  = require("adm-zip");

// Args passed by agent: node /tmp/ssam_upgrade.js "<cimFile>" "<customDir>" "<sapDir>" "<newSapZip>" "<projectDir>"
const [,, cimFile, customDir, sapDir, newSapZip, projectDir] = process.argv;

// ── Step 1: Extract new SAPAssetManager from ZIP to temp ──
// Save entire Phase 5 as /tmp/ssam_upgrade.js and run: node /tmp/ssam_upgrade.js
const newSapDir = path.join(os.tmpdir(), "ssam_new_" + Date.now());
fs.mkdirSync(newSapDir, { recursive: true });
const zipIn = new AdmZip(newSapZip);
zipIn.getEntries()
  .filter(e => e.entryName.includes("SAPAssetManager"))
  .forEach(e => zipIn.extractEntryTo(e, newSapDir, true, true));
console.log("New SAP extracted to: " + newSapDir);

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

// ── Step 3: Build the output ZIP directly — no intermediate folder copy ──
const outZip = new AdmZip();
const customName = path.basename(customDir);

// Helper: add a file buffer to ZIP
function addToZip(zipPath, content) {
  outZip.addFile(zipPath, Buffer.from(content, "utf8"));
}
function addFileToZip(zipPath, srcPath) {
  outZip.addFile(zipPath, fs.readFileSync(srcPath));
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

  if (oldSap === customSrc) {
    addToZip(zipPath, recalcImports(newSap, zipPath, sapDir));
    return "no_custom_changes";
  }

  const oldSet = new Set(oldSap.split("\n").map(l=>l.trim()).filter(Boolean));
  const customAdditions = customSrc.split("\n")
    .filter(l => l.trim() && !oldSet.has(l.trim()));
  const newLines = newSap.split("\n");
  const newSet   = new Set(newLines.map(l=>l.trim()).filter(Boolean));
  const unique   = customAdditions.filter(l => !newSet.has(l.trim()));

  const merged = [...newLines, ...(unique.length ? ["","// --- Custom additions ---",...unique] : [])];
  addToZip(zipPath, recalcImports(merged.join("\n"), zipPath, sapDir));
  return "upgraded";
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

// 3e: Services/ — always from new SAP version
const newServicesDir = path.join(newSapDir, "SAPAssetManager", "Services");
if (fs.existsSync(newServicesDir)) {
  function addDirToZip(dir, zipBase) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), z = zipBase + "/" + e.name;
      if (e.isDirectory()) addDirToZip(p, z);
      else addFileToZip(z, p);
    }
  }
  addDirToZip(newServicesDir, customName + "/Services");
  console.log("✅ Services/ from new SAP version");
}

// 3f: Upgrade CIM Target paths + merge SAP entries → add to ZIP
let newCimFile = null;
for (const dir of [path.join(newSapDir,"SAPAssetManager"), newSapDir]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir))
    if (f.toLowerCase().endsWith(".cim")) { newCimFile = path.join(dir,f); break; }
  if (newCimFile) break;
}

const targetMap = new Map();
if (newCimFile) {
  const newCim = JSON.parse(fs.readFileSync(newCimFile,"utf8"));
  for (const ip of (newCim.IntegrationPoints||[]))
    if (ip.Source && ip.Target) targetMap.set(path.basename(ip.Source), ip.Target);
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

cim.IntegrationPoints = [...customEntries, ...sapEntries];
addToZip("SAPAssetManager/" + path.basename(cimFile), JSON.stringify(cim, null, 4));
console.log("✅ CIM upgraded (" + customEntries.length + " custom, " + sapEntries.length + " SAP entries)");

// ── Step 4: Write ZIP to disk ──
const outputZip = path.join(path.dirname(customDir),
  customName + "_upgraded_" + new Date().toISOString().slice(0,10) + ".zip");
outZip.writeZip(outputZip);

console.log("\n✅ Upgraded ZIP: " + outputZip);
console.log("   " + results.upgraded.length + " upgraded, " +
            results.no_change.length + " unchanged, " + results.failed.length + " failed");
console.log("\nZIP contains:");
console.log("  " + customName + "/  — Z files upgraded + standard MDK at new version");
console.log("  SAPAssetManager/  — CIM with upgraded Target paths");
console.log("\nNext: extract alongside new SAPAssetManager → validate → deploy DEV");
```

## Phase 6 — Post-upgrade checklist

**The upgraded ZIP has been delivered. Existing custom project is completely untouched.**

**What the ZIP contains:**

`<CUSTOM_DIR>/`:
- CIM-registered Z files — upgraded (new SAP base + your custom logic on top)
- Standard MDK files (`.project.json`, `Application.app` etc.) — new version from SAP
- Non-CIM standalone files — carried forward as-is (your own additions, untouched)
- `Services/` — replaced from new SAP version (latest OData metadata)

`SAPAssetManager/`:
- CIM file — custom `Source` entries kept, `Target` paths upgraded to new SAP paths, new SAP standard entries added

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
