---
name: ssam-patch-update
version: 3.0.0
description: >
  Use when applying a SAP Service and Asset Manager (SSAM) metadata patch to
  an existing customized SSAM project. Accepts two inputs: the SSAM project
  root (which contains both the standard SAPAssetManager folder and the custom
  Z project, linked by a CIM file) and a new patch ZIP or directory. Performs
  auto-discovery of the standard folder, CIM file, and Z project. Runs a
  three-way merge between the discovered standard baseline, the Z project
  customizations, and the new patch. Classifies every file, generates
  before-and-after reports, creates a backup, applies only safe approved changes,
  validates all CIM references and broken dependencies, and produces a full
  patch-update summary. Never silently overwrites customized files.
  Requires only Node.js — no MDK CLI, CF login, SAP BTP, or Mobile Services.
  Trigger on: "apply SSAM patch", "SAP Asset Manager patch", "SSAM hot-fix",
  "update SSAM metadata", "merge SSAM patch", "three-way merge SSAM",
  "SAP patch ZIP", "SSAM version update", "patch conflict",
  "apply SAP standard update to customized SSAM", "SSAM metadata update",
  "update Z project with new SAP patch", "apply latest SSAM metadata patch",
  "identify conflicts with CIM file", "safely update SSAM project".
source: SAP SSAM customization conventions + Intent2App engineering standards
requires: Node.js >=16 (fs, path, crypto, child_process — no npm install needed)
---

# SSAM Patch Update — Three-Way Merge Skill

Safely applies a SAP Service and Asset Manager metadata patch to a customized
Z project. Auto-discovers the project structure, classifies every affected file,
explains conflicts, proposes safe merges, blocks unsafe ones for developer
decision, then validates the result end-to-end.

---

## Inputs — Only Two Required

| # | Label | Variable | What to provide |
|---|---|---|---|
| 1 | SSAM project root | `PROJECT_DIR` | Directory that contains **both** the standard SAP folder and the custom Z project (linked by a CIM file) |
| 2 | New patch package | `PATCH_PKG` | Directory **or** ZIP file of the new SAP standard after the patch |

The skill discovers the rest automatically from `PROJECT_DIR`:

```
PROJECT_DIR/
├── SAPAssetManager/          ← standard SAP metadata (auto-detected as CURRENT_PKG)
│   ├── Application.app
│   ├── ZSAPAssetManager.cim  ← CIM file (auto-detected at depth 1 in standard folder)
│   ├── Rules/
│   ├── Pages/
│   └── ...
└── ZSAPAssetManager/         ← custom Z project (derived from CIM ProjectName)
    ├── Application.app
    ├── Rules/
    └── ...
```

---

## Example Commands

```
/ssam-patch-update "Apply the latest SSAM metadata patch to the customized
project and identify conflicts with files maintained in the CIM file."
```

```
/ssam-patch-update "PROJECT_DIR is ./MySSAMProject, PATCH_PKG is
./patches/SSAM_2406.zip — apply and report all conflicts."
```

```
/ssam-patch-update --resolve "Rules/WorkOrders/Caption.js=A"
"Continue patch after resolving the BLOCKING conflict."
```

When the invocation contains only natural language, ask for the two inputs
using `AskUserQuestion` before proceeding.

---

## Non-Negotiable Rules

### RULE 1 — Never silently overwrite a customized file
A file listed in the CIM and changed from the SAP baseline must never be
overwritten without explicit developer approval. If auto-merge is unsafe,
emit a `BLOCKING:` message and stop that file.

### RULE 2 — Backup before any write
Before modifying any file, create a timestamped backup of:
- Every `SAP_DIR` file the patch **actually changes** (SHA-256 differs between `SAP_DIR/f` and `PATCH_PKG/f`) → stored under `_ssam_backup_<ts>/SAP/`
- Every `CUSTOM_DIR` (Z project) file that maps (via CIM `sourceMap`) to a patch-modified SAP file — these will be rewritten by PATCH or MERGE apply steps → stored under `_ssam_backup_<ts>/Z/`

Backup root: `SAP_DIR/_ssam_backup_<timestamp>/` (two subdirectories: `SAP/` and `Z/`).
Files unchanged by the patch, or new files the patch adds, are not backed up.
Abort immediately if backup creation fails.

