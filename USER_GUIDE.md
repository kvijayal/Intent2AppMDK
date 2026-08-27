# Intent2App User Guide

Complete reference for skills, commands, agents, and MCP servers in the Intent2App workflow.

---

## Quick Start Decision Tree

**I have a new requirement or Functional Design:**
→ Use `/intent` command (end-to-end build)

**I have generated code and want to check for issues:**
→ Use `/review` command (read-only audit)

**I want to fix review findings:**
→ Use `/modify` command (apply fixes)

**I have an mta.yaml and want to audit it:**
→ Use the `mta-reviewer` skill or `/deploy` command

**I want to test the application:**
→ Use `/test` command

**I want to generate documentation:**
→ Use `/document` command

---

## Commands

Commands are the entry points to major workflows. They coordinate agents, skills, and specialized MCP servers.

### `/intent` — End-to-End Build from Requirements

**When to use:**
- Starting a brand new SAP BTP application from a Functional Design Document (FDD)
- You have requirements but no code yet
- You want an interactive, gated build with design decisions at each step

**What it does:**

1. Reads your FDD/requirements
2. Runs pre-flight checks (MCP server, Yeoman, CDS CLI auto-install)
3. Extracts a complete Requirement Register from the FD
4. Runs Clean Core compliance check (Gate A)
5. Interactive gate decisions — you approve each: backend type, floorplan, CAP scope, auth, data model
6. Writes `Application-Architecture.md` and asks for your sign-off before any code is written
7. Spawns CAP agent to build the backend (schema, services, handlers)
8. Spawns Fiori agent to build the frontend (manifest, views, controllers, annotations)
9. Generates MTA deployment descriptor (`cds add mta`)
10. Runs 17 sanity checks on the generated code
11. Verifies every requirement is delivered (Coverage Report)
12. Spawns reviewer for a final code quality pass

**Does NOT generate:**

- Technical Design Document (TDD) — use `/document TDD` after `/intent`
- Unit Testing Document (UTD) — use `/document UTD` after `/intent`
- Test files — use `/test` after `/intent`

**Outputs:**
- `deliverables/Requirement-Register.md` — every requirement extracted from the FD, with disposition
- `deliverables/Application-Architecture.md` — gate decisions, data model, auth matrix, build plan
- `deliverables/Coverage-Report.md` — requirement-to-code traceability (Built / Gap)
- Full working CAP + Fiori app under `<app-name>/`
- `mta.yaml` deployment descriptor

**Example:**
```
/intent Build a Leave Request approval workflow app
```

---

### `/review` — Read-Only Code Audit

**When to use:**
- Code is generated and you want to verify it against best practices
- You want a severity-ranked list of issues before fixing anything
- You want to check for security vulnerabilities, performance risks, deprecated APIs

**What it does:**
1. Creates a `.intent2app/review.lock` file — while it exists, every `Write`/`Edit` is blocked (review physically cannot modify code)
2. Detects project topology (CAP present? UI present? Tests present?)
3. Runs architecture scan (maps stack, auth model, UI floorplan)
4. Spawns reviewer agent to audit against 11 categories:
   - CDS/CAP correctness
   - Authorization completeness
   - Fiori compliance
   - Deprecated APIs
   - OData performance
   - Security (hardcoded secrets, injection, SSRF)
   - Namespace + Clean Core
   - Requirement traceability
   - Deployment readiness
   - Test coverage
   - Code quality
5. Returns findings ranked CRITICAL → WARNING → INFO

**Outputs:**
- Severity-ranked findings table with exact fix snippets
- Category status showing which checks passed/failed/N/A
- Deployment readiness checklist

**Important:** Review is READ-ONLY. Use `/modify` to apply fixes.

**Example:**
```
/review tasktracker
```

---

### `/modify` — Apply Review Findings

**When to use:**
- You have a `/review` findings report and want to fix the issues
- You want to apply recommended fixes automatically
- You want to see before/after diffs of each change

