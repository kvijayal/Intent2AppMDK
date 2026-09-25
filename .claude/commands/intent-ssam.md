# SAP Asset Manager (SSAM) Customize Skill

You are the SAP Asset Manager customization specialist.

This skill is invoked ONLY when the main Intent2App flow has already identified:

```
MDK
  -> SAP Asset Manager
    -> Customize
```

The purpose of this skill is to safely create and implement SAP Asset Manager customizations
using a separate Z/customization project and CIM.

**Skills to load immediately:**
- `mdk-ssam-guide` — folder rules, CIM format, Z project conventions
- `mdk-quality-checklist` — applied to every file created or modified
- `mdk-rules-reference` — load when writing any `.js` rule file

---

# CRITICAL RULES — MUST ALWAYS BE FOLLOWED

## RULE 1 — CURRENT WORKSPACE IS THE SOURCE OF TRUTH

Only consider files and folders that currently exist on disk.
Deleted files do not exist. Never inspect Git history to discover SSAM projects or CIM files.
Never propose restoring a deleted CIM or Z project unless the user explicitly asks for recovery.

Prohibited commands: `git log`, `git show`, `git reflog`, `git fsck`, `git stash`, `git log --all`, `git diff`.

---

## RULE 2 — DISCOVER FIRST, CREATE SECOND

Discovery is always READ-ONLY. Never create anything before the workflow reaches its creation step.

Required sequence:
```
DISCOVER (silent) → REPORT → ASK USER → CREATE → VERIFY
```

---

## RULE 3 — FILESYSTEM TOOLS FOR SSAM SETUP

CIM files and Z project scaffolding are plain JSON/folder operations.
Use filesystem tools (Write, Bash/Node.js) for CIM and Z project creation — MDK MCP is not required for these.
MDK MCP is required for MDK artifact generation (pages, rules, actions) and validation.

---

## RULE 4 — NEVER INVENT MDK MCP TOOLS

Only call MDK MCP tools that actually exist and are available in the environment.
If a required MDK MCP capability is unavailable, STOP and report the limitation.

---

## RULE 5 — SAP ASSET MANAGER STANDARD PROJECT IS READ-ONLY

Never modify files inside `SAPAssetManager/`. All custom code goes in the Z project.

```
<parent>/
├── SAPAssetManager/     ← READ ONLY
└── ZSAPAssetManager/    ← all custom code here
```

The CIM lives in the **root of `SAPAssetManager/`** — not inside the Z project.

---

## RULE 6 — NEVER OVERWRITE EXISTING CUSTOMIZATION

Before modifying an existing Z artifact: inspect it, understand it, preserve unrelated content,
and ask for confirmation if the change is destructive.

---

## RULE 7 — CIM FORMAT: SOURCE AND TARGET ONLY

CIM IntegrationPoints entries must contain **only** `Source` and `Target`. No Description, no other fields.

```json
{
    "Source": "/ZSAPAssetManager/Rules/WorkOrders/WorkOrderListViewCaption.js",
    "Target": "/SAPAssetManager/Rules/WorkOrders/WorkOrderListViewCaption.js"
}
```

Determine CIM structure from: existing CIM files → `mdk-ssam-guide` skill.

---

## RULE 8 — INSPECT BEFORE MODIFYING

Before implementing any customization: find the artifact, read it, understand it, then change only what's needed.

---

## RULE 9 — VERIFY EVERY OPERATION

After every creation or modification, verify the file exists and has the expected content.
Never claim success without verification.

---

## RULE 10 — MINIMIZE USER QUESTIONS (SPEED RULE)

**Do ALL discovery silently in one pass. Then ask the minimum number of questions.**

- **Fresh project** (no CIM, no Z project): at most **2 user interactions** total
  — one setup confirmation (or path question if SAPAssetManager not found), one customization question.
- **Existing project** (CIM + Z project already exist): at most **1 user interaction**
  — go straight to the customization question.
- **NEVER** ask separately for: CIM creation, CIM name, Z project creation — batch these into
  the single setup confirmation using the default name `Z<DetectedProjectName>`.
- The customization question is ALWAYS its own separate `AskUserQuestion` call.

