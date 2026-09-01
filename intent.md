---
description: >
  End-to-end SAP BTP build from a Functional Design or requirement — Clean Core analysis, interactive
  architecture (asks you at every decision gate), Technical Design Document, code generation, review,
  and Unit Testing Document. Deliverables land under <app>/deliverables/ (markdown).
argument-hint: "<path-to-FD-file | one-line requirement>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Skill, Agent, TodoWrite, mcp__intent2app__scaffold_app, mcp__intent2app__add_cds_entity, mcp__intent2app__generate_annotations, mcp__intent2app__gen_mock_from_edmx, mcp__intent2app__configure_service, mcp__intent2app__validate_namespace, mcp__intent2app__run_checks, mcp__intent2app__clean_core_check, mcp__intent2app__mdk_mobile_services, mcp__mdk__mdk-create, mcp__mdk__mdk-gen, mcp__mdk__mdk-manage, mcp__mdk__mdk-docs, Skill(mdk-project-setup), Skill(mdk-bundler-settings)
model: inherit
---

# Intent2App

You are running the **Intent2App** end-to-end flow in the MAIN thread (so you — and only you — can use `AskUserQuestion`). The requirement / FD is:

> $ARGUMENTS

> **HARD RULE — MDK MCP server is mandatory for ALL MDK and SSAM queries.**
> Never answer MDK or SAP Asset Manager (SSAM) questions using only Glob/Grep/Read.
> Always call MDK MCP tools first. If the server is unreachable at port 3999, stop and tell the developer:
> "MDK MCP server is not reachable. Start it and reload Claude Code before retrying."
> Do NOT fall back to file-system tools for MDK/SSAM queries — surface the error instead.

**MDK dependencies (run only when requirement mentions mobile, field worker, offline, barcode scanner, MDK, or SAP Mobile Services — skip entirely for CAP/Fiori/UI5).**

If the requirement suggests an MDK app, run these checks via Bash:

```bash
npx @sap/mdk-tools --version 2>/dev/null && echo "MDK_CLI=ok" || echo "MDK_CLI=missing"
node --version
```

- **If `@sap/mdk-tools` is missing** → auto-install without asking: `npm install -g @sap/mdk-tools`. Re-probe. If still missing → **HARD STOP**: "Could not install @sap/mdk-tools. Check npm registry access and re-run /intent."
- **If Node.js < 22** → warn: "MDK CLI requires Node.js 22+." Continue — developer can still work on scaffolding; CLI validation will fail at build/deploy time.
- **If all MDK checks pass** → print `✓ MDK dependencies ready.`

**PRE-FLIGHT 3 — VS Code MDK Extension (MDK only).**

If MDK is in scope, print this reminder (do not block):

> ⚠ MDK requires the VS Code MDK Extension (`SAPSE.vsc-extension-mdk`) to generate `.service.metadata` via the IDE.
> Alternatively, `mcp__intent2app__mdk_mobile_services` fetches `.service.metadata` automatically (requires CF login).

---

**STEP 0-A — Detect workspace and developer type.**

**First — silently scan the workspace for existing projects:**
```bash
find . -name ".project.json" -maxdepth 4 2>/dev/null | head -5
find . -name ".cdsrc.json" -maxdepth 3 2>/dev/null | head -3
find . -name ".service.metadata" -maxdepth 4 2>/dev/null | head -3
find . -type d -name "SAPAssetManager" -maxdepth 4 2>/dev/null | head -3
find . -name "*.CIM" -maxdepth 6 2>/dev/null | head -3
```

**If an existing MDK project is found** (`.project.json` exists):
- Call `Skill(mdk-project-setup)` with `{ "projectDir": "<detected-path>" }`
- **Check if this is a SAP Asset Manager project:** use the scan results above — if a `SAPAssetManager/` directory OR a `.CIM` file was detected anywhere in the workspace, this is an SSAM project.
  - **SSAM project detected** → jump directly to **SSAM Workflow STEP S1** (do NOT show the standard Standalone MDK options below).
  - **Not an SSAM project** → show the standard Standalone MDK options:
- ❓ **AskUserQuestion**: "Found an existing MDK project at `<path>` (App: `<appName>`, Schema: `<version>`). What would you like to do?"
  Options:
  - "Modify this existing project — add pages, entities, actions, or features"
  - "Deploy, build, validate, or manage this project"
  - "Generate new pages or actions for an entity in this project"
- Jump to MDK Fast Path STEP 2c, passing `projectDir` and project context — skip STEP 1 and Mobile Services setup.

**If no existing project found** → ❓ **AskUserQuestion** (Question 1 of 2 — top-level app type only; do NOT include SAP Asset Manager here):
"What type of app are you building?"
  Options:
  - "CAP / Fiori / UI5 — backend service, Fiori Elements, or freestyle UI5 on BTP (Recommended)"
  - "MDK — mobile app for iOS/Android via SAP Mobile Development Kit"

**Route Question 1 answer:**

- **CAP / Fiori / UI5 selected** → proceed to PRE-FLIGHT 4 (Yeoman + CDS checks) and then STEP 0.
- **MDK selected** → **STOP. Do not proceed yet.** First ask Question 2 (a separate, follow-up question):

  ❓ **AskUserQuestion** (Question 2 of 2 — only asked after MDK is selected above):
  "Which type of MDK application are you working with?"
    Options:
    - "Standalone MDK — a custom MDK app built with the SAP Mobile Development Kit"
    - "SAP Asset Manager (SSAM) — Upgrade or Customize an existing SSAM project"

  **Route Question 2 answer:**
  - **Standalone MDK selected** → jump to MDK Fast Path STEP 1.
  - **SAP Asset Manager (SSAM) selected** → jump to **SSAM Workflow STEP S1**.

**PRE-FLIGHT 4 — Yeoman + SAP Fiori generator (CAP/Fiori/UI5 path only).**

Run all three checks below in parallel. Do not start STEP 0 until all three pass.

---

## CHECK 1 — MCP server

Call `mcp__intent2app__validate_namespace` with `{ "namespace": "com.preflight.check", "projectDir": "." }` as a lightweight probe.

- **Succeeds** → print `✓ MCP server is running.` Done.
- **Fails / times out** → auto-recover via Bash without asking the developer:

  ```bash
  cd mcp-server && npm install
  ```

  ```bash
  npm run start-http &
  ```

  Wait 3 seconds, then re-probe `mcp__intent2app__validate_namespace`.

  - **Re-probe succeeds** → print `✓ MCP server installed and started automatically.` Done.
  - **Re-probe fails** → print the message below, then fall back to skills for all `mcp__intent2app__*` steps:

    ```text
    ⚠ MCP server could not be started automatically.
    To start it manually: cd mcp-server && npm install && npm run start-http
    Then re-run /intent <your-requirement>.
    ```

---

## CHECK 2 — Yeoman + SAP Fiori generator (install + compatibility test)

Run via Bash in parallel:

```bash
yo --version 2>&1
npm list -g @sap/generator-fiori 2>&1
```

- **Both succeed** → proceed to compatibility test below.
- **Either fails** → auto-install without asking the developer:

  ```bash
  npm install -g yo @sap/generator-fiori
  ```

  Re-probe. If still failing → **HARD STOP** (see below).

**Compatibility test (mandatory — run immediately after confirming `yo` + `@sap/generator-fiori` are installed):**

```bash
yo @sap/fiori:headless 2>&1
```

- **Output contains `Please provide one of the following`** → generator loaded correctly. Print `✓ Yeoman + @sap/generator-fiori ready.` Done.
- **Output contains `this.env.error is not a function`** → yo version is incompatible (yo@7 / yeoman-environment@6 removed `env.error()`; yo@5 also breaks in the same way). **Auto-fix without asking:**

  ```bash
  npm install -g yo@4 2>&1
  ```

  yo@4 uses yeoman-environment@3 which has `env.error`. After install, re-run the compatibility test. If it now outputs `Please provide one of the following` → print `✓ yo@4 installed automatically. Yeoman + @sap/generator-fiori ready.` and continue. If it still fails → **HARD STOP** with the exact error and ask the developer to run the terminal as Administrator, then re-run `/intent`.
- **Any other failure** → **Auto-fix:** first parse `yo --version`; if major ≥ 5, run `npm install -g yo@4` and re-probe once. If still failing → **HARD STOP** with the exact error output.

---

---

## CHECK 3 — CDS CLI (global install + version sync)

`cds init` will fail silently if `@sap/cds-dk` is not installed globally or is on an outdated major.
Auto-detect, auto-install/upgrade, then sync project defaults if the major changed.

**Step A — detect installed and latest versions (run via Bash):**

```bash
npm list -g @sap/cds-dk --depth=0 2>&1
npm view @sap/cds-dk version 2>&1
```

Parse the results:

| Variable | Source | Example |
|---|---|---|
| `INSTALLED_CDS_DK` | Extract from `└── @sap/cds-dk@{version}` line; set to `none` if absent | `10.3.1` |
| `LATEST_CDS_DK` | Bare version string from `npm view` | `10.5.2` |
| `INSTALLED_MAJOR` | Major integer from `INSTALLED_CDS_DK`; `0` if `none` | `10` |
| `LATEST_MAJOR` | Major integer from `LATEST_CDS_DK` | `10` |
| `DEFAULT_MAJOR` | Read from `CLAUDE.md` stack defaults table — currently `10` | `10` |

**Step B — decision tree:**

| State | Condition | Action |
|---|---|---|
| Not installed | `INSTALLED_CDS_DK = none` | Auto-install: `npm install -g @sap/cds-dk@latest` |
| Installed, major behind latest | `INSTALLED_MAJOR < LATEST_MAJOR` | Auto-upgrade: `npm install -g @sap/cds-dk@latest` |
| Installed, same major as latest | otherwise | No action needed |

**Install / upgrade command (run via Bash):**

```bash
npm install -g @sap/cds-dk@latest 2>&1
```