**What it does:**
1. Reads the findings from the previous review
2. Removes the `.intent2app/review.lock` file (allows edits)
3. Applies each fix in sequence, showing before/after for each change
4. Offers to re-run `/review` or `/test` to confirm all fixes landed

**Outputs:**
- Fixed code with exact changes applied
- Summary of changes made per finding
- Option to re-run `/review` to verify no regressions

**Example:**
```
/modify
```

---

### `/deploy` — Deployment Readiness Audit

**When to use:**
- You have an `mta.yaml` and want to validate it before running `mbt build`
- You want to catch deployment errors before they happen
- You want to check xs-app.json routing, xs-security.json, manifest consistency

**What it does:**
1. Detects project topology
2. Spawns deployer sub-agent to:
   - Detect the deployment pattern (html5-apps-repo, standalone approuter, consume-only, etc.)
   - Audit all MTA modules and resources
   - Audit xs-app.json CORS and routing
   - Audit xs-security.json xsappname and scopes
   - Run comprehensive cross-file consistency checks
3. Returns findings with exact fix snippets

**Outputs:**
- Severity-ranked audit findings
- Deployment checklist (mta.yaml bindings, npm audit, health-check, etc.)
- Exact `mbt build` and `cf deploy` commands to run

**Example:**
```
/deploy
```

---

### `/test` — Test Generation and Execution

**When to use:**
- You want to create test files (CAP Jest, UI QUnit/OPA5)
- You want to run the test suite and see results
- You want to measure test coverage

**What it does:**
1. Spawns tester agent to:
   - Generate Jest test file for CAP service (if CAP present)
   - Generate QUnit tests for Freestyle UI5 formatters/controllers (if UI present)
   - Generate OPA5 journey tests for List Report → Object Page navigation
2. Runs `npm test` and reports:
   - Pass/fail count
   - Coverage metrics
   - Failing test names (if any)

**Outputs:**
- `test/*.test.js` — CAP integration tests
- `app/*/webapp/test/unit/*.test.ts` — UI unit tests
- `app/*/webapp/test/integration/opaTests.qunit.html` — OPA5 journeys
- Coverage report

**Example:**
```
/test
```

---

### `/document` — Generate Deliverables

**When to use:**
- You want to create Technical Design Document (TDD) for an existing project
- You want to create Unit Testing Document (UTD)
- You want to formalize the deliverables

**What it does:**
1. Spawns documenter agent to read the project state
2. Generates either TDD, UTD, or both:
   - **TDD** — entity model, service definitions, role matrix, API endpoints, wireframes
   - **UTD** — test scenarios, coverage targets, CAP boundaries, UI journeys

**Outputs:**
- `deliverables/Technical-Design-Document.md`
- `deliverables/Unit-Testing-Document.md`
- Revision history table with version/date/author/change

**Example:**
```
/document TDD
```

---

## Skills

Skills are specialized knowledge packages that agents use. You can invoke them directly via the Skill tool, but usually they're loaded automatically by agents.

