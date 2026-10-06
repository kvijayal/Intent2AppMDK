# Auto-Discovery — SSAM Project Structure

Full algorithm for Phase 2 of `ssam-patch-update`.
Discovers the standard SAP folder, CIM file, and Z project from `PROJECT_DIR`.

---

## Expected Layout

```
PROJECT_DIR/
├── SAPAssetManager/          ← standard SAP metadata (CURRENT_PKG)
│   ├── Application.app       ← presence of this file identifies the standard folder
│   ├── ZSAPAssetManager.cim  ← CIM file: *.cim at depth 1 in the standard folder
│   ├── i18n/
│   ├── Rules/
│   ├── Pages/
│   ├── Actions/
│   └── ...
└── ZSAPAssetManager/         ← Z project (name = cim.ProjectName)
    ├── Application.app
    ├── i18n/
    ├── Rules/
    └── ...
```

The CIM file lives **at the root of the standard SAP folder** (not inside the Z project).

---

## Step 1 — Find the Standard SAP Directory (`findSapDirectory`)

```javascript
const fs   = require('fs');
const path = require('path');

/**
 * Search PROJECT_DIR at depth 1 for a subdirectory that contains Application.app.
 * Returns the absolute path of the first match, or null if none found.
 */
function findSapDirectory(PROJECT_DIR) {
  const candidates = [];

  for (const entry of fs.readdirSync(PROJECT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(PROJECT_DIR, entry.name);
    const appFile   = path.join(candidate, 'Application.app');
    if (fs.existsSync(appFile)) candidates.push(candidate);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Multiple subdirectories contain Application.app — must disambiguate
  return disambiguateSapDirectory(candidates);
}

/**
 * When multiple candidates exist, pick the one that also has a *.cim file.
 * If still ambiguous, ask the developer.
 */
function disambiguateSapDirectory(candidates) {
  // Filter to those that also have a CIM file (strong signal of the standard folder)
  const withCim = candidates.filter(c =>
    fs.readdirSync(c).some(f => f.toLowerCase().endsWith('.cim'))
  );
  if (withCim.length === 1) return withCim[0];

  // Still ambiguous — surface the list and ask
  console.error(
    `DISCOVERY AMBIGUITY: Multiple SAP standard folders found:\n` +
    candidates.map((c,i) => `  [${i+1}] ${c}`).join('\n') +
    `\nPlease re-run with PROJECT_DIR pointing directly to the standard SAP folder.`
  );
  return null; // caller must handle null → ask user
}
```

---

## Step 2 — Find the CIM File (`findCimFile`)

```javascript
/**
 * Find the first *.cim or *.CIM file at depth 1 in SAP_DIR.
 * Returns absolute path or null.
 */
function findCimFile(SAP_DIR) {
  const candidates = fs.readdirSync(SAP_DIR)
    .filter(f => f.toLowerCase().endsWith('.cim'))
    .map(f => path.join(SAP_DIR, f));

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Multiple CIM files — prefer the one whose ProjectName matches a sibling directory
  const parent = path.dirname(SAP_DIR);
  const siblings = new Set(fs.readdirSync(parent));
  for (const cimPath of candidates) {
    try {
      const cim = JSON.parse(fs.readFileSync(cimPath, 'utf8'));
      if (cim.ProjectName && siblings.has(cim.ProjectName)) return cimPath;
    } catch (_) {}
  }

  // Still ambiguous — ask
  console.error(
    `DISCOVERY AMBIGUITY: Multiple CIM files found in "${SAP_DIR}":\n` +
    candidates.map((c,i) => `  [${i+1}] ${path.basename(c)}`).join('\n') +
    `\nPlease specify the CIM file path explicitly.`
  );
  return null;
}
```

---

## Step 3 — Locate the Z Project Directory

```javascript
/**
 * Using cim.ProjectName, find the Z project directory.
 * First look as a sibling of SAP_DIR; then search the full PROJECT_DIR.
 */
function findZProjectDirectory(PROJECT_DIR, SAP_DIR, cim) {
  const Z_NAME = cim.ProjectName;

  // Primary: sibling of SAP_DIR in PROJECT_DIR
  const primaryPath = path.join(PROJECT_DIR, Z_NAME);
  if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).isDirectory())
    return primaryPath;

  // Fallback: search PROJECT_DIR depth 1 for a directory matching Z_NAME
  for (const entry of fs.readdirSync(PROJECT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === Z_NAME) return path.join(PROJECT_DIR, entry.name);
  }

  // Not found — try case-insensitive match
  for (const entry of fs.readdirSync(PROJECT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.toLowerCase() === Z_NAME.toLowerCase())
      return path.join(PROJECT_DIR, entry.name);
  }

  throw new Error(
    `Z project directory not found.\n` +
    `CIM ProjectName is "${Z_NAME}" but no folder named "${Z_NAME}" exists in "${PROJECT_DIR}".\n` +
    `Check that the Z project is a sibling of the standard SAP folder.`
  );
}
```