- **Exits 0** → proceed to Step C.
- **Exits non-zero with `EACCES`** (Linux/Mac permissions) → retry:
  ```bash
  npm install -g @sap/cds-dk@latest --unsafe-perm 2>&1
  ```
  If still failing → **HARD STOP**: tell the developer to either run the terminal as Administrator (Windows) or fix npm global prefix permissions (`npm config set prefix ~/.npm`) and re-run `/intent`.
- **Exits non-zero with network error** → **HARD STOP**: check internet access; suggest `npm install -g @sap/cds-dk@latest --prefer-offline` if a cached version exists.
- **Any other non-zero exit** → **HARD STOP** with the exact error output.

**Step C — verify installation succeeded:**

```bash
cds --version 2>&1
```

Output must contain `@sap/cds-dk:`. If not → **HARD STOP** with: "`cds` command still not found after install — the global npm bin directory may not be on PATH. Run `npm config get prefix` and add its `bin/` subdirectory to your PATH."

Re-parse to get `NEW_INSTALLED_MAJOR` from the verified output.

**Step D — sync project defaults if major changed:**

If `NEW_INSTALLED_MAJOR != DEFAULT_MAJOR`, update these files by replacing every `^{DEFAULT_MAJOR}` CDS/driver version reference with the correct `^{NEW_MAJOR}`:

- `CLAUDE.md` — stack defaults table rows: `@sap/cds`, `@sap/cds-dk`, `@cap-js/hana`, `@cap-js/sqlite`
- `reference-apps/cap-fullstack-listreport/package.json`
- `reference-apps/cap-fullstack-freestyle/package.json`
- `reference-apps/cap-service-only/package.json`

Use the driver version mapping rule from `CLAUDE.md`:
> CDS 9 → `@cap-js/sqlite ^2`, `@cap-js/hana ^2`; CDS 10 → `@cap-js/sqlite ^3`, `@cap-js/hana ^3`; CDS 11+ → run `npm view @cap-js/sqlite version` and `npm view @cap-js/hana version` to determine the current matching major, then use those.

If `NEW_INSTALLED_MAJOR == DEFAULT_MAJOR`: no file edits needed. Print `✓ @sap/cds-dk {version} — stack defaults already aligned (^{DEFAULT_MAJOR}).`

If edits were made: print `✓ @sap/cds-dk upgraded to {NEW_VERSION}. CLAUDE.md and reference apps updated to ^{NEW_INSTALLED_MAJOR}.`

---

Once all three checks are resolved, print a single readiness summary, e.g.:

```text
✓ MCP server ready
✓ Yeoman + @sap/generator-fiori ready
✓ @sap/cds-dk 10.5.2 ready (stack defaults aligned, ^10)
▶ Starting /intent flow...
```

Then proceed to STEP 0.

---

---

## MDK Fast Path (only when MDK is selected in STEP 0-A, or when existing MDK project is detected)

**Do not run STEP 0–9 for MDK. Use only this section.**

---

### MDK STEP 1 — Initialize MDK dependencies

Run immediately after MDK is selected. Skip the Yeoman and CDS checks — they are not needed for MDK.

```bash
npx @sap/mdk-tools --version 2>/dev/null && echo "MDK_CLI=ok" || echo "MDK_CLI=missing"
node --version
```

| Dependency | Status | Action if missing |
|---|---|---|
| `@sap/mdk-tools` (MDK CLI) | ✅ / ❌ | Auto-install: `npm install -g @sap/mdk-tools` |
| Node.js >= 22 | ✅ / ⚠️ | https://nodejs.org |

- If `@sap/mdk-tools` missing after auto-install → **HARD STOP**: "Could not install @sap/mdk-tools. Check npm registry access."
- If Node.js < 22 → warn but continue.

Print: `✓ MDK dependencies ready. ▶ MDK Fast Path active`

Do NOT check CF login here — check it only when a CF-dependent intent is identified in STEP 3.

**MDK MCP server check (mandatory — run immediately after MDK CLI check):**

Call `mcp__mdk__mdk-docs` with `{ "topic": "overview" }` as a lightweight probe.

- **Succeeds** → print `✓ MDK MCP server is running at port 3999.` Done.
- **Fails / connection refused** → **HARD STOP**:
  ```
  ✗ MDK MCP server is not reachable at http://localhost:3999/mcp.
  All MDK and SSAM queries require the MDK MCP server.
  To start it: cd mcp-server && npm run start-http
  Then reload the Claude Code window and re-run /intent.
  ```
  Do NOT proceed. Do NOT fall back to file-system tools for MDK questions.

---

### MDK STEP 2 — Capture requirement

**2a. If entering from a new MDK selection (no existing project):**

If `$ARGUMENTS` already contains a specific MDK requirement, use it directly without asking.
Otherwise use ❓ **AskUserQuestion**:

Q1: "What would you like to do?"
Options:
  - "Create a new MDK app"
  - "Modify an existing MDK project"
  - "Deploy my MDK app"
  - "Validate / build my MDK project"

Q2: "Describe what you want to build" (if Q1 = Create new)
Options:
  - "Field Service (Work Orders, Equipment, Technicians) — technicians view and update work orders, equipment inspection, service history"
  - "Inventory / Warehouse (Products, Stock, Locations) — warehouse workers view stock levels, scan barcodes, transfer inventory"
  - "Inspection / Quality (Checklists, Findings, Photos) — inspectors complete structured checklists, capture photos, submit findings offline"
  - "Other — I will describe it myself"

**2c. If entering from an existing project detection (STEP 0-A):**

The project context is already loaded. Skip straight to STEP 3 using the project context as input. No need to ask for requirement — the intent is already known from the developer's selection in STEP 0-A.

---

### MDK STEP 3 — Identify intent

Classify the requirement into exactly one intent:

| Intent | Keywords | Required before spawning agent |
|---|---|---|
| `create-project` | "create", "new app", "scaffold", "build app" | CF login check |
| `add-entity` | "add entity", "add page", "new page", "add feature" | None |
| `deploy` | "deploy", "publish", "upload to mobile services" | CF login check |
| `validate` | "validate", "check errors", "lint" | None |
| `build` | "build", "bundle", "package" | None |
| `generate-artifact` | "generate page", "generate action", "create rule" | None |
| `modify-project` | "modify", "update", "change", "fix", "add to existing" | None |
| `show-qrcode` | "qr code", "onboard device", "scan" | None |
| `migrate` | "migrate", "upgrade schema", "update schema version" | None |

Print the identified intent: `"Identified intent: **[intent]** — proceeding."`

---

### MDK STEP 4 — Check dependencies for identified intent

**Only check what the identified intent actually needs. Skip everything else.**

#### CF login check (create-project and deploy only):
```bash
cf target 2>/dev/null | grep "org:" && echo "CF_AUTH=ok" || echo "CF_AUTH=not_logged_in"
```
- Logged in → extract `cfOrg` and `cfSpace`, print `✓ CF target: <org> / <space>.`
- Not logged in → **HARD STOP**: "CF login required. Open a terminal and run `cf login -a https://api.cf.<region>.hana.ondemand.com --sso`, then re-run /intent."

**For all other intents (validate, build, generate, modify, add-entity, show-qrcode, migrate):** skip this step entirely — no CF check needed.

**Everything else** (workspace scan for existing project, Mobile Services app/destination discovery, entity set selection, template type, online vs offline mode) is handled entirely by the `mdk-developer` agent via BLOCKING messages. Do not ask the developer about these in the main flow.

---

### MDK STEP 5 — Execute via mdk-developer agent

Spawn the `mdk-developer` agent with this brief:

```
intent:       <identified intent from STEP 3>
requirement:  <full requirement text from STEP 2 or developer selection in STEP 0-A>
projectDir:   <current working directory as absolute path>
cfOrg:        <from STEP 4, or null>
cfSpace:      <from STEP 4, or null>
```

Wait for the agent to return. If it returns a `BLOCKING:` message, surface it to the developer with ❓ **AskUserQuestion**, collect the answer, append it to the brief, and re-spawn the agent.

---

### MDK STEP 6 — Post-execution report

Print the agent's "MDK Build Summary" verbatim. Then ask:

❓ **AskUserQuestion**: "What would you like to do next?" with options:
- Deploy to Mobile Services
- Validate the project
- Build the project
- Done

Route the answer back to STEP 3 → STEP 4 → STEP 5, or exit if "Done".

---

---

## SSAM Workflow (only when SAP Asset Manager is selected in STEP 0-A)

**Do not run CAP/Fiori steps or Standalone MDK steps for SAP Asset Manager. Use only this section.**

**Load `Skill(mdk-ssam-workflow)` now** — it contains SSAM project structure templates, CIM file patterns, override patterns, and Z naming conventions.

**Non-negotiable rules — never break these:**
- `SAPAssetManager/` (the SAP standard project) is **read-only** — never generate or modify files inside it.
- The Z/custom project is **the only target** for all customizations and new artifacts.
- Never overwrite existing Z/custom files without explicit user confirmation.
- Always preserve the standard folder structure when creating overrides.
- Ask permission before creating a missing `.CIM` or Z project.
- Ask permission before any destructive operation.
- Inspect before modifying — always read the relevant files first.

---

### SSAM STEP S1 — Ask operation type

❓ **AskUserQuestion**: "What do you want to do with the SAP Asset Manager application?"
Options:
- "Upgrade — update to a new SSAM/MDK version"
- "Customize — add or modify functionality in the SSAM project"

- **Upgrade selected** → proceed to **SSAM Upgrade Flow**.
- **Customize selected** → proceed to **SSAM Customize Flow**.

---

### SSAM Upgrade Flow

#### SSAM-U1 — Detect workspace

Silently detect the project structure (scan, do not ask):