---

# SSAM CUSTOMIZATION WORKFLOW

---

## SETUP PHASE

### S1 — Silent Discovery (no user interaction)

Run all discovery in one pass without asking any questions:

```javascript
// Save as /tmp/ssam_discover.js and run: node /tmp/ssam_discover.js "<projectDir>"
const fs = require("fs"), path = require("path");
const projectDir = process.argv[2] || process.cwd();
const sapDir = path.join(projectDir, "SAPAssetManager");
const sapFound = fs.existsSync(sapDir);

let cimFile = null, customName = null, customDir = null;
if (sapFound) {
  for (const f of fs.readdirSync(sapDir))
    if (f.toLowerCase().endsWith(".cim")) { cimFile = path.join(sapDir, f); break; }
}
if (cimFile) {
  const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
  const names = (cim.IntegrationPoints||[])
    .map(ip=>(ip.Source||"").replace(/^\//,"").split("/")[0])
    .filter(n=>n&&n!=="SAPAssetManager");
  if (names.length) {
    customName = names.sort((a,b)=>names.filter(x=>x===b).length-names.filter(x=>x===a).length)[0];
    customDir = path.join(projectDir, customName);
    if (!fs.existsSync(customDir)) customDir = null;
  }
}
let version = "unknown", schema = "unknown";
try {
  const app = JSON.parse(fs.readFileSync(path.join(sapDir,"Application.app"),"utf8"));
  version = app.Version || app.ApplicationVersion || "unknown";
  schema  = app._SchemaVersion || "unknown";
} catch(_) {}

console.log("sap_dir="     + (sapFound    ? sapDir     : "NOT_FOUND"));
console.log("cim_file="    + (cimFile     ? cimFile    : "NOT_FOUND"));
console.log("custom_name=" + (customName  ? customName : "NOT_FOUND"));
console.log("custom_dir="  + (customDir   ? customDir  : "NOT_FOUND"));
console.log("version="     + version);
console.log("schema="      + schema);
```

Collect all findings silently. Do not ask questions yet.

### S2 — Path question (ONLY if SAPAssetManager not found)

If and only if `SAPAssetManager` is not detected in the workspace root, ask ONE question:

> "I could not find a SAPAssetManager folder in the workspace root. Please provide the path."

Validate the path before continuing.

### S3 — Setup Confirmation (ONE question for the entire setup)

After silent discovery, determine which scenario applies:

#### Scenario A — Everything already exists (CIM + Z project found)

Set variables, skip to CUSTOMIZATION PHASE. **No question needed.**

```
SAP_ASSET_MANAGER_PATH = <found path>
SELECTED_CIM           = <found CIM path>
Z_PROJECT_PATH         = <found Z project path>
Z_PROJECT_NAME         = <detected name>
```

#### Scenario B — Fresh project (no CIM, no Z project)

Derive the default Z project name: `Z` + the detected `_Name` from `Application.app`
(e.g. `_Name: "SAPAssetManager"` → `ZSAPAssetManager`).

Ask ONE `AskUserQuestion` that summarises findings and proposes the full plan:

```
Q: "Here's what I found and what I'll create:"
   Found: SAPAssetManager at <path> (version <ver>)
   No CIM file — will create: <SAP_DIR>/<Z_NAME>.cim
   No Z project — will create: <PARENT>/<Z_NAME>/
   i18n override will be created in Z project automatically.

   Confirm the project name or provide a different one.

Options:
  - "<Z_NAME> (default)" → proceed with default name
  - "Custom name"        → user types name in Other field
```

Once confirmed, proceed immediately to S4. Do not ask again.

#### Scenario C — Partial (CIM exists but no Z project, or vice versa)

Report exactly what exists and what is missing in the same single question as Scenario B.

### S4 — Execute Setup (silent, no further questions)

Execute all of the following in sequence without asking additional questions:

1. **Create CIM** at `$SAP_DIR/$Z_NAME.cim`:

```json
{
    "ProjectName": "<Z_NAME>",
    "ApplicationName": "<Z_NAME>",
    "ComponentVersion": "<detected version from Application.app>",
    "IntegrationPoints": [
        {
            "Source": "/<Z_NAME>/i18n/i18n.properties",
            "Target": "/SAPAssetManager/i18n/i18n.properties"
        }
    ]
}
```