### RULE 3 — Rollback on unrecoverable failure
If Phase 8 (Apply) or Phase 9 (Validate) fails unrecoverably, offer rollback.
On rollback, restore the backup and confirm the project is in its pre-run state.

### RULE 4 — Full report before any action
Generate and display the complete conflict report (Phase 6) before making any
change. Developer must confirm (`apply`) before Phase 8 begins.

### RULE 5 — CIM is the authoritative customization list
Only files listed in the CIM `IntegrationPoints` are treated as customized.
Files present in `CUSTOM_DIR` but absent from the CIM are treated as
uncustomized SAP copies — patch changes to them auto-apply.
In **standard-only mode** (no CIM, no Z project) every file is treated as
uncustomized — all patch changes apply directly to `SAP_DIR`.

### RULE 6 — Node.js only
All file operations, hashing, and diffing use Node.js built-in modules:
`fs`, `path`, `crypto`, `child_process`. No npm packages, MDK CLI, CF CLI,
SAP BTP services, or Mobile Services access required.

### RULE 7 — SAP standard folder is the apply target
In **customized mode**: `SAP_DIR` is updated to the new baseline; customer
overrides live in `CUSTOM_DIR` and are merged/protected per CIM.
In **standard-only mode**: `SAP_DIR` is the only apply target; patch changes
are written directly into it after backup.

---

## File Classification Matrix (9 categories)

Every file receives exactly one classification before any action is taken.

| ID | Name | Condition | Default action |
|---|---|---|---|
| **SAFE** | Safe to update | In PATCH; not in CIM; content changed from base | Auto-apply |
| **CUST** | Customer-only | In CIM; base≠custom; base==patch | Carry forward unchanged |
| **PATCH** | SAP patch only | In CIM; base==custom; base≠patch | Auto-apply (our copy still matches base) |
| **MERGE** | Auto-merge possible | In CIM; both sides changed non-overlapping regions | Apply structured merge |
| **CONFLICT** | Manual review | In CIM; overlapping changes; safe merge proposed | Developer confirms or overrides |
| **ADDED** | Added by patch | Not in base; in patch | Auto-apply if not in CIM; BLOCKING if in CIM |
| **DELETED** | Deleted by patch | In base; not in patch | Auto-remove if not in CIM; BLOCKING if in CIM |
| **CUSTOM-ADDED** | Customer-added | In CIM; not in base or patch | Carry forward unchanged |
| **RENAMED** | Path moved | Same hash, different path between base and patch | Flag for CIM review |

---

## Workflow — 9 Phases

### Phase 1 — Input Validation and ZIP Expansion

```javascript
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { execSync } = require('child_process');

// Validate PROJECT_DIR
if (!PROJECT_DIR || !fs.existsSync(PROJECT_DIR))
  throw new Error(`PROJECT_DIR not found: "${PROJECT_DIR}"`);

// Expand PATCH_PKG if it is a ZIP
function expandIfZip(pkgPath, label) {
  if (!pkgPath.endsWith('.zip')) return pkgPath;
  const tmp = path.join(os.tmpdir(), `ssam_${label}_${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try { execSync(`unzip -q "${pkgPath}" -d "${tmp}"`, { stdio: 'pipe' }); }
  catch (_) {
    execSync(
      `powershell -Command "Expand-Archive -Path '${pkgPath}' -DestinationPath '${tmp}' -Force"`,
      { stdio: 'pipe' }
    );
  }
  // Strip single root wrapper (common SAP packaging pattern)
  const entries = fs.readdirSync(tmp);
  if (entries.length === 1 && fs.statSync(path.join(tmp, entries[0])).isDirectory())
    return path.join(tmp, entries[0]);
  return tmp;
}