```bash
SAP_DIR=$(find . -type d -name "SAPAssetManager" -maxdepth 4 2>/dev/null | head -1)
echo "Standard project: ${SAP_DIR:-NOT FOUND}"
# CIM file lives in the root of SAPAssetManager/ only
[ -n "$SAP_DIR" ] && CIM_FILE=$(find "$SAP_DIR" -maxdepth 1 \( -name "*.CIM" -o -name "*.cim" \) 2>/dev/null | head -1) || CIM_FILE=""
echo "CIM file:         ${CIM_FILE:-NOT FOUND}"
# Detect Z/custom project — folders with MDK artifact structure that are NOT SAPAssetManager
find . -maxdepth 3 -type d \( -name "Rules" -o -name "Pages" -o -name "Actions" \) 2>/dev/null \
  | grep -v "SAPAssetManager" | grep -v "node_modules" | sed 's|/[^/]*$||' | sort -u | head -5
```

Try to detect the current SSAM version:

```bash
[ -n "$SAP_DIR" ] && python3 -c "
import json, sys
for f in ['$SAP_DIR/Application.app', '$SAP_DIR/.project.json']:
    try:
        p = json.load(open(f))
        print(f, '→ version:', p.get('ApplicationVersion', p.get('SdkVersion', 'unknown')))
    except: pass
" 2>/dev/null || echo "Version: could not detect"
```

**If `SAPAssetManager/` is NOT found:**
→ Tell the user: "Could not locate the SAP Asset Manager standard project (`SAPAssetManager/`) in the workspace. Please open the correct project folder and re-run /intent."
→ **HARD STOP** — do not proceed without the standard project.

**If found:** record `ssamProjectDir = $SAP_DIR`, `cimFile = $CIM_FILE`. Report all findings.

#### SSAM-U2 — Identify all custom artifacts

List all customer-specific files to preserve during upgrade:

```bash
find . -maxdepth 6 \( -name "*.js" -o -name "*.page" -o -name "*.action" \) 2>/dev/null \
  | grep -v "SAPAssetManager" | grep -v "node_modules" | head -40
```

Report: list of all Z/custom files that must be preserved. State explicitly which are the developer's customizations — none of them must be lost during upgrade.

#### SSAM-U3 — Identify target version

If the user provided a target version or ZIP path in their request → use it.
Otherwise → ❓ **AskUserQuestion**: "What version do you want to upgrade to?"
Options:
- "I'll provide the path to the new SAPAssetManager ZIP file"
- "I need guidance on finding the latest version"

If "I need guidance" → tell the developer:
> Download the latest SAP Asset Manager metadata ZIP from the SAP Help Portal:
> https://help.sap.com/docs/SAP_SERVICE_ASSET_MANAGER → Select your target version → Download metadata ZIP.

Collect: `targetVersion` and `newVersionZipPath` (full path to the new version ZIP).

#### SSAM-U4 — Pre-upgrade CIM audit

Check that all custom Z rules are registered in the CIM, and there are no stale entries:

```bash
CIM_FILE_PATH="${cimFile}"
find . -maxdepth 6 -name "*.js" 2>/dev/null \
  | grep -v "SAPAssetManager" | grep -v "node_modules" \
  | xargs -I{} basename {} .js | sort > /tmp/intent_ssam_js.txt
grep -o 'name="[^"]*"' "$CIM_FILE_PATH" 2>/dev/null \
  | sed 's/name="//;s/"//' | sort > /tmp/intent_ssam_cim.txt
echo "=== Custom rules NOT in CIM (must register before upgrade) ==="
comm -23 /tmp/intent_ssam_js.txt /tmp/intent_ssam_cim.txt
echo "=== Stale CIM entries (review) ==="
comm -13 /tmp/intent_ssam_js.txt /tmp/intent_ssam_cim.txt
```

If missing CIM entries found → tell the user exactly which rules are unregistered.
❓ **AskUserQuestion**: "Found <n> custom rules not registered in the CIM. How would you like to proceed?"
Options:
- "Add the missing CIM entries now"
- "I'll fix this manually before continuing"

If "Add now" → add the missing entries (use CIM entry format from `mdk-ssam-workflow` skill). Ask for confirmation before writing each entry.

#### SSAM-U5 — Identify conflicts and customizations

Document all existing customizations before making any changes:
- Map each Z/custom file to the standard file it overrides (via CIM `overrides` attribute or path match)
- Note which standard files are suspected to change in the target version (if the new ZIP is available, inspect it; otherwise note this cannot be fully determined without the ZIP)

Report a conflict summary:
```
Existing customizations:
  <Z file path>  →  overrides  →  <SAPAssetManager file path>
  ...

Potentially impacted by upgrade:
  <files where a standard change was detected or suspected>
  (Complete conflict analysis requires the new version ZIP)
```

#### SSAM-U6 — Confirm before proceeding

❓ **AskUserQuestion**: "Here is the upgrade plan and conflict summary. How would you like to proceed?"
Options:
- "Proceed — guide me through the SAP Metadata Upgrade Tool workflow"
- "Show me the conflict details first"
- "Stop — I need to review manually"

If "Proceed" → load `Skill(mdk-ssam-upgrade)` and follow its complete workflow:
- Phase 6 — prepare the customized ZIP
- Phase 7 — Metadata Upgrade Tool (external Electron app — Claude guides, cannot execute)
- Phase 8 — extract and CIM post-audit
- Phase 9 — validate

> ⚠️ The SAP Metadata Upgrade Tool is an external Electron application. Claude guides the developer step by step but cannot run the tool itself.

Before any step that modifies files, tell the user exactly what will change and ask for confirmation.

#### SSAM-U7 — Post-upgrade summary

After the upgrade completes:
1. Re-run the CIM post-audit (Phase 8 of `mdk-ssam-upgrade`)
2. Run MDK validation: call `mcp__mdk__mdk-manage` with `{ "folderRootPath": ".", "operation": "validate" }`
3. Report: files upgraded · customizations confirmed present · conflicts resolved vs. open · remaining issues

---

### SSAM Customize Flow

#### SSAM-C1 — Find the SAP Asset Manager project

Silently inspect the workspace:

```bash
SAP_DIR=$(find . -type d -name "SAPAssetManager" -maxdepth 4 2>/dev/null | head -1)
echo "Standard project: ${SAP_DIR:-NOT FOUND}"
[ -n "$SAP_DIR" ] && ls "$SAP_DIR" 2>/dev/null | head -20
```

**If `SAPAssetManager/` is NOT found:**
→ Tell the user: "I could not find a SAP Asset Manager project (`SAPAssetManager/`) in the current workspace."
→ ❓ **AskUserQuestion**: "How would you like to proceed?"
Options:
- "Open the correct project folder and re-run — I'll open the folder containing SAPAssetManager/ in VS Code and run /intent again"
- "I know the path — provide it now (e.g. /Users/me/Projects/MySSAMProject/SAPAssetManager)"

- **"Open and re-run"** → **HARD STOP**: "Please open the folder containing `SAPAssetManager/` in VS Code and re-run /intent."
- **"I know the path" / Other (user typed a path)** → treat the user's input as `ssamProjectDir`. Validate immediately:
```bash
PROVIDED_PATH="<path from user input>"
ls "$PROVIDED_PATH" 2>/dev/null | head -10
```
If the path exists and contains recognizable SSAM structure (Pages/, Rules/, Actions/, or similar) → set `ssamProjectDir = $PROVIDED_PATH`. Continue.
If the path does not exist or has no recognizable structure → tell the user: "The path `<path>` could not be verified as an SSAM project. Please check the path and re-run." **HARD STOP**.

**If found (auto-detected or user-provided):** record `ssamProjectDir`. Report: root directory and top-level structure (Pages, Rules, Actions, Services, etc.).

#### SSAM-C2 — Check for the `.CIM` file

Search only in the **root** of `SAPAssetManager/` (not subdirectories, not the workspace root):

```bash
# CIM lives in the root of SAPAssetManager/ — maxdepth 1 only
CIM_FILE=$(find "$SAP_DIR" -maxdepth 1 \( -name "*.CIM" -o -name "*.cim" \) 2>/dev/null | head -1)
echo "CIM: ${CIM_FILE:-NOT FOUND}"
[ -n "$CIM_FILE" ] && cat "$CIM_FILE" 2>/dev/null
```

**If `.CIM` / `.cim` exists in `$SAP_DIR/`:** record `cimFile = $CIM_FILE`. Inspect and report: location · contents · the integration points or custom artifacts it defines. Continue to SSAM-C3.

**If no `.CIM` / `.cim` found in `$SAP_DIR/`:**
→ Tell the user: "The SAP Asset Manager project does not contain a `.cim` file in its root folder (`$SAP_DIR/`). This file registers the custom component and its integration points. Without it, the customization layer will not be recognized."

❓ **AskUserQuestion**: "Do you want me to create the `.cim` file?"
Options:
- "Yes — create ZSAPAssetManager.cim"
- "No — I'll handle this manually"

- **No** → **HARD STOP**: "Please create or locate the `.cim` file in `$SAP_DIR/` and re-run."
- **Yes** → Create `$SAP_DIR/ZSAPAssetManager.cim` with this exact JSON content:
```json
{
    "ProjectName": "ZSAPAssetManager",
    "ApplicationName": "ZSAPAssetManager",
    "ComponentVersion": "2405.3.1.010",
    "IntegrationPoints": [
        {
            "Source": "/AssetManagerAddon/Services/ZAssetManager.service",
            "Target": "/SAPAssetManager/Services/AssetManager.service"
        }
    ]
}
```
Verify the file was created at `$SAP_DIR/ZSAPAssetManager.cim`. Set `cimFile = "$SAP_DIR/ZSAPAssetManager.cim"`. Continue to SSAM-C3.

#### SSAM-C3 — Check for the Z/custom project

Detect the customer customization project:

```bash
# Find directories with MDK artifact structure that are NOT SAPAssetManager
find . -maxdepth 3 -type d \( -name "Rules" -o -name "Pages" -o -name "Actions" \) 2>/dev/null \
  | grep -v "SAPAssetManager" | grep -v "node_modules" | grep -v "\.git" \
  | sed 's|/[^/]*$||' | sort -u | head -5
```

**If Z/custom project found:** record `zProjectDir = <detected root>`. Inspect existing files:

```bash
find "$zProjectDir" -type f 2>/dev/null | grep -v "node_modules" | head -30
```