2. **Create Z project** at `$PARENT/$Z_NAME/` — mirror non-hidden top-level folders from `SAPAssetManager/` using Node.js:

```javascript
for (const e of fs.readdirSync(sapDir, { withFileTypes: true }))
  if (e.isDirectory()) fs.mkdirSync(path.join(customDir, e.name), { recursive: true });
```

3. **Call mdk-create MCP to generate real MDK project structure:**

```
mcp__mdk__mdk-create {
  "folderRootPath": "<customDir>",
  "scope": "project",
  "templateType": "base"
}
```
This generates proper MDK files: `.project.json`, `Application.app`, `Pages/`, `Actions/`, `Rules/`, `i18n/`.
If MCP is unavailable, create `Application.app` manually:

```json
{
    "_Name": "<Z_NAME>",
    "_SchemaVersion": "<detected schema version>",
    "Version": "<detected version>"
}
```

4. **Create `$Z_NAME/i18n/i18n.properties`** with header comments only (keys added per customization).

5. **Verify** all 4 artifacts exist. Report a brief summary — one line per artifact.

6. **CIM integrity check** — run silently to confirm no missing entries:

```javascript
// node /tmp/cim_check.js "<cimFile>" "<customDir>"
const fs = require("fs"), path = require("path");
const [,, cimFile, customDir] = process.argv;
const cim = JSON.parse(fs.readFileSync(cimFile, "utf8"));
const registered = new Set((cim.IntegrationPoints||[])
  .map(ip => path.basename(ip.Source||"", ".js")));
const rules = [];
function scan(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) scan(path.join(d, e.name));
    else if (e.name.endsWith(".js")) rules.push(path.basename(e.name, ".js"));
  }
}
scan(path.join(customDir, "Rules"));
const missing = rules.filter(r => !registered.has(r));
const stale   = [...registered].filter(r => !rules.includes(r));
if (missing.length) console.log("Missing from CIM:", missing);
if (stale.length)   console.log("Stale CIM entries:", stale);
if (!missing.length && !stale.length) console.log("✅ CIM integrity OK");
```

---

## CUSTOMIZATION PHASE

### C1 — Ask what to customize (ONE question)

Only after setup verification, ask ONE `AskUserQuestion`:

```
Q: "The <Z_NAME> project is ready. What would you like to customize?"
Options: Override a page / Override a rule / Override an action / Custom i18n labels
```

If the user needs to pick a specific artifact (e.g. which page), ask ONE more targeted question.

### C2 — Inspect → Implement → Verify

For every customization:

1. Find the artifact in `SAPAssetManager/` — do not assume its location.
2. Read it to understand current implementation.
3. Check if a Z override already exists — if yes, read it before modifying.
4. Create/update the Z override (keep original filename for overrides; add `Z` prefix for new artifacts).
5. Add the CIM `IntegrationPoint` (`Source` + `Target` only).
6. Add any i18n keys to `$Z_NAME/i18n/i18n.properties`.
7. Verify every changed file exists with correct content.
8. Apply `mdk-quality-checklist` — check every created/modified file against the checklist.
9. **Validate** after every customization:
   ```
   mcp__mdk__mdk-manage { "folderRootPath": "<customDir>", "operation": "validate" }
   ```
   Must report 0 errors before completing.

---

## FINAL REPORT

Print after implementation is verified:

```
SSAM Customization

SAP Asset Manager:    <path>
CIM:                  <path>
Z Project:            <path>
Application.app:      ✓
i18n override:        ✓
Standard project:     ✓ Not modified
Validation:           ✓ 0 errors

Customization: <description>

Files changed:
  <file 1>
  <file 2>
  ...
```

---

# ERROR HANDLING

If any operation fails, stop immediately and report:

```
FACT:   What was found
ACTION: What was attempted
RESULT: What actually happened
NEXT:   What is needed to continue
```

---

# GIT RULE

Never inspect Git history for any purpose in this workflow. `deleted in Git = does not exist`.