PATCH_PKG = expandIfZip(PATCH_PKG, 'patch');
```

### Phase 2 — Auto-Discovery

Discover the standard SAP folder, CIM file, and Z project from `PROJECT_DIR`.
See `references/discovery.md` for the full algorithm and edge-case handling.

**Two operating modes — chosen automatically:**

| Mode | When | Behaviour |
|---|---|---|
| `customized` | CIM file found **and** Z project folder exists | Three-way merge; CIM-listed files protected |
| `standard-only` | No CIM file **or** Z project folder absent | All patch changes auto-apply; no merge needed |

**Discovery sequence:**

```javascript
function discoverProjectStructure(PROJECT_DIR) {
  // Step 1: Find the standard SAP directory (required — error if missing)
  const SAP_DIR = findSapDirectory(PROJECT_DIR);
  if (!SAP_DIR) throw new Error(
    `Cannot find standard SAP metadata folder in "${PROJECT_DIR}".
     Expected a subdirectory containing Application.app (e.g. SAPAssetManager/).`
  );

  const PRE_APP = readAppDefinition(SAP_DIR);

  // Step 2: Find the CIM file (optional — missing CIM → standard-only mode)
  const CIM_FILE = findCimFile(SAP_DIR);
  if (!CIM_FILE) {
    // No CIM file: no Z project to protect — operate in standard-only mode.
    return {
      SAP_DIR, CIM_FILE: null, cim: null,
      Z_NAME: null, CUSTOM_DIR: null,
      PRE_APP, MODE: 'standard-only',
    };
  }

  // Step 3: Parse CIM and derive Z project name
  let cim;
  try { cim = JSON.parse(fs.readFileSync(CIM_FILE, 'utf8')); }
  catch (e) { throw new Error(`CIM file is not valid JSON: ${e.message}`); }
  if (!cim.ProjectName) throw new Error(`CIM file missing required field "ProjectName"`);

  // Step 4: Locate Z project directory (optional — missing folder → standard-only)
  let CUSTOM_DIR = null;
  try { CUSTOM_DIR = findZProjectDirectory(PROJECT_DIR, SAP_DIR, cim); }
  catch (_) { /* Z project folder absent — fall through to standard-only */ }

  const MODE = CUSTOM_DIR ? 'customized' : 'standard-only';
  return { SAP_DIR, CIM_FILE, cim, Z_NAME: cim.ProjectName, CUSTOM_DIR, PRE_APP, MODE };
}
```

Report discovery results before continuing:
```
DISCOVERY COMPLETE
══════════════════════════════════════════════════════════
Mode                : <customized | standard-only>
Standard SAP folder : <SAP_DIR>
CIM file            : <CIM_FILE | (none — standard-only mode)>
Z project name      : <Z_NAME   | (none — standard-only mode)>
Z project folder    : <CUSTOM_DIR | (none — standard-only mode)>
CIM IntegrationPoints: <N entries | N/A>
App name            : <PRE_APP._Name>
Schema version      : <PRE_APP._SchemaVersion>
Patch package       : <PATCH_PKG>
══════════════════════════════════════════════════════════

⚠  STANDARD-ONLY MODE — no Z project found.
   All patch changes will be applied directly to the SAP standard folder.
   Backup of modified files will still be created before any write.
```
(Print the ⚠ warning block only when MODE is `standard-only`.)

If discovery fails for SAP_DIR, output the exact error and stop. Do not attempt
to proceed with guessed paths.

### Phase 3 — CIM Validation

**Skipped entirely in `standard-only` mode** — `customizedSet` and `sourceMap`
are initialised to empty collections and the skill proceeds directly to Phase 4.

```javascript
// Initialise to empty — overwritten below only in customized mode
let customizedSet = new Set();
let sourceMap     = {};

if (MODE === 'customized') {
  const r = validateCim(cim, SAP_DIR, CUSTOM_DIR);
  customizedSet = r.customizedSet;
  sourceMap     = r.sourceMap;
}