| Skill | Category | When to load | Purpose |
|-------|----------|--------------|---------|
| **cap-skill** | Backend | CAP project audit/generation | CDS schema, service definitions, handlers, security, async/await correctness |
| **fiori-bootstrap** | Frontend | Fiori app generation | Manifest routing, Component setup, ui5.yaml bootstrap, local proxy config |
| **fiori-elements** | Frontend | FE app design review | Annotations correctness (CDS and XML), value helps, side effects, criticality |
| **fiori-freestyle** | Frontend | Freestyle UI5 TypeScript | Component.ts, routing, TypeScript strict mode, async patterns, controllers |
| **mta-reviewer** | Deployment | MTA validation | 80+ rules for mta.yaml: modules, resources, build commands, destination wiring, JWT propagation |
| **deployment-validation** | Deployment | Pre-flight checks | Templates + validation for mta.yaml, xs-app.json, xs-security.json, manifest.json, package.json |
| **deployment-checklist** | Deployment | Pre-deploy audit | XSUAA bindings, destination service config, npm audit, CORS policy, health-check endpoint |
| **sap-conventions** | Code quality | CAP project audit | Namespace consistency, folder layout, naming conventions, file headers, JSDoc |
| **review-quality-checks** | Code quality | Any code review | Hardcoded secrets, OData injection, SSRF, commented code, TODO/FIXME, CHANGELOG |
| **sap-unit-testing** | Testing | Test design/audit | Jest scenarios (CAP), QUnit/OPA5 (UI), coverage targets, test file structure |
| **sap-architecture** | Design | Architecture gates | Clean Core compliance, released APIs, on-stack modification detection |
| **sap-clean-core** | Design | Clean Core checks | Detailed released-API list, modification class detection, remediation patterns |
| **application-sanity-check** | Quality | Post-build sanity | 17 cross-file checks run after `/intent` build to catch wiring errors before review |
| **i18n-completeness** | Localization | i18n audit | Locale config, missing/dead keys, supportedLocales, fallbackLocale |
| **launchpad-workzone** | Integration | Tile registration | Semantic objects, inbound targets, crossNavigation config, Workzone content manager |
| **cap-integration** | Integration | CAP-UI wiring | Mock server, proxy config, OData metadata wiring, approuter xs-app.json patterns |
| **rap-integration** | Integration | External OData | Consuming RAP/external OData, EDMX stubs, mock data, proxy routing |
| **deliverable-templates** | Documentation | Deliverable generation | TDD, UTD, Application Architecture templates with pre-filled examples |

---

## Agents

Agents are specialized AI workers that perform multi-step tasks autonomously. Each agent type has its own capabilities and tools.

### Built-in Agent Types

| Agent | Spawned by | Purpose | Tools available |
|-------|-----------|---------|------------------|
| **cap-developer** | `/intent` or `/modify` | Builds CAP backend | Read, Write, Edit, Bash, Skill, CDS/schema tools, handler tools, security tools |
| **fiori-developer** | `/intent` or `/modify` | Builds Fiori UI (Elements + Freestyle) | Read, Write, Edit, Bash, Skill, annotation tools, UI5 lint, manifest validation |
| **deployer** | `/deploy` | Audits MTA, xs-app.json, xs-security | Read, Bash, Skill (mta-reviewer, deployment-validation, deployment-checklist) |
| **reviewer** | `/review` | Audits code quality, security, best practices | Read, Grep, Bash, Skill (review-quality-checks, sap-unit-testing, sap-architecture, sap-clean-core, cap-skill, fiori-elements, fiori-bootstrap, fiori-freestyle, i18n-completeness, deployment-checklist, deployment-validation), MCP audit tools |
| **tester** | `/test` | Generates and runs tests | Read, Write, Edit, Bash, Skill (sap-unit-testing) |
| **documenter** | `/document` | Generates TDD, UTD | Read, Write, Edit, Glob, Grep, Bash, Skill (deliverable-templates), MCP (run_checks, cap_search_model, ui5_get_project_info, fiori_list_apps) |
| **architect-scan** | `/review` → reviewer | Maps stack and architecture | Read, Grep, Bash, Skill (architecture tools) |

### Sub-Agents (spawned by agents, not directly by you)

Sub-agents are spawned automatically by other agents to parallelize work:

| Sub-agent | Spawned by | Purpose |
|-----------|-----------|---------|
| **architect-scan** | reviewer | Detects topology, stack, auth model, floorplan before review begins |
| **cap-developer** | `/intent` flow | Generates schema, services, handlers |
| **fiori-developer** | `/intent` flow | Generates UI (manifest, views, controllers, annotations) |
| **deployer** | `/deploy` command | Runs mta-reviewer + deployment-validation + deployment-checklist |

---

## MCP Servers

MCP servers are external tools integrated via Claude's MCP protocol. They provide specialized capabilities not built into Claude itself.