---

## Step 4 — Read Application Metadata

After discovery, read `Application.app` from the standard folder to capture
pre-patch schema version and app name for validation:

```javascript
function readAppDefinition(SAP_DIR) {
  const appPath = path.join(SAP_DIR, 'Application.app');
  try {
    const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
    return {
      _Name:          app._Name          || '(unknown)',
      _SchemaVersion: app._SchemaVersion || '(unknown)',
      Version:        app.Version        || '(unknown)',
    };
  } catch (e) {
    return { _Name: '(parse error)', _SchemaVersion: '(parse error)', Version: '(parse error)' };
  }
}
```

---

## Full discoverProjectStructure Implementation

```javascript
function discoverProjectStructure(PROJECT_DIR) {
  // 1. Find standard SAP directory
  const SAP_DIR = findSapDirectory(PROJECT_DIR);
  if (!SAP_DIR)
    throw new Error(
      `Standard SAP metadata folder not found in "${PROJECT_DIR}".\n` +
      `Expected a subdirectory containing Application.app (e.g. SAPAssetManager/).`
    );

  // 2. Find CIM file
  const CIM_FILE = findCimFile(SAP_DIR);
  if (!CIM_FILE)
    throw new Error(
      `No CIM file found in "${SAP_DIR}".\n` +
      `Expected a *.cim file at the root of the standard SAP folder.\n` +
      `Create a CIM file first using the intent-ssam or mdk-ssam-workflow skill.`
    );

  // 3. Parse and validate CIM (minimal check before full Phase 3 validation)
  let cim;
  try { cim = JSON.parse(fs.readFileSync(CIM_FILE, 'utf8')); }
  catch (e) { throw new Error(`CIM file is not valid JSON: ${e.message}`); }
  if (!cim.ProjectName) throw new Error(`CIM file missing required field "ProjectName"`);

  // 4. Locate Z project
  const CUSTOM_DIR = findZProjectDirectory(PROJECT_DIR, SAP_DIR, cim);

  // 5. Read pre-patch app definition
  const PRE_APP = readAppDefinition(SAP_DIR);

  return { SAP_DIR, CIM_FILE, cim, Z_NAME: cim.ProjectName, CUSTOM_DIR, PRE_APP };
}
```

---

## Discovery Report

Print this before Phase 3 (CIM Validation):

```
DISCOVERY COMPLETE
══════════════════════════════════════════════════════════
Standard SAP folder : <SAP_DIR>
CIM file            : <CIM_FILE>
Z project name      : <Z_NAME>
Z project folder    : <CUSTOM_DIR>
App name            : <PRE_APP._Name>
Schema version      : <PRE_APP._SchemaVersion>
CIM IntegrationPoints: <N> entries
Patch package       : <PATCH_PKG>
Partial patch       : <Yes — N files / No — full package>
══════════════════════════════════════════════════════════
```

---

## Edge Cases

### Nested standard folder (ZIP extracted with wrapper)

If `PATCH_PKG` was a ZIP that extracted to a single root folder, `expandIfZip`
in Phase 1 already strips the wrapper. Apply the same logic when scanning
PROJECT_DIR if the structure is unusually nested:

```javascript
function resolveNestedRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    const inner = path.join(dir, entries[0].name);
    // Check if Application.app is in the inner dir
    if (fs.existsSync(path.join(inner, 'Application.app'))) return inner;
  }
  return dir;
}
```

### Standard folder not named `SAPAssetManager`

The algorithm does not rely on the folder being named `SAPAssetManager` —
it detects by `Application.app` presence. Any SAP standard folder name works.

### CIM file not at SAP directory root

If the CIM is nested (e.g. inside a subfolder of the standard dir), search
depth 2:

```javascript
function findCimFileDeep(SAP_DIR) {
  // Depth 1
  let cim = findCimFile(SAP_DIR);
  if (cim) return cim;
  // Depth 2 fallback
  for (const entry of fs.readdirSync(SAP_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    cim = findCimFile(path.join(SAP_DIR, entry.name));
    if (cim) return cim;
  }
  return null;
}
```

### PROJECT_DIR is the standard SAP folder itself

If the user passes the SAP standard folder directly as `PROJECT_DIR` and the
Z project sibling is one level up:

```javascript
// Detect: if Application.app exists at depth 0 in PROJECT_DIR, it IS the SAP folder
if (fs.existsSync(path.join(PROJECT_DIR, 'Application.app'))) {
  const SAP_DIR    = PROJECT_DIR;
  const PARENT_DIR = path.dirname(PROJECT_DIR);
  // Re-run discovery with PARENT_DIR
  return discoverProjectStructure(PARENT_DIR);
}
```