Report: existing customizations · which standard artifacts they override. State that existing Z files will be preserved and NOT overwritten without confirmation. Continue to SSAM-C4.

**If Z/custom project NOT found:**
❓ **AskUserQuestion**: "No customer customization project was found. Would you like me to create one?"
Options:
- "Yes — create the Z/custom project"
- "No — I'll create it manually"

- **No** → **HARD STOP**.
- **Yes** → Ask for the project name (suggest one prefixed with `Z` based on the standard project). Create the project using the Z project template from `mdk-ssam-workflow` skill. Set `zProjectDir`. Continue to SSAM-C4.

#### SSAM-C4 — Ask what to customize

All prerequisites confirmed:
- ✅ SAP Asset Manager standard project at `<ssamProjectDir>`
- ✅ `.CIM` file at `<cimFile>`
- ✅ Z/custom project at `<zProjectDir>`

❓ **AskUserQuestion**: "What would you like to customize in the SAP Asset Manager application?"
Options:
- "Modify an existing standard page, rule, or action"
- "Add new custom functionality (new page, rule, or action)"
- "Modify standard business logic or a workflow"
- "I'll describe my requirement"

After the user describes their requirement, proceed to SSAM-C5. Accept natural language — examples: "modify the operation confirmation behavior", "add a field to the work order detail page", "change the equipment list to show maintenance notifications", "add a new custom report page".

#### SSAM-C5 — Analyze and classify the requirement

Determine whether this is:

**A — Override of existing SAP standard artifact** (modifying a page/rule/action that exists in `SAPAssetManager/`) → follow **SSAM-C6**.

**B — New customer-specific artifact** (adding functionality with no equivalent in `SAPAssetManager/`) → follow **SSAM-C7**.

Search `SAPAssetManager/` to determine classification:

```bash
# Adjust keyword/filename from the user's requirement
find "$SAP_DIR" -type f \( -name "*.page" -o -name "*.js" -o -name "*.action" \) 2>/dev/null \
  | xargs grep -l "<keyword>" 2>/dev/null | head -10
find "$SAP_DIR" -type f -name "*<keyword>*" 2>/dev/null | head -10
```

Tell the user what was found, which classification applies, and which pattern will be followed — before proceeding.

#### SSAM-C6 — Standard Override Pattern

Applies when the requirement modifies an existing SAP standard artifact.

**Step 1 — Find the exact standard file:**

```bash
find "$SAP_DIR" -name "*<relevantName>*" -type f 2>/dev/null
find "$SAP_DIR" -name "*.js" | xargs grep -l "<relevantFunction>" 2>/dev/null | head -5
find "$SAP_DIR" -name "*.page" | xargs grep -l "<relevantControl>" 2>/dev/null | head -5
```

Read and inspect the standard file. Report: file path · what it does · key elements relevant to the user's requirement.

**Step 2 — Determine the relative path inside the standard project:**

```bash
STANDARD_FILE="<full path found in step 1>"
RELATIVE_PATH="${STANDARD_FILE#$SAP_DIR/}"
# e.g. Rules/Operations/ConfirmOperation.js
echo "Standard relative path: $RELATIVE_PATH"
Z_FILE="$zProjectDir/$RELATIVE_PATH"
echo "Z override target:      $Z_FILE"
```

**Step 3 — Check for existing Z override:**

```bash
[ -f "$Z_FILE" ] && echo "Z override EXISTS at: $Z_FILE" || echo "Z override does NOT exist"
```

**Step 4a — Z file does NOT exist → create the override (with confirmation):**

Tell the user:
> "I found the standard file at `<ssamProjectDir>/<RELATIVE_PATH>`. I will recreate the same folder structure in the Z project and copy the standard file there as the starting point for the override. The original SAP standard file will remain unchanged. Shall I create the override at `<Z_FILE>`?"

❓ Ask for explicit confirmation before copying.

After confirmation:
```bash
mkdir -p "$(dirname "$Z_FILE")"
cp "$STANDARD_FILE" "$Z_FILE"
echo "Override created: $Z_FILE"
ls -la "$Z_FILE"
```

Verify creation. Then apply the requested changes to `$Z_FILE` only.

**Step 4b — Z file already EXISTS → work with existing customization:**

Do NOT overwrite it. Read and inspect it:
```bash
cat "$Z_FILE"
```

Tell the user: "An existing customization was found for this artifact at `<Z_FILE>`. I'll apply the new changes to the existing Z implementation while preserving the existing customization."

If the new change could conflict with the existing customization → explain the conflict and ❓ ask for confirmation before modifying.

Apply requested changes to `$Z_FILE` only — never touch `$STANDARD_FILE`.

**Critical:** The file at `$SAP_DIR/$RELATIVE_PATH` must remain byte-for-byte unchanged. After modifying `$Z_FILE`, verify:
```bash
git diff --name-only 2>/dev/null | grep "SAPAssetManager" && echo "⚠ WARNING: Standard file modified!" || echo "✓ Standard project unchanged"
```

Proceed to **SSAM-C8** (validate).

#### SSAM-C7 — New Artifact Pattern

Applies when the requirement adds functionality with no existing standard artifact to override.

**Step 1 — Determine location in Z project:**
Use the same folder structure as `SAPAssetManager/` for consistency (e.g. new Operations rule → `$zProjectDir/Rules/Operations/`).

**Step 2 — Name with `Z` prefix (for new artifacts only):**

| Artifact type | Example name |
|---|---|
| New page | `ZOperationSummary.page` |
| New rule | `ZCalculatePriority.js` |
| New action | `ZCreateServiceOrder.action` |

> **Do NOT** add a `Z` prefix to a standard override (SSAM-C6) — the override keeps the original filename so the MDK runtime routes correctly.

**Step 3 — Create the artifact:**
Inspect similar standard artifacts for structural reference (read only — do not copy verbatim):
```bash
find "$SAP_DIR/Rules" -name "*.js" | head -3
```

Create the new artifact in `$zProjectDir` using the patterns from `mdk-ssam-workflow` skill and `mdk-patterns` skill. Use `{i18n>Key}` for all user-visible strings — no hardcoded text.

**Step 4 — Register in CIM (mandatory for every new rule):**

Every new JS rule must have a CIM entry. Use the "new Z artifact" CIM template from `mdk-ssam-workflow` skill. Add the entry to `$cimFile`.

❓ Ask for confirmation before modifying the CIM file:
> "I'll add a CIM entry for `<ZArtifactName>` at `<cimFile>`. Shall I proceed?"

After confirmation → write the entry and verify.

Proceed to **SSAM-C8** (validate).

#### SSAM-C8 — Validate changes

After any modification or creation:

1. **Read the modified/created Z file** — confirm the changes are syntactically correct and match the intent.
2. **Confirm the standard project is untouched:**
```bash
git diff --name-only 2>/dev/null | grep "SAPAssetManager" && echo "⚠ Standard files modified — MUST NOT happen!" || echo "✓ Standard project unchanged"
```
3. **Confirm Z file exists with expected content:**
```bash
ls -la "$Z_FILE" 2>/dev/null
```
4. **Run MDK validation:**
Call `mcp__mdk__mdk-manage` with `{ "folderRootPath": ".", "operation": "validate" }`.
5. **Report:**
   - Files created or modified (full paths)
   - Standard files confirmed unchanged
   - CIM entries added (if any)
   - MDK validation result
   - Any unresolved issues

6. ❓ **AskUserQuestion**: "The customization is complete. What would you like to do next?"
Options:
- "Make another customization"
- "Validate the full project"
- "Deploy the project"
- "Done"

Route: "Make another customization" → SSAM-C4; "Validate" → re-run step 4; "Deploy" → MDK Fast Path STEP 3 (intent: `deploy`); "Done" → end.

---

Follow these steps. **Two code-generation blockers that cannot be bypassed: (1) Do not generate any application code before Gate 0 (Requirement Analysis confirmation — STEP 0.5). (2) Do not generate any code before Gate G (Architecture sign-off — STEP 7).** Surface assumptions as questions — never guess on Clean Core, backend, floorplan, auth, data types, drafts, or transitions. Use `AskUserQuestion` at each ❓ gate, presenting the recommended option first and honouring overrides. **Scope: CAP (CAPM) + UI (Fiori Elements + Freestyle UI5) + MDK (Mobile Development Kit). Pro-code-only extensibility is not yet implemented.**

**Two standing mandates that override convenience at every step:**

- **Never lose a requirement.** Every `REQ-NNN` is tracked end-to-end: register → a gate → the TDD → **verified in the generated code** (STEP 8.2). A requirement is only `Built` once the code is *confirmed to deliver it*; "designed into the TDD" is **not** "built". If any build choice would drop, weaken, or only partially deliver a requirement, say so and raise it — never let it lapse silently.
- **Flag every contradiction at its source — never reconcile silently.** Contradictions take two forms: **(a) the FD disagrees with itself** (e.g. an auth section grants only "display + update" while a screen section describes a "create" form), and **(b) a gate answer contradicts a requirement** (e.g. choosing "no draft" for a Fiori Elements app whose requirements include a working create/edit input form — FE create/edit needs drafts or sticky sessions). When you detect either, **stop at the relevant gate, show both sides with their `REQ-NNN` / FD-§ references, and make the developer resolve it** before recording the answer. Never pick a side yourself, and never silently build both interpretations.

**STEP 0 — Ingest the FD and extract a COMPLETE Requirement Register.** This step owns the *WHAT* (the gates that follow own the *HOW*). Do not summarize the FD — itemize it.

0. **Write a TodoWrite plan now** — before reading anything. Create one task per step and mark each completed in real time. This is the resume point if the session is interrupted mid-run.
   Tasks: `PRE-FLIGHT` · `STEP 0 — Requirement Register` · `STEP 0.5 — Requirement Analysis` · `STEP 1 — Gate A Clean Core` · `STEP 2 — Gate B Backend` · `STEP 3 — Gate C Floorplan` · `STEP 4 — Gate D CAP Scope` · `STEP 5 — Gate E Auth` · `STEP 6 — Gate F Data Model` · `STEP 7 — Architecture sign-off` · `STEP 7.5 — Generator / scaffold` · `STEP 8 — Build agents` · `STEP 8.1 — Quick checks` · `STEP 8.2 — Full sanity check` · `STEP 8.3 — Coverage verification` · `STEP 9 — Review` · `STEP 10 — Done`