### Intent2App MCP Server

**Tools available:**
- `mcp__Intent2App__scaffold_app` — Create a new CAP or UI5 project structure
- `mcp__Intent2App__add_cds_entity` — Add an entity to schema.cds with associations
- `mcp__Intent2App__configure_service` — Create a CAP service definition with CRUD handlers
- `mcp__Intent2App__generate_annotations` — Create Fiori Elements annotations (CDS)
- `mcp__Intent2App__gen_mock_from_edmx` — Generate mock data from EDMX/OData metadata
- `mcp__Intent2App__create_start_ui` — Scaffold the BPA workflow Start UI app
- `mcp__Intent2App__create_task_ui` — Scaffold the BPA workflow Task UI app
- `mcp__Intent2App__ui5_get_api_reference` — Look up UI5 control API and properties
- `mcp__Intent2App__ui5_get_guidelines` — Get Fiori Design Guideline rules
- `mcp__Intent2App__ui5_get_version_info` — Check UI5 version info and library availability
- `mcp__Intent2App__ui5_get_project_info` — Read the UI5 project structure and manifest info
- `mcp__Intent2App__ui5_run_manifest_validation` — Validate manifest.json syntax
- `mcp__Intent2App__ui5_run_ui5_linter` — Run UI5 linter on the app
- `mcp__Intent2App__validate_namespace` — Check namespace consistency across 4 files
- `mcp__Intent2App__run_checks` — Compile CDS and run validation (`cds build --production`)
- `mcp__Intent2App__clean_core_check` — Detect on-stack modifications and released-API violations
- `mcp__Intent2App__cap_search_model` — Search CAP documentation for schema/service patterns
- `mcp__Intent2App__cap_search_docs` — Search CAP docs for a topic
- `mcp__Intent2App__fiori_search_docs` — Search Fiori Elements / Fiori Design docs
- `mcp__Intent2App__fiori_list_apps` — List all Fiori apps in the project
- `mcp__Intent2App__fiori_download_odata_metadata` — Download EDMX from a URL

**When to use:**
- Agents use these automatically during `/intent`, `/review`, `/modify`, `/deploy`, `/test`
- You can call them directly if you need a quick lookup (e.g., "check if sap.m.Button has a `pressed` event")

---

## Complete Workflow Example

### Scenario: Build a Purchase Order Approval App

**Step 1: Design Phase**
```
/intent Build a Purchase Order management and approval app
        with multi-level approvers, budget tracking, and audit logs.
```
Output: Requirement Register, Application Architecture, Coverage Report, working CAP + Fiori code, mta.yaml.

**Step 2: Review the Generated Code**
```
/review
```
Output: Findings table (CRITICAL, WARNING, INFO).

**Step 3: Fix Issues**
```
/modify
```
Output: Fixed code, change summary, offer to re-run `/review`.

**Step 4: Enhance Tests** (if coverage is incomplete)
```
/test
```
Output: Updated test files, coverage report.

**Step 5: Generate Final Documentation**
```
/document both
```
Output: Final TDD and UTD in `deliverables/`.

**Step 6: Pre-Deployment Audit**
```
/deploy
```
Output: MTA audit findings, deployment checklist.

**Step 7: Resolve Any Deploy Findings**
- Edit `mta.yaml`, `xs-app.json`, or `xs-security.json` manually
- Re-run `/deploy` until all CRITICALs are resolved

**Step 8: Build and Deploy**
```bash
npm run build              # runs: mbt build
npm run deploy             # runs: cf deploy
```

---

## Decision Matrix: Which Command/Skill to Use

