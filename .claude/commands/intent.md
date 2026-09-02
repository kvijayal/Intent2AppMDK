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

**Do not run SSAM-U1 through U7 steps here.**
Do not scan the workspace. Do not check for SAPAssetManager/. Do not ask about CIM files.

Immediately spawn the `mdk-developer` agent:

```
intent:       ssam-upgrade
requirement:  <user's original requirement text>
projectDir:   <current working directory as absolute path>
```

The agent loads `mdk-ssam-upgrade` skill and `mdk-ssam-workflow` skill.
The skill handles everything: workspace detection, path collection via BLOCKING,
CIM pre-audit, Metadata Upgrade Tool guidance, 3-way merge, and post-upgrade validation.

If the agent returns a `BLOCKING:` message → surface it to the developer with
❓ **AskUserQuestion**, collect the answer, append it to the brief, re-spawn the agent.

### SSAM Customize Flow

**Load `intent-ssam` command for the full SSAM customization flow.**
Do not run any SSAM-C steps here. Spawn the `mdk-developer` agent immediately:

```
intent:      ssam-customize
requirement: <user's original requirement>
projectDir:  <current working directory>
```

The agent loads `mdk-ssam-patterns` and `mdk-ssam-workflow` skills.
All workspace detection and CIM handling is done inside the skills via BLOCKING.