1. **Read the whole FD.** If `$1` is a file path, Read the **entire** document — every page, section, table and appendix. For long/multi-page PDFs, read all pages; never skim or sample. If `$ARGUMENTS` is a one-line requirement, treat that text as the FD.
2. **Parse it exhaustively into atomic requirements.** Go section by section and turn **every requirement-bearing line into one discrete, testable requirement** (split compound sentences — one statement = one requirement). Capture, at minimum: every purpose/goal and every *"shall/will"* capability; every screen, mode, option, button, and input/selection field; every processing rule and **each validation** with its exact error message/code when given; every output/report, **each column**, and its source/field mapping; every authorization rule and role (and any instance scoping); every NFR, limit, volume, frequency, and constraint; **every row** of a field-list/error-catalogue/test-condition table → its own requirement. If unsure whether a line is a requirement, **include it.**
2a. **Self-check — verify section coverage before writing.** Re-read the FD section by section with these three checks: (a) every numbered section, heading, table, and appendix produced at least one `REQ-NNN` — list any with zero extractions and explain why (genuinely contextual, or a miss to add now); (b) every row of a field-list, error-catalogue, or test-condition table became its own discrete requirement — no table was collapsed into a single summary row; (c) requirements stated by implication ("the app should handle X", "users can view Y") were captured and marked `[implied]` in the source text column so they can be confirmed at the gate. Correct any gaps before proceeding.
3. **Record each requirement** as a row: **`REQ-NNN` | source text (verbatim/near-verbatim) | FD §/table ref | type (Functional · Validation · Data · Auth · UX · NFR · Integration) | disposition (start `TBD`)**. Derive a provisional `<app-name>` from the FD title (confirmable at STEP 7) and write the register to **`<app-name>/deliverables/Requirement-Register.md`** (use the `deliverable-templates` skill). This register is the single source of truth for coverage.
4. **Contradiction & conflict scan (build the Conflict Register).** Re-read the requirements as a set and find statements that **cannot all be true at once** (auth vs screen, a field in one table but not another, a data type contradicting its use, an NFR clashing with the approach). For each, add a row to a **Conflict Register** at the top of `Requirement-Register.md`: `CONFLICT-NN | clashing REQ-NNN / FD-§ refs | what clashes | gate where it must be resolved`, and mark **both** clashing requirements `Needs-decision`. These are raised verbatim at their gate — never reconciled here.
5. **Load context, report back, and confirm.** Load the `sap-architecture` skill (it defines every gate, the decision tree, and defaults) and the `sap-conventions` skill. Restate the intent in 2–3 sentences, then show: (a) total requirement count by type, (b) headline capabilities that must not be dropped, (c) any `[implied]` requirements that need interpretation confirmation, (d) the Conflict Register. Then **❓ ask the developer: "Does this register look complete? Are any requirements missing or misunderstood?"** — do **not** proceed to STEP 1 until they explicitly confirm. If they flag a gap, add the missing rows, re-run the conflict scan (step 4), and show the updated count before proceeding.

**STEP 0.5 — Requirement & Technical Analysis (BA + SAP Architecture review).**

Acting as Business Analyst + SAP Solution Architect + CAP + UI5/Fiori Architect, synthesize the parsed Requirement Register into a structured technical analysis. This step produces one deliverable and one confirmation gate. **No CDS, JavaScript, TypeScript, XML, YAML, or any application code may be generated until Gate 0 is confirmed.**

Analyse across these six dimensions. Mark every finding as Explicit / Inferred `[inferred]` / Assumed `[assumed]` / Open Question:

| Dimension | What to determine |
| --- | --- |
| Business & Functional | Application objective; user journeys end-to-end; actors; what each role can/cannot do; key workflows and transitions |
| CAP / Backend | Services required; entity projections; bound/unbound actions and functions; handler logic; server-side validations; integrations |
| Data Layer | Entities and relationships; key fields; field types; enums/codelists; audit fields (modifiedAt/createdAt); `@odata.etag` candidates; master vs transactional |
| UI | Screens and their purpose; navigation flow; per screen — columns/fields shown, filters, required inputs, client-side validations, actions/buttons |
| Integration & Security | External OData / REST APIs; BTP destinations; BPA workflow; event mesh; notification; auth approach; user roles; per-entity grant matrix |
| Architecture & Traceability | Map each major REQ-NNN → the UI component + CAP service + CDS entity + security rule that delivers it |

Do not invent requirements or silently make important assumptions. If critical information is missing, record it as an Open Question.

**Extend** `<app-name>/deliverables/Requirement-Register.md` (already created in STEP 0) by appending a `## Requirement & Technical Analysis` section with these subsections:

1. **Application Objective** — one paragraph: what the application does and the business value it delivers.
2. **User Roles & Journeys** — table: Role | Journey (end-to-end screen/action sequence).
3. **Functional Requirements** — numbered list; each entry tagged Explicit / Inferred / Assumed; mapped to at least one REQ-NNN.
4. **UI Requirements** — per screen: purpose, key controls (table columns / form fields / filters), user actions, navigation targets, client-side validations.
5. **CAP / Backend Requirements** — services, entities (with key fields), actions/functions, server-side validation rules, business logic, integrations.
6. **Data Model Requirements** — entities, fields (type + constraints), associations, enums, audit fields, etag candidates, master/transactional split.
7. **API / Integration Requirements** — external OData endpoints, BTP destinations, BPA workflow, event mesh, third-party APIs — or "None".
8. **Security Requirements** — auth approach, roles, per-entity `@restrict` matrix (READ / CREATE / UPDATE / DELETE × roles).
9. **Business Rules & Validations** — explicit rules from the FD plus inferred constraints (uniqueness, referential integrity, status transitions, enum guards).
10. **Proposed SAP Architecture** — one paragraph + text-based component diagram (Browser → UI5 App → CAP srv → HANA Cloud → BTP services).
11. **Assumptions** — bulleted list of every `[assumed]` item with rationale.
12. **Open Questions** — numbered list of blocking unknowns the developer must answer before architecture gates can complete. State "None" if there are none.
13. **Implementation Plan** — ordered phases: (1) Data model + enums → (2) Service CDS + auth → (3) Handlers + validation → (4) UI scaffold + routing → (5) Annotations / views → (6) Tests → (7) Deployment config.

After writing the file, output a clickable markdown link: `[Requirement-Register.md](<app-name>/deliverables/Requirement-Register.md)`.

Print the following key findings **inline** (do not make the developer open the file to see them):

- Application Objective
- User Roles & Journeys table
- Assumptions list
- Open Questions list (state "None" if empty)

**❓ Gate 0 — Requirement confirmation.** Ask the developer: *"Does this Requirement & Technical Analysis correctly and completely capture what you need to build?"*

- **"Confirmed — proceed to architecture gates"** → continue to STEP 1.
- **"Answer open questions"** → work through each Open Question one by one (ask the developer, record the answer, close the question in `Requirement-Register.md`), re-print the updated Open Questions and Assumptions sections, then loop back to this gate.
- **"I have corrections or additional information"** → incorporate the developer's input, update `Requirement-Register.md` and `Requirement-Register.md` (re-parse affected REQ-NNN rows), re-print only the changed sections, then loop back to this gate.

Proceed to STEP 1 only after Gate 0 is confirmed.

---

> **Gate pre-fill mandate (applies to STEP 1–6).** The `Requirement-Register.md` written in STEP 0.5 already proposes the recommended backend approach, floorplan, data model, roles, and security matrix. Use it as the pre-filled starting point for every gate — gates confirm or refine those proposals; they do not re-derive from scratch. Pre-fill every `AskUserQuestion` from the analysis before presenting it to the developer.
>
> **Gate cross-check (run at EVERY gate, STEP 1–6).** Before recording a gate answer, test it against the Requirement + Conflict Registers. If it would contradict, drop, or only partially satisfy any `REQ-NNN` — or resolves one side of a `CONFLICT-NN` — surface that **in the same gate** with refs and confirm the trade-off. Specific rules: *Fiori Elements + any create/edit/input-form requirement ⇒ drafts (or sticky sessions) REQUIRED — "draft off" conflicts.* *Auth says display-only but a requirement describes a create/input screen ⇒ flag at Gate E.* *Status/Type used as a filter ⇒ needs a value-help with data, not free text ⇒ confirm at Gate F.*

**STEP 1 — Gate A · Clean Core delivery.** Load `sap-clean-core` and run `clean_core_check` if the MCP is up. Intent2App builds the **Side-by-side BTP/CAP** path only. Confirm the requirement fits this model (new app on BTP consuming released OData, no on-stack modification). If the requirement cannot be satisfied without on-stack RAP/ABAP Cloud or classic modification, state this clearly and stop — it is out of scope for this release.

**STEP 2 — ❓ Gate B · Backend / data source.** Build new CAP service · Consume existing OData (RAP/other) · No backend (UI-only mock) · Add service later (project scaffolded now, service wired up in a follow-on session).

**If *consume* — pick the sub-path:**