| Need | Use command | Or use skill | Why |
|------|----------|-----------|-----|
| Start from requirements | `/intent` | — | End-to-end orchestration |
| Check existing code for issues | `/review` | — | Coordinated multi-layer audit |
| Apply review fixes | `/modify` | — | Safe edits with regression check |
| Validate mta.yaml | `/deploy` or manual | `mta-reviewer` | Same checks, mta-reviewer is re-usable |
| Check CDS model | `/review` or use skill | `cap-skill` → `cap-review-checks.md` | Fast targeted lookup |
| Check Fiori manifest | `/review` or use skill | `fiori-bootstrap` → `list-report-op.md` | Reference pattern verification |
| Audit secrets / hardcoded URLs | `/review` or use skill | `review-quality-checks` → `security-checks.md` | Grep-based scan |
| Check namespace consistency | `/review` or use skill | `sap-conventions` or MCP `validate_namespace` | Single-purpose check |
| Run tests | `/test` | — | Full test generation + execution |
| Generate docs | `/document` | — | Structured deliverables with revision history |
| Look up UI5 API | — | MCP `ui5_get_api_reference` | Single API lookup |
| Look up Fiori guideline | — | MCP `ui5_get_guidelines` | Guideline reference |

---

## Error Recovery

### My review has findings I don't agree with

1. Read the finding explanation and the fix snippet
2. If it's truly a false positive, use `/modify` and manually edit the fix
3. Or note it in a code comment and re-run `/review` to confirm it's still flagged (helps track accepted exceptions)

### My deployment audit failed but I don't understand the error

1. Find the CRITICAL finding in the audit report
2. Read the "Real-World Impact" column to understand why it matters
3. The "Fix" column has the exact code change needed
4. Apply it and re-run `/deploy`

### I generated code but it doesn't compile

1. Run `npm run build` to see the exact error
2. Read the error carefully (usually points to a specific file/line)
3. Run `/review` to audit the code (might catch the issue)
4. Or use MCP `run_checks` for a quick CDS compilation check

### I want to understand why a finding is CRITICAL vs WARNING

- **CRITICAL** = blocks a build or deploy, or is a security issue
- **WARNING** = best practice, should be fixed before production
- **INFO** = style/convention, nice-to-have improvements

---

## Performance Tips

1. **Use `/intent` for new projects** — it's faster than manually scaffolding
2. **Use `/modify` instead of editing manually** — it applies findings in sequence with diffs
3. **Conditional skills** — mta-reviewer skips sections 8e/8f/8g/8h if those resources aren't present (faster on simple projects)
4. **Run `/review` once per change** — don't iterate on the same code multiple times without applying fixes first

---

## Commands Reference

| Command | What it does |
| ------- | ------------ |
| `/intent` | End-to-end build from requirements |
| `/review` | Read-only code audit |
| `/modify` | Apply review findings |
| `/deploy` | MTA deployment readiness audit |
| `/test` | Generate and run tests |
| `/document` | Generate TDD, UTD, or both |
| `/help` | Claude Code built-in help |

---

## References

- [CLAUDE.md](./CLAUDE.md) — Project-specific engineering standards and MTA deployment pattern
- [README.md](./readme.md) — Project overview
- SAP BTP Help: https://help.sap.com/docs/btp
- CAP Docs: https://cap.cloud.sap/docs
- UI5 SDK: https://ui5.sap.com
- Fiori Design: https://experience.sap.com/fiori-design-web

---

## FAQ

**Q: Can I run `/review` multiple times on the same code?**
A: Yes. Each run detects and reports issues. Use `/modify` to fix them between runs.

**Q: What if `/intent` generates code I don't like?**
A: Use `/modify` to fix specific issues, or manually edit and re-run `/review` to validate.

**Q: Do I have to use `/intent` or can I start with my own code?**
A: You can use your own code. Just run `/review` and `/deploy` to validate it.

**Q: Can I skip the documentation deliverables?**
A: Yes. Deliverables are optional. The application code is the primary output.

**Q: What's the difference between `/review` and manual code review?**
A: `/review` is automated, unbiased, and always covers the same 11 categories. Manual review is better for design feedback and business logic. Use both.

---

*Last updated: 2026-08-05*