function validateCim(cim, SAP_DIR, CUSTOM_DIR) {
  const required = ['ProjectName', 'ApplicationName', 'IntegrationPoints'];
  for (const f of required)
    if (!cim[f]) throw new Error(`CIM missing field: "${f}"`);

  const errors = [];
  const seen   = new Set();

  for (const [i, ip] of cim.IntegrationPoints.entries()) {
    if (!ip.Source) errors.push(`[${i}] missing Source`);
    if (!ip.Target) errors.push(`[${i}] missing Target`);
    const extra = Object.keys(ip).filter(k => !['Source','Target'].includes(k));
    if (extra.length) errors.push(`[${i}] unexpected fields: ${extra.join(', ')}`);

    // Verify Source exists in Z project
    if (ip.Source) {
      const zRel = ip.Source.replace(/^\/[^/]+\//, '');
      const zAbs = path.join(CUSTOM_DIR, zRel);
      if (!fs.existsSync(zAbs)) errors.push(`[${i}] Source missing on disk: ${ip.Source}`);
    }
    // Duplicate targets
    if (ip.Target && seen.has(ip.Target)) errors.push(`[${i}] duplicate Target: ${ip.Target}`);
    if (ip.Target) seen.add(ip.Target);
  }

  if (errors.length) throw new Error(`CIM validation failed:\n${errors.map(e=>`  ${e}`).join('\n')}`);

  // Build lookup tables
  const customizedSet = new Set();
  const sourceMap     = {};
  for (const ip of cim.IntegrationPoints) {
    const sapRel = ip.Target.replace(/^\/[^/]+\//, '');
    const zRel   = ip.Source.replace(/^\/[^/]+\//, '');
    customizedSet.add(sapRel);
    sourceMap[sapRel] = zRel;
  }
  return { customizedSet, sourceMap };
}
```

### Phase 4 — Backup

Back up every file that this patch run will modify — from both the SAP standard
folder and the Z project (when in `customized` mode).

Backup root: `SAP_DIR/_ssam_backup_<timestamp>/`
- `SAP/` — SAP standard files where patch content differs from current
- `Z/`   — Z project custom files mapped (via CIM) to those same SAP files

```javascript
/**
 * Back up files that this patch run will modify.
 *
 *  SAP/ — every SAP_DIR file where hashFile(SAP_DIR/f) ≠ hashFile(PATCH_PKG/f).
 *          These will be overwritten by apply steps 8A/8B/8C/8D/8H.
 *
 *  Z/   — every CUSTOM_DIR file whose CIM sourceMap entry maps to a
 *          patch-modified SAP file. These will be rewritten by apply steps
 *          8B (PATCH) and 8C (MERGE).
 *          Only populated in `customized` mode; empty in `standard-only`.
 *
 * `customizedSet` and `sourceMap` come from Phase 3 (already computed).
 */
function backupModifiedFiles(SAP_DIR, PATCH_PKG, CUSTOM_DIR, customizedSet, sourceMap) {
  const ts     = new Date().toISOString().replace(/[:.]/g, '-');
  const root   = path.join(SAP_DIR, `_ssam_backup_${ts}`);
  const sapDir = path.join(root, 'SAP');
  const zDir   = path.join(root, 'Z');
  fs.mkdirSync(sapDir, { recursive: true });

  let sapCount = 0, zCount = 0;

  for (const f of walkDir(PATCH_PKG)) {
    // ── SAP standard file ──────────────────────────────────────────────
    const sapSrc = path.join(SAP_DIR, f);
    let patchModifies = false;

    if (fs.existsSync(sapSrc)) {
      if (hashFile(sapSrc) !== hashFile(path.join(PATCH_PKG, f))) {
        const dst = path.join(sapDir, f);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(sapSrc, dst);
        sapCount++;
        patchModifies = true;
      }
    }

    // ── Z project custom file (only when patch modifies its SAP counterpart) ──
    if (patchModifies && CUSTOM_DIR && customizedSet.has(f) && sourceMap[f]) {
      const zSrc = path.join(CUSTOM_DIR, sourceMap[f]);
      if (fs.existsSync(zSrc)) {
        fs.mkdirSync(zDir, { recursive: true });
        const dst = path.join(zDir, sourceMap[f]);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(zSrc, dst);
        zCount++;
      }
    }
  }

  console.log(`Backup: ${sapCount} SAP standard + ${zCount} Z project files → ${root}`);
  return root;
}

const BACKUP_PATH = backupModifiedFiles(SAP_DIR, PATCH_PKG, CUSTOM_DIR, customizedSet, sourceMap);
```

If `backupModifiedFiles` throws:
```
ABORT: Backup failed — <error>
No files have been modified. Fix the issue and retry.
```

Store the backup path — every subsequent report line includes it.

### Phase 5 — File Inventory and Pre-Patch Snapshot

```javascript
const crypto = require('crypto');

function hashFile(p) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
  catch (_) { return null; }
}

function walkDir(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    e.isDirectory() ? out.push(...walkDir(f, base))
                    : out.push(path.relative(base, f).replace(/\\/g, '/'));
  }
  return out;
}

// B = base/current (SAP_DIR), T = theirs/patch (PATCH_PKG), O = ours/custom (CUSTOM_DIR via sourceMap)
const currentFiles = new Set(walkDir(SAP_DIR));
const patchFiles   = new Set(walkDir(PATCH_PKG));
const allFiles     = new Set([...currentFiles, ...patchFiles, ...customizedSet]);

const hashB = {}, hashT = {}, hashO = {};
for (const f of allFiles) {
  hashB[f] = hashFile(path.join(SAP_DIR,   f));
  hashT[f] = hashFile(path.join(PATCH_PKG, f));
  if (sourceMap[f]) hashO[f] = hashFile(path.join(CUSTOM_DIR, sourceMap[f]));
}

// Detect partial patch (SAP hot-fix ZIPs often contain only changed files)
const IS_PARTIAL = patchFiles.size < currentFiles.size * 0.4;

// Pre-patch snapshot for before-and-after report
const PRE_PATCH = {};
for (const f of customizedSet) {
  const zPath = sourceMap[f] ? path.join(CUSTOM_DIR, sourceMap[f]) : null;
  PRE_PATCH[f] = {
    baseHash: hashB[f], customHash: hashO[f],
    modifiedFromBase: hashB[f] !== hashO[f],
    content: zPath && fs.existsSync(zPath)
      ? fs.readFileSync(zPath, 'utf8').split('\n').slice(0, 5).join('\n')
      : null,
  };
}
```

Detect renames (same content hash at a different path):
```javascript
function detectRenames(hashB, hashT, currentFiles, patchFiles) {
  const byB = {}, byT = {};
  for (const [f,h] of Object.entries(hashB)) if (h) (byB[h]=byB[h]||[]).push(f);
  for (const [f,h] of Object.entries(hashT)) if (h) (byT[h]=byT[h]||[]).push(f);
  const renames = [];
  for (const [hash, tPaths] of Object.entries(byT)) {
    const cPaths = byB[hash] || [];
    for (const tp of tPaths) {
      if (!currentFiles.has(tp) && cPaths.length===1 && !patchFiles.has(cPaths[0]))
        renames.push({ from: cPaths[0], to: tp, hash });
    }
  }
  return renames;
}
```

### Phase 6 — Three-Way Classification

```javascript
const renames      = detectRenames(hashB, hashT, currentFiles, patchFiles);
const renameFromSet = new Set(renames.map(r=>r.from));
const renameToSet   = new Set(renames.map(r=>r.to));
const classified   = {};

for (const f of allFiles) {
  const inB   = !!hashB[f], inT = !!hashT[f], inCIM = customizedSet.has(f);
  const b_t   = inB && inT && hashB[f]===hashT[f];
  const b_o   = inB && inCIM && hashB[f]===hashO[f];
  const t_o   = inT && inCIM && hashT[f]===hashO[f];

  if (renameFromSet.has(f)||renameToSet.has(f)) {
    classified[f]={ cls:'RENAMED', rename:renames.find(r=>r.from===f||r.to===f) }; continue;
  }
  if (!inB&&!inT&& inCIM) { classified[f]={cls:'CUSTOM-ADDED'};                        continue; }
  if (!inB&& inT&&!inCIM) { classified[f]={cls:'ADDED'};                               continue; }
  if (!inB&& inT&& inCIM) { classified[f]={cls:'CONFLICT',reason:'ADDED-CONFLICT'};    continue; }
  if ( inB&&!inT&&!inCIM) { classified[f]={cls:'DELETED'};                             continue; }
  if ( inB&&!inT&& inCIM) { classified[f]={cls:'CONFLICT',reason:'DELETED-CONFLICT'};  continue; }

  if (inB&&inT) {
    if (b_t&&!inCIM)          { classified[f]={cls:'UNCHANGED'};  continue; }
    if (b_t&& inCIM&&!b_o)   { classified[f]={cls:'CUST'};        continue; }
    if (b_t&& inCIM&& b_o)   { classified[f]={cls:'UNCHANGED'};   continue; }
    if (!b_t&&!inCIM)         { classified[f]={cls:'SAFE'};        continue; }
    if (!b_t&& inCIM&& b_o)  { classified[f]={cls:'PATCH'};       continue; }
    if (!b_t&& inCIM&& t_o)  { classified[f]={cls:'PATCH'};       continue; }
    if (!b_t&& inCIM&&!b_o) {
      const ext = path.extname(f).toLowerCase();
      const mergeable = ['.json','.page','.action','.rule','.service','.app',
                         '.style','.globaldef','.properties','.js','.ts','.xml'].includes(ext);
      if (mergeable) {
        const mr = attemptStructuredMerge(f, SAP_DIR, PATCH_PKG, CUSTOM_DIR, sourceMap[f]);
        classified[f] = mr.success
          ? { cls:'MERGE',    mergeResult:mr }
          : { cls:'CONFLICT', reason:mr.reason, mergeResult:mr };
      } else {
        classified[f] = { cls:'CONFLICT', reason:'Binary or unsupported — cannot auto-merge' };
      }
    }
  }
}
```

`attemptStructuredMerge` is implemented in `references/three-way-merge.md`.

### Phase 7 — Conflict Report (Before State)

Build and display the full report **before any files are changed**.
See `references/validation-and-reports.md` Template 1–4 for exact output format.

The report contains:

**A — Before State** (pre-patch snapshot)
For every CIM-customized file: current status, hash, whether it differs from
the SAP base, and a 5-line content excerpt.

**B — Per-File Detail Blocks** for every CONFLICT and BLOCKING file, sorted by
severity rank (from `references/conflict-detection.md`):
- File path and CIM Source/Target
- Standard change (base→patch): unified diff ≤30 lines
- Customer customization (base→custom): unified diff ≤30 lines
- Conflict type and why auto-merge is unsafe
- Proposed merged result (if `attemptStructuredMerge` produced a candidate)
- Resolution options [A]–[E]

**C — Classification Summary Table**

After the report, print the approval gate prompt (Template 5) and wait for
`apply` or `stop`.

### Phase 8 — Apply Changes

Apply only after developer types `apply`. Stop and offer rollback on any error.

| Sub-step | Category | Action |
|---|---|---|
| 8A | SAFE | Copy patch file to `SAP_DIR` |
| 8B | PATCH | Copy patch file to both `SAP_DIR` and `CUSTOM_DIR/sourceMap[f]` |
| 8C | MERGE | Write `mergeResult.content` to `CUSTOM_DIR/sourceMap[f]`; copy patch file to `SAP_DIR`; verify written hash |
| 8D | ADDED | Copy patch file to `SAP_DIR`; do NOT add to CIM or `CUSTOM_DIR` unless developer requests |
| 8E | DELETED | Remove from `SAP_DIR` if not in CIM; never auto-remove from `CUSTOM_DIR` |
| 8F | CONFLICT/BLOCKING | Skip entirely; log as SKIPPED |
| 8G | CUST/CUSTOM-ADDED | No action — carry forward |
| 8H | RENAMED | Copy new path to `SAP_DIR`; remove old path from `SAP_DIR`; flag CIM Target if customized |

Print one progress line per file (Template 6 in `references/validation-and-reports.md`).
Verify each written file's hash before proceeding to the next.

### Phase 9 — Post-Patch Validation

Run all eight checks from `references/validation-and-reports.md` Validation section:

1. **CIM reference integrity** — every Source and Target exists on disk
2. **JSON validity** — all updated `.json`, `.page`, `.action`, `.rule`, etc. parse cleanly
3. **i18n key coverage** — every `{i18n>Key}` reference in updated files has a key defined
4. **Rule path resolution** — every `_Rules` reference resolves to a `.js` on disk
5. **Application definition consistency** — `_Name` unchanged; `_SchemaVersion` bump flagged
6. **Duplicate object detection** — no two files in the same directory share `_Name`
7. **XML well-formedness** — balanced tags, no unescaped characters
8. **Broken dependency detection** — Z project references to deleted/renamed SAP files

On validation failure, ask:
```
Validation found N error(s). Type 'rollback' to restore backup,
or 'keep' to retain partial changes and fix manually.
```

### Phase 10 — After Report and Final Summary

Print the full after-state report showing what changed (Template 7).
For every MERGED file, show the diff between pre-patch customer version and the
merged result. End with counts and next steps.

---

## Rollback Procedure

Rollback restores both the SAP standard files and any Z project custom files
that were backed up in Phase 4. The backup folder is organised as:
- `<backup>/SAP/` → restored back to `SAP_DIR`
- `<backup>/Z/`  → restored back to `CUSTOM_DIR` (skipped if absent or not present)

```javascript
function rollback(backupPath, SAP_DIR, CUSTOM_DIR) {
  let sapCount = 0, zCount = 0;

  // Restore SAP standard files
  const sapBackup = path.join(backupPath, 'SAP');
  if (fs.existsSync(sapBackup)) {
    for (const f of walkDir(sapBackup)) {
      const src = path.join(sapBackup, f);
      const dst = path.join(SAP_DIR, f);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      sapCount++;
    }
  }

  // Restore Z project custom files (only if backup contains Z/ and CUSTOM_DIR exists)
  const zBackup = path.join(backupPath, 'Z');
  if (CUSTOM_DIR && fs.existsSync(zBackup)) {
    for (const f of walkDir(zBackup)) {
      const src = path.join(zBackup, f);
      const dst = path.join(CUSTOM_DIR, f);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      zCount++;
    }
  }

  console.log(
    `ROLLBACK COMPLETE — ${sapCount} SAP standard + ${zCount} Z project files` +
    ` restored from: ${backupPath}`
  );
}
```

The backup folder is always retained after rollback. Print Template 8.

---

## Merge Decision Rules

| Situation | Decision |
|---|---|
| Only whitespace/line-endings differ | MERGE — normalize to LF |
| SAP added new JSON property; we didn't touch that key | MERGE — add property |
| SAP changed JSON property value we also changed | CONFLICT |
| SAP deleted JSON property referenced in a Z rule | BLOCKING |
| SAP added a new JS function; no name clash | MERGE — append function |
| SAP changed a JS function we also modified | CONFLICT |
| SAP deleted a JS function we call elsewhere | BLOCKING |
| SAP added new i18n keys | MERGE — add to our file |
| SAP deleted i18n keys we reference in Z project | BLOCKING |
| SAP changed i18n key value we override in Z i18n | CUST wins — no conflict |
| SAP changed i18n key value we don't override | PATCH — take SAP value |
| SAP changed XML attribute we didn't touch | MERGE |
| SAP changed XML attribute we also changed | CONFLICT |
| Binary file changed in both patch and custom | BLOCKING — always manual |
| `_Type` changed on control we customized | BLOCKING — structural |
| `_Name` changed on object we reference | BLOCKING — broken reference |
| Both sides changed `Application.app._SchemaVersion` | PATCH wins + mdk-migration flag |

---

## BLOCKING Message Format

```
BLOCKING: <relative/path/to/file.ext>
════════════════════════════════════════════════════════════════════════
Conflicting file: <relative path>
CIM reference:
  Source → <ip.Source>
  Target → <ip.Target>

Standard change (base → patch):
<unified diff ≤30 lines>

Customer customization (base → custom):
<unified diff ≤30 lines>

Conflict type: <name> (severity rank <N>)
Why auto-merge is unsafe:
  <specific technical reason>

Proposed merged result:
  <merged content, or "Cannot compute — structural conflict">

Resolution options:
  [A] Keep customer version — apply SAP change manually on top
  [B] Take patch version    — reapply customer customization on top
  [C] Keep customer version — discard this SAP change entirely
  [D] Take patch version    — discard customer customization
  [E] Manual merge          — edit Z project file directly

Re-run: /ssam-patch-update --resolve "<relative/path/file.ext>=<A|B|C|D|E>"
════════════════════════════════════════════════════════════════════════
```

---

## Reference Documents

| File | Contents |
|---|---|
| `references/discovery.md` | Full auto-discovery algorithm: `findSapDirectory`, `findCimFile`, edge cases (nested roots, multiple SAP dirs, ambiguous CIM files), disambiguation prompts |
| `references/three-way-merge.md` | Node.js: `attemptStructuredMerge`, `mergeJson` (deep recursive), `mergeI18n` (key-level), `mergeText` (LCS hunk), `detectRenames`, ZIP expansion, binary guard |
| `references/conflict-detection.md` | Per-file-type rules and detection code: JSON/MDK, JS, TS, XML, i18n, Application.app, styles, globals, binary; 13-level severity ranking |
| `references/validation-and-reports.md` | Eight post-patch validation checks with Node.js code + nine output report templates + four worked BLOCKING examples |