- **RAP / existing service reached through a BTP destination (the usual consume path in BAS) → user-wizard.** **Load the `rap-integration` skill** and follow it. The RAP backend already owns the data model, so Intent2App builds **UI only** — and the shell must be scaffolded by the **BAS Fiori Application Generator wizard**, not by Intent2App, because in BAS the headless generator throws `this.env.error is not a function` **and** `$metadata` behind a destination cannot be fetched from a terminal (no IDE session / principal).

  **The wizard forces a template choice, so decide the floorplan BEFORE printing the wizard steps.** The developer must know which template to pick — do not hardcode "List Report". Run the **Gate C / G3 floorplan recommendation now**: load `sap-architecture` and apply the signal → floorplan logic from `references/decision-gates.md` **G3** exactly as Gate C does — **compute the recommended floorplan from the STEP 0 Requirement Register signals** (charts / KPIs / aggregation ⇒ **ALP**; worklist + detail / transactional CRUD ⇒ **LROP**, the default when ambiguous; single record by known key ⇒ **standalone Object Page**; standard list/detail + one bespoke section/column/validation ⇒ **FPM**; bespoke UX / non-OData / heavy client logic ⇒ **Freestyle**) — then ❓ **offer all five via `AskUserQuestion`, recommended first**, using G3's presentation: always include **Freestyle UI5 as one of the 4 explicit buttons** (never in "Other"), all five named with a one-line "use when" in the body. Run the G3 conflict cross-checks too (a create/edit requirement is fine here — RAP CRUD is enforced by the backend — but flag an ALP pick with no measures to aggregate). The signals exist at Gate B because STEP 0 already built the Requirement Register; the metadata is **not** needed for this recommendation.

  Map the chosen floorplan to the BAS wizard template and the resolved `appType`:

  | Chosen floorplan | BAS wizard template | `appType` |
  |---|---|---|
  | List Report + Object Page | **List Report Object Page** | `external-fe` |
  | Analytical List Page | **Analytical List Page** | `external-fe` (ALP) |
  | Object Page (standalone) | **Form Entry Object Page** | `external-fe` (OP) |
  | Flexible Programming Model | **Flexible Programming Model / custom page** | `cap-fpm` (FPM, FE V4 macros) |
  | Freestyle UI5 | **Basic** | `freestyle-ui5` |

  Then **print the wizard steps for the developer**, naming the mapped template:

  > **Command Palette** → *Fiori: Open Application Generator* → template **[mapped BAS template above]** → data source **Connect to a SAP System** → **Destination** (e.g. `s4h_uerp_pp_generic_destination`) → **Service** (pick the released service from the destination's list — this fetches `metadata.xml`; path form is **V4** `/sap/opu/odata4/sap/<binding>/srvd/sap/<service>/0001/` or **V2** `/sap/opu/odata/sap/<SERVICE>_SRV/`) → **Main entity** → project name / namespace → **Add FLP config: No** · **Add deployment config: No** → **Finish**.

  The wizard fetches `metadata.xml`. Then ❓ collect (1) the **generated project path** and (2) the **annotation strategy** (backend metadata-extension *recommended* · local annotation.xml · mix). **Record `scaffold_method: user-wizard`, `scaffold_path`, the chosen floorplan + resolved `appType`, and the annotation strategy** — these route STEP 7.5 (no generator run) and STEP 8 (`fiori-developer` Path A). **The floorplan chosen here IS the Gate C answer → Gate C (STEP 3) is skipped for RAP** (see STEP 3).

- **Direct OData URL or a supplied EDMX file (no destination / not via the BAS wizard).** ❓ capture the **full service binding** — a RAP service reached through a BTP destination needs a destination **and** a service path, not just one of them:
  1. **`$metadata` / EDMX file path** (offline-first) — used to generate the mock.
  2. **OData service path** on the backend — e.g. `/sap/opu/odata4/sap/<SERVICE>/srvd/…/0001/` (OData V4 RAP) or `/sap/opu/odata/sap/<SERVICE>_SRV/` (V2). This is the path the manifest `dataSource` binds to.
  3. **BTP destination name** — e.g. `S4HANA_PROD`, `Northwind` (BTP cockpit or local mock). Leave blank only for a direct URL or a local CAP project.

  Then ❓ the annotation strategy (backend metadata-extension *recommended* · local annotation.xml · mix). Record all three of the above (destination + service path pre-fill the generator at STEP 7.5 and drive the generated `xs-app.json` route + manifest `dataSource`).

If *add later*: scaffold the project with a placeholder CAP service and mock data; note in the Requirement Register that backend wiring is deferred.

**STEP 3 — ❓ Gate C · Floorplan.** **If Gate B = Consume RAP (`scaffold_method: user-wizard`): SKIP this gate.** The floorplan was already recommended and chosen at Gate B (using this same G3 logic) so the developer knew which BAS wizard template to select; it is already recorded as the Gate C answer with its resolved `appType`. Proceed to STEP 4. **Otherwise: First compute the recommended floorplan** from the requirement signals, using the **signal → floorplan table in the `sap-architecture` skill (`references/decision-gates.md`, G3)** — charts / KPIs / aggregation / drill-down ⇒ **Analytical List Page**; worklist + detail / transactional CRUD ⇒ **List Report + Object Page** *(default when signals are transactional or ambiguous)*; single record entered by a known key, no worklist ⇒ **Object Page (standalone)**; standard list/detail **but** one custom section/column/validation/chart ⇒ **Flexible Programming Model (FPM)**; bespoke UX / non-OData / heavy client logic / explicit developer preference ⇒ **Freestyle UI5** (JavaScript UI — `cap-freestyle` with CAP, or `freestyle-ui5` TypeScript standalone without CAP). **Then offer all five** floorplans via `AskUserQuestion`, the recommended one first (labelled *Recommended*). The picker allows only **4 option buttons + an automatic "Other"**: always reserve one of the 4 buttons for **Freestyle UI5** — it must never be pushed into "Other" because users rarely think to select "Other" for a major floorplan type. Fixed button set: (1) the **recommended Fiori Elements floorplan** (label it *Recommended*) · (2) **List Report + Object Page** (if not already #1) · (3) **Analytical List Page** (if not already #1–2) · (4) **Freestyle UI5** (JavaScript with CAP → `cap-freestyle`; TypeScript standalone → `freestyle-ui5` — whichever applies is resolved from Gate B). Put whichever FE option (FPM or standalone Object Page) is least relevant to the signals in "Other". **Name all five (with a one-line "use when" each) in the question body.** Keep the standing bias: prefer the **Fiori Elements family over Freestyle** unless the UX genuinely cannot be expressed in annotations, and within FE recommend the *specific* floorplan whose signals dominate. The chosen floorplan × Gate B backend resolves to the `appType` consumed at STEP 7.5 (see the appType → generator floorplan table below): `cap-fe-lrop` / `external-fe`, `cap-fe-alp`, `cap-fe-op`, `cap-fpm`, `cap-freestyle` / `freestyle-ui5`.

**STEP 4 — ❓ Gate D · CAP scope.** **If Gate B = Consume RAP (`scaffold_method: user-wizard`), skip this gate entirely** — there is no CAP backend to scope; the RAP service already owns the model and logic. Otherwise, first ask: **Is a CAP backend needed?** (Yes — recommended · No — skip to Gate E). If yes, ask *(multi-select)*: New service · Extend existing · Bound actions · Draft on/off · Events.

**STEP 5 — ❓ Gate E · Auth & roles.** First ask: **Is authentication needed?** (Yes — recommended · No — open/read-only/externally-enforced; confirm explicitly). If yes, ask: XSUAA Viewer/Editor/Admin *(recommended)* · Authenticated-user only · Custom roles · IAS. Then confirm the per-entity grant matrix (load `cap-security`).

**STEP 6 — ❓ Gate F · Data model (CAP) / UI decisions (RAP).** **If Gate B = Consume RAP (`scaffold_method: user-wizard`): do NOT design a data model** — the backend owns it. Per the `rap-integration` skill, **`Read` the wizard's `<scaffold_path>/webapp/localService/mainService/metadata.xml`** and inventory it (per entity set: keys from `<Key>/<PropertyRef>`, candidate columns/filters from each `<Property>`, value-help/drill targets from `<NavigationProperty>`; default main entity = the set with the most properties). **Detect and record the OData version** from the metadata header: `m:DataServiceVersion="2.0"` on `<edmx:DataServices>` ⇒ record `odata_version: "2.0"`; `Version="4.0"` on the `<edmx:Edmx>` root ⇒ record `odata_version: "4.0"`. Record `odata_version` in session state and in `Application-Architecture.md` (build-plan section), and tell the developer *"Detected OData V[N] — development follows V[N] patterns (manifest model settings, CRUD calls, filter/sort syntax and response shape differ by version)."* **Cross-check the Gate B floorplan against the metadata and flag (do not silently switch)**: an ALP pick with no aggregate/measure signals (V2: no `sap:aggregation-role="measure"` / `sap:semantics="aggregate"`; V4: no `Aggregation.ApplySupported`) ⇒ warn the charts may be empty; a create/edit-oriented floorplan where every EntitySet is read-only (V2: `sap:creatable="false"`; V4: `Capabilities.InsertRestrictions.Insertable=false`) ⇒ warn the create/edit UI will be inert. On a mismatch, surface it with refs and let the developer re-pick the floorplan (which means re-running the wizard with the corrected template). Present the model **read-only**, then run the ❓ **UI-decisions gate**: main entity, `UI.LineItem` columns, `UI.SelectionFields` filters, value-helps, and which fields drive criticality. Record these for the TDD, then continue. **Otherwise (CAP):** propose entities/keys/fields/associations/enums/virtual+criticality/currency-pairing/audit/etag/OData-V4 and confirm each assumption (load `cap-schema`, `cap-service`, `cap-modeling`; iterate until agreed). Record every confirmed assumption for the TDD.

**STEP 7 — Architecture sign-off.** Confirm the `app-name`. **Close the Requirement Register:** set every `REQ-NNN` disposition to **Designed**, **Deferred (with a reason)**, or **Needs-decision** — *no requirement may remain `TBD`*. Every `CONFLICT-NN` must be resolved by a gate decision before proceeding.

Using the **`application-architecture` template in the `deliverable-templates` skill**, write `<app-name>/deliverables/Application-Architecture.md` — filling every section from Gates A–F: overview, requirement summary (headline capabilities + deferred list + conflicts resolved), all gate decisions, data model (entities / fields / associations / enums / computed fields), auth grant matrix, and build plan.

After writing the file, output a clickable markdown link: `[Application-Architecture.md](<app-name>/deliverables/Application-Architecture.md)`.

**❓ Gate G — sign-off:** The developer reviews the architecture above and either:

- **Approves** → proceed to build.
- **Requests changes** → update the relevant section(s) of the document and re-ask.
- **Loops back** to a specific gate → re-run that gate, update gate answers + the document, then re-present.

**No TDD file is written at this stage** — the Technical Design Document is generated on demand when the developer runs `/document`.

**STEP 7.5 — Fiori scaffold prep (generator-first).** **Run this step only if the build needs a UI layer** (Gate C selected a floorplan and the build is not CAP-service-only). If the build is API-only, skip STEP 7.5 entirely and proceed to STEP 8 with `cap-developer` only (no generator, no `fiori-developer`).

**RAP / user-wizard short-circuit.** **If Gate B recorded `scaffold_method: user-wizard`, do NOT run any generator in this step.** The BAS wizard already scaffolded the project (the headless generator is broken in BAS — see `rap-integration`). Instead: set `scaffold_path` = the developer's wizard project, **verify `<scaffold_path>/webapp/manifest.json` and `<scaffold_path>/webapp/localService/mainService/metadata.xml` exist** (if either is missing, ❓ ask the developer to re-check the wizard output / path), and record `scaffold_method: user-wizard` + `scaffold_path` in `Application-Architecture.md` (build-plan section, exactly as the generator path records its own method below). Then skip straight to STEP 8. The rest of this step (generator config) applies only to the CAP / non-wizard paths.

When a UI is needed and the shell was **not** produced by the wizard, the Fiori UI is scaffolded with the **SAP Fiori Tools Application Generator** (`@sap/generator-fiori` — the same engine as the BAS wizard) **by default**; `scaffold_app` is used only if the generator cannot run (STEP 8 fallback). In this step:

1. **Generator availability (already validated at PRE-FLIGHT CHECK 2).** If PRE-FLIGHT confirmed Yeoman + `@sap/generator-fiori` are ready, proceed directly to step 2. If PRE-FLIGHT recorded `scaffold_method: built-in (developer-approved fallback)`, skip to STEP 8 — `scaffold_app` will be used, and `fiori-developer` will apply the 3 mandatory corrections automatically (CDN URL → `1.149.0`, `routing.config` → `{}`, bootstrap path verified as full CDN URL not root-relative).
2. **Confirm the headless invocation for the installed version.** Run `yo @sap/fiori --help` (or check the generator docs) to confirm the headless sub-generator name and the app-config schema/floorplan enum before building the config — these can differ by version. (Representative form: `yo @sap/fiori:headless <appconfig.json> --force`.)
3. **Collect the full wizard-variable set from the developer** with `AskUserQuestion`, **pre-filled from the architecture** (Gates B/C/F, namespace, app-name — the developer can accept the pre-filled defaults):
   - **Floorplan / template** — pre-filled from Gate C + appType (see mapping table below).
   - **Data source** — one of: CAP local project · OData service URL · Local EDMX file · **SAP System via destination (RAP / ABAP Cloud)** · None. Pre-fill from Gate B. For the **RAP / SAP-system** choice, both a **destination name** and a **service path** are required (the generator's "Connect to a SAP System" flow).
   - **OData service path** (e.g. `/sap/opu/odata4/sap/<SERVICE>/…`) and **destination name** — pre-filled from Gate B; mandatory for the RAP/SAP-system source.
   - **Main entity** and **navigation entity** — pre-filled from Gate F.
   - **Project / module name** — pre-filled from `app-name` (the developer can override).
   - **Application title, description, namespace** — pre-filled.
   - **Minimum UI5 version** (default `1.120.0`), **Add FLP config** (default no), **Add deployment config** (default **no** — MTA is handled separately).
4. **Write the headless config** to the scratchpad. The current stable schema version is `"0.2"` — use it unless step 2 confirmed a different version. If in doubt, read the version string from `yo @sap/fiori:headless --help` output (it is listed in "Please provide one of the following supported versions"). Do not omit this field — the generator exits immediately with "The application config version must match a supported version: 0.2" if it is missing:
   ```jsonc
   {
     "version": "0.2",
     "floorplan": "<FE_LROP | FE_ALP | FE_FEOP | FF_SIMPLE | ...>",
     "project": {
       "name": "<module/project name>", "title": "<title>", "description": "<desc>",
       "namespace": "<dotted namespace>", "ui5Version": "1.120.0", "sapux": true,
       "targetFolder": "<abs path — see STEP 8 targets>"
     },
     "service": {
       "servicePath": "/odata/v4/<ServiceName>/",
       "capService": { "projectPath": "<abs CAP root>", "serviceName": "<ServiceName>", "serviceCdsPath": "srv/service.cds" },
       "destination": { "name": "<destination or omit>" }
       // RAP / SAP system: { "destination": { "name": "S4HANA_PROD" }, "servicePath": "/sap/opu/odata4/sap/<SERVICE>/..." }
       // OData URL:        { "host": "https://...", "servicePath": "/..." }
       // EDMX (offline):   { "edmx": "<contents>", "metadataFilename": "metadata.xml" }
     },
     "entityConfig": { "mainEntity": { "entityName": "<Entity>" }, "navigationEntity": { "entityName": "<Nav or omit>" } },
     "deployConfig": null, "flpConfig": null
   }
   ```
5. **Record** `scaffold_method: fiori-generator`, the config path, the intended `scaffold_path`, and the destination name in `Application-Architecture.md` (build-plan section). These are passed to `fiori-developer` at STEP 8.

**appType → generator floorplan / data source:**

| intent2app appType | Generator floorplan | Data source |
|---|---|---|
| `cap-fe-lrop` | List Report Object Page | CAP (local project) |
| `cap-fe-alp` | Analytical List Page | CAP |
| `cap-fe-op` | (Form Entry) Object Page | CAP |
| `cap-fpm` | Flexible Programming Model / custom page | CAP |
| `cap-freestyle` | Basic (freestyle) | CAP |
| `external-fe` | List Report Object Page | OData URL · EDMX · **RAP via destination (destination + service path)** |
| `freestyle-ui5` | Basic (freestyle) | None or OData URL |

**STEP 8 — Build.** Spawn the developer sub-agents (via Agent), passing the gate decisions (Gates A–F answers, the closed Requirement Register at `<app-name>/deliverables/Requirement-Register.md`, the chosen appType/namespace/app-name, and for consume apps the EDMX path + OData service path + destination name) directly in the agent brief. When STEP 7.5 recorded `scaffold_method` (`fiori-generator`, `user-wizard`, or the `built-in` fallback) and `scaffold_path`, put both at the **top of the `fiori-developer` brief** so it takes the right path. **For `scaffold_method: user-wizard` (RAP): spawn `fiori-developer` only — there is no `cap-developer` and no generator run. Put in its brief: `scaffold_method: user-wizard`, `scaffold_path`, the resolved `appType` (from the Gate B floorplan), and `odata_version` (detected at STEP 6). Tell it to load the `rap-integration` skill and then also load `rap-integration/references/odata-v2-patterns.md` (if `odata_version = "2.0"`) or `rap-integration/references/odata-v4-patterns.md` (if `odata_version = "4.0"`) — these version-specific references govern the manifest model settings, Component base class, CRUD calls, filter/sort syntax and response shape, and must be applied to every file it touches.**

- **`cap-developer`** for the CAP layer (model, services, handlers, auth) — run first when there's a new backend. **Always put this block verbatim at the TOP of the `cap-developer` brief (before gate answers):**
  > **SCAFFOLDING — mandatory, read before anything else:**
  > Run `cds init <app-name> --add nodejs,sqlite,hana` via Bash as the FIRST action. Do NOT call `scaffold_app` for the CAP layer — `scaffold_app` is a last-resort fallback only if `cds` is not on PATH (command not found).
- **`fiori-developer`** for the UI layer (annotations/floorplan or freestyle; mock + proxy for external) — after the CAP service exists, or in parallel for independent apps.
  - **If the floorplan is FPM (`appType == cap-fpm`, or FPM on any backend):** put this at the TOP of the `fiori-developer` brief — *"MUST-LOAD (unconditional): `fiori-bootstrap` → `references/fpm.md` (CAP → Walkthrough B) + `fiori-elements` → `references/fpm-annotations.md`. Verify every FPM file against it."*

**Fiori scaffold (when a UI is needed — default `scaffold_method: fiori-generator`).** Run the SAP Fiori generator with the STEP 7.5 headless config at the right point in the sequence:

- **CAP-backed floorplans** (`cap-fe-*`, `cap-fpm`, `cap-freestyle`): run `cap-developer` **first** (the CAP project must exist), **then** run `npm install` in `<app-name>/` (the generator's write phase introspects the live CDS runtime — if `node_modules/` is absent it crashes with `Cannot read properties of undefined (reading 'supportedODataVersions')`), **then** run the generator into `<app-name>/app/<module>/` with `dataSource: cap` pointing at the CAP root, **then** spawn `fiori-developer`.
- **Standalone floorplans** (`freestyle-ui5`, `external-fe`; no CAP backend): run the generator into `<app-name>/`, **then** spawn `fiori-developer`.
- **RAP / user-wizard (`scaffold_method: user-wizard`, `external-fe`):** **do NOT run the generator** — the project already exists at `scaffold_path` (scaffolded by the BAS wizard). Spawn `fiori-developer` directly (it takes Path A and loads `rap-integration`). No `cap-developer`.
- Verify `webapp/manifest.json` exists at the target; if a destination was provided, verify `xs-app.json` contains the destination route.
- **Fallback (Yeoman unreachable or generation fails):** if the generator was unavailable or generation fails / the manifest is missing → resolve the reference `.md` for the chosen `appType` from the table below, pass it to the relevant agent as `reference_md`, and fall back to the built-in `scaffold_app` path. Record `scaffold_method: built-in (fallback)` and tell the developer the fallback is in use. The agent must **Read** `reference_md` to get the complete file structure, script names, and boilerplate content for that project type.

| appType | Fallback reference `.md` |
| --- | --- |
| *(service-only, no UI)* | `reference-apps/cap-service-only.md` |
| `cap-fe-lrop` · `cap-fe-alp` · `cap-fe-op` · `cap-fpm` | `reference-apps/cap-fullstack-listreport.md` |
| `cap-freestyle` | `reference-apps/cap-fullstack-freestyle.md` |
| `freestyle-ui5` | `reference-apps/freestyle-ui5-ts.md` |
| `external-fe` | `reference-apps/fiori-elements-external-service.md` |

**After each build agent returns — verify deliverables exist on disk.** Do not trust the agent's text summary alone — a silent tool failure or wrong path means the files were never written.

- **After `cap-developer`:** verify `<app-name>/srv/service.cds`, `<app-name>/db/schema.cds`, and `<app-name>/package.json` exist. If any are missing, re-spawn `cap-developer` with the exact missing-file list before running the generator or spawning `fiori-developer`.
- **After `fiori-developer`:** verify `<app-name>/app/<module>/webapp/manifest.json` exists (for TypeScript apps also check `Component.ts`). If missing, re-spawn `fiori-developer` with the exact missing-file list before proceeding to STEP 8.1.
- **After `cds add mta`:** verify `<app-name>/mta.yaml` exists. If missing, note it and continue — the `deployment-validation` skill at `/deploy` will flag it.

The runnable app is generated **inside `<app-name>/`** (separate from `deliverables/`). Each builder validates the namespace and runs checks. If a builder returns **blocking questions**, ❓ ask the developer, then re-spawn it with the answers. Deliverable (b) is the runnable code.

**Post-build: generate MTA deployment descriptor.** Once both build agents report complete (or the single agent for service-only / UI-only builds), run the following from the app root via Bash:

```bash
cd <app-name>
cds add mta
```

This auto-generates `mta.yaml` from the project structure — CAP service module, Fiori HTML5 module(s), and resource stubs for XSUAA, HANA, Destination, and HTML5 repo. **Skip this step only if `mta.yaml` already exists** (e.g. the developer supplied one or the project was cloned with one). After generation, check `mta.yaml` exists with content; if `cds add mta` fails (command not found or permission error) print the exact error and continue — the `deployment-validation` skill at `/deploy` will flag the missing file.

**STEP 8.1 — Quick static checks (fast-fail gate before coverage).** Before running coverage verification, confirm the build compiles and the manifest is valid. Load the `application-sanity-check` skill and run **checks 1–4 only** against `<app-name>/`:

1. **CDS build** — `run_checks` exits 0, no compilation errors.
2. **Namespace consistency** — `validate_namespace` passes; identical in all 4 places.
3. **Manifest validation** — `ui5_run_manifest_validation` passes (Fiori/Freestyle apps only).
4. **UI5 lint** — `ui5_run_ui5_linter` no ERRORS (Fiori/Freestyle apps only).

Any failure → re-spawn the relevant developer (`cap-developer` for CDS issues, `fiori-developer` for namespace/manifest/lint issues) with the exact failure output, then re-run the affected checks. **All 4 checks must pass before proceeding to STEP 8.2 (full sanity check).**

**STEP 8.2 — Full sanity check (technical build validation).** Load the `application-sanity-check` skill and run all **17 checks** against `<app-name>/`:

1. **CDS build** — `run_checks` exits 0, no compilation errors.
2. **Namespace consistency** — `validate_namespace` passes; identical in all 4 places.
3. **Manifest validation** — `ui5_run_manifest_validation` passes (Fiori/Freestyle apps only).
4. **UI5 lint** — `ui5_run_ui5_linter` no ERRORS (Fiori/Freestyle apps only).
5. **Auth annotations** — every `service` has `@requires`, every writable entity projection has `@restrict`; grep `srv/` to confirm, no exceptions.
6. **No `console.log`** — grep `srv/` for `console.log`; must be zero results.
7. **No hardcoded secrets/URLs** — grep source for passwords, API keys, `http://` literals in JS/TS/CDS.
8. **CSV UUID validity** — all `ID` and FK columns in `db/data/*.csv` contain valid UUID-format strings; no short IDs like `01` or `lv-01`.
9. **Draft configuration** — every entity feeding a Fiori Elements create/edit page has `@odata.draft.enabled` on its service projection.
10. **Value help completeness** — every field with a constrained vocabulary has all 4 layers present (CAP function, handler, view wiring, SelectDialog/ValueHelpDialog).
11. **Runtime smoke test** — `cds watch` starts clean (no errors in log), `$metadata` returns 200, main entity set returns 200, UI `manifest.json` returns 200. For any failure, apply the self-healing auto-fix defined in the `application-sanity-check` skill before marking a check as failed.
12. **Dev auth kind** — `.cdsrc.json` must use `"kind": "dummy"`, not `"mocked"` with named users; `mocked` causes XHR OData requests to silently fail with 401 → blank List Report.
13. **Watch script `--open` path** — the `--open` argument in the watch script must equal `{ui5.yaml metadata.name}/index.html`; wrong path opens a 404 URL in the browser.
14. **Manifest `dataSources.uri` vs derived CAP service path** — `sap.app.dataSources.mainService.uri` must match `/odata/v4/{serviceName.replace(/Service$/,'').toLowerCase()}/`; any casing or suffix mismatch causes every OData request to 404.
15. **i18n `supportedLocales` includes `"en"`** — when `fallbackLocale` is `""`, `"en"` must also appear in both `supportedLocales` arrays; omitting it produces a UI5 console warning on every page load.
16. **`CollectionPath` entities inside service block** — every entity name used as a `CollectionPath` in `annotations.cds` must be declared inside the `service { }` block in `srv/service.cds`; a top-level projection outside the block compiles fine but is never exposed as an OData endpoint — the value-help dropdown silently 404s at runtime with no browser error.
17. **Manifest destination-prefix URIs are relative** — any `dataSources[*].uri` that includes a destination-name prefix segment (e.g. `leaversapp-srv-api/odata/v4/leavers/`) must NOT start with `/`. A leading slash makes the path absolute from the managed approuter root; in Workzone each app is mounted at a GUID-scoped path, so the absolute route is never matched and every OData call returns 404. Auto-fix: strip the leading `/` from the URI value in `manifest.json`.

Report results as a pass/fail table (see `sanity-check` skill). Any failure → apply the relevant auto-fix (checks 12–17 are self-healing: rewrite `.cdsrc.json`, update `package.json` watch script, update manifest URI, add `"en"` to locales, move entity projections inside the service block, strip leading slash from destination-prefixed URIs); re-spawn `cap-developer` for CDS/auth/CSV/draft/console issues or `fiori-developer` for namespace/manifest/lint issues when a fix requires code changes. Re-run only the failing non-smoke checks (1–10, 12–17) after each fix. Run check 11 (runtime smoke test) exactly once — after all other 16 checks pass — as the final gate. Never restart `cds watch` inside an individual fix loop.

**FPM apps only:** after the 17 checks pass, run the FPM wiring block (checks 18–20) from the `application-sanity-check` skill. Skip entirely when no routing target has `"name": "sap.fe.core.fpm"`.

**Hard gate: ALL 17 checks (+ FPM checks 18–20 where applicable) must pass before proceeding to STEP 8.3 (coverage verification). Do NOT spawn the `reviewer` agent until STEP 8.2 (full sanity check) and STEP 8.3 (coverage verification) are both complete without open failures.**

**STEP 8.3 — Coverage verification (no requirement left behind).** Before review, **prove the build against the register**. For **every `REQ-NNN` marked `Designed`**, open the actual generated files (and where feasible smoke-run `npm run watch` / hit the OData service) and confirm the code *truly delivers* it. Write a **Coverage Report** (`<app-name>/deliverables/Coverage-Report.md`): `REQ-NNN | expected behaviour | file:line evidence | Verified / Gap`. Promote confirmed rows to **Built**; leave unmet rows **Gap**. **Explicitly check these recurring shortfalls:** a Fiori Elements **create/edit form that doesn't work because drafts/sticky are off**; **filter fields with no value-help data**; **i18n locales present but not wired into the manifest** `supportedLocales`/`fallbackLocale`; **computed/criticality fields not rendering**; **`@restrict` verbs that don't match the grant matrix**; **actions modelled but not surfaced** in the UI. For any **Gap**, re-spawn the relevant developer (`cap-developer`/`fiori-developer`) with the exact gap list (or ❓ raise a decision), then re-verify. **Do not enter STEP 9 with open Gaps** unless the developer explicitly defers them on the record.

**STEP 9 — Review.** *(Runs only after all 17 sanity checks at STEP 8.2 pass and Coverage Report at STEP 8.3 has no open Gaps.)* Spawn the **`reviewer`** sub-agent on `<app-name>/` (it covers best practices **and** security in one pass). Consolidate its findings. **❓ Gate H — triage** (multi-select): which findings to fix now (e.g. Fix all CRITICAL · defer WARNINGs · explain a trade-off). For accepted findings, re-spawn the relevant developer to apply fixes and re-run checks.

**STEP 10 — Wrap up.** Print the runnable app path at `<app-name>/` and the exact run commands (`cd <app-name>` then: `cap-service` → `npm install && npm start`; `cap-fe-*` → `npm install && npm run watch-listreportapp`; `cap-fpm` → `npm install && npm run watch-<module>` (the FPM app module name, not `listreportapp`); `cap-freestyle` → `npm install && npm run watch-freestyleapp`; standalone/external → `npm install && npm run start:mock`). When a **BTP destination** was configured for a consumed/RAP service, note that `npm run start:proxy` (or the deployed approuter) routes through the `xs-app.json` destination entry, while `start:mock` runs fully offline from the EDMX mock. ❓ Optionally offer to run the app. Remind the developer that all three deliverables below are on-demand:

- Run `/document` to generate the Technical Design Document and Unit Testing Document.
- Run `/test` to add test configuration and run the test suites.

**No TDD file, no Unit Testing Document, and no test scaffolding are written automatically.**

Keep a `TodoWrite` list of the gates/steps so the developer can see progress. Prefer `mcp__intent2app__*` tools; if the MCP server is unavailable, tell the developer and fall back to the skills (they are the source of truth).
