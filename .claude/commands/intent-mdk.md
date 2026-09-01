# MDK Intent — Fast Path

*Loaded only when MDK is selected in /intent. Not loaded for CAP/Fiori/UI5 flows.*

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
