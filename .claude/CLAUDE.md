# Intent2App — Engineering Standards

Single source of truth for every agent working in this workspace.
Skills encode deeper patterns; this file establishes the non-negotiable defaults.

---

## Stack defaults (always use these unless the TDD explicitly overrides)

| Layer | Technology | Version |
|---|---|---|
| CAP runtime | `@sap/cds` | `^10` |
| CAP build tool | `@sap/cds-dk` | `^10` (same major as runtime) |
| HANA driver (prod) | `@cap-js/hana` | `^3` |
| SQLite driver (dev) | `@cap-js/sqlite` | `^3` (match CDS major: CDS 9 → `^2`, CDS 10 → `^3`) |
| UI5 CLI | `@ui5/cli` | `^4` |
| CAP ↔ UI5 bridge | `cds-plugin-ui5` | `^0.17.0` |
| Mock server | `@sap-ux/ui5-middleware-fe-mockserver` | `2` |
| Test runner | `jest` | `^29` |
| OData version | V4 | — |
| UI5 version | Resolved at runtime via `mcp__intent2app__ui5_get_version_info` (recommended maintenance stream; fallback minimum `1.136+`) | — |
| UI5 theme | `sap_horizon` | — |
| TypeScript | Freestyle UI5 apps only | — |
| MDK schema version | `26.6` | per `@sap/mdk-mcp-server` 0.4.0 `mdkConfig.schemaVersion` |
| MDK CLI | `@sap/mdk-tools` | `^1.16.0` |
| Node.js (MDK) | `>=22` | Node 24 recommended |

---

## The four hard rules (never break these)

### 1. Namespace must match in all four places

`Component.(js|ts)`, `manifest.json → sap.app.id`, `index.html → resource-roots`, `ui5.yaml → metadata.name` (lowercase).
A single mismatch → `failed to load Component.js` at runtime. Run `validate_namespace` after scaffolding.

### 2. No standalone approuter module

Use the **html5-apps-repo pattern** — the BTP HTML5 Application Runtime is the public entry point.
There is no `approuter.nodejs` module. `mta-reviewer` rule G1 flags any legacy approuter.

### 3. `forwardAuthToken: true` in two places

Must appear in **both** `srv` module `provides.srv-api.properties` **and** the destination `init_data` entry.
Omitting either one silently breaks RBAC — every OData call returns 403 even with a valid user token.

### 4. No `console.log` in production code

Use `cds.log('<module>')` in CAP handlers; use the UI5 `Log` module (`sap/base/Log`) in the frontend.

### 5. MDK MCP server is mandatory for ALL MDK and SSAM queries

**Every new MDK project must follow the 6-phase workflow (Phase 1: Env Setup → Phase 2: Project
Creation → Phase 3: Service Config → Phase 4: UI Development → Phase 5: Rules & Logic →
Phase 6: Build & Deploy). Load `mdk-patterns` skill at the start of any `create-project` task.**

**Never answer MDK or SAP Asset Manager (SSAM) questions using only file-system tools (Glob, Grep, Read).**
Always call the MDK MCP tools first:

Both the **local Intent2App tools** (`mcp__intent2app__mdk_*`) and the **official SAP MDK server tools** (`mcp__mdk__mdk-*`) are available. Use local tools for offline-robust fallback; prefer SAP server tools for full fidelity (Yeoman scaffolding, vector doc search).

| Task | Local tool | SAP server tool |
|---|---|---|
| Scaffold / create project | `mcp__intent2app__mdk_create` | `mcp__mdk__mdk-create` |
| Generate pages, actions, rules | `mcp__intent2app__mdk_gen` | `mcp__mdk__mdk-gen` |
| Validate, build, deploy, QR code | `mcp__intent2app__mdk_manage` | `mcp__mdk__mdk-manage` |
| Look up schemas and docs | `mcp__intent2app__mdk_get_docs` | `mcp__mdk__mdk-docs` |
| Fetch Mobile Services metadata | *(via mdk_mobile_services)* | `mcp__mdk__mdk-fetch-mobile-metadata` |
| Discover Mobile Services apps | `mcp__intent2app__mdk_mobile_services` | *(not in SAP server)* |
| Read existing project context | `mdk-project-setup` **skill** | — |
| Check / fix bundler externals | `mdk-bundler-settings` **skill** | — |

If a tool call fails with a connection error, stop and tell the developer:
> "MDK MCP server is not reachable. Please reload the Claude Code window and retry."
Do NOT fall back to file-system tools for MDK/SSAM questions — surface the error instead.

---

## Skill map — which skill to load for which task

| Task | Load this skill |
|---|---|
| Scaffolding a new project | `cap-skill` → `cap-project-structure.md` first |
| CDS schema / data model | `cap-skill` → `cap-schema.md` |
| Service CDS + `@restrict` | `cap-skill` → `cap-service.md` |
| Handler logic (`srv/*.js`) | `cap-skill` → `cap-handlers.md`, `srv-structure.md` |
| Async / await correctness | `cap-skill` → `cap-async.md` |
| Remote services | `cap-skill` → `cap-remote.md` |
| XSUAA, roles, `xs-security.json` | `cap-skill` → `cap-security.md` |
| Fiori Elements manifest / routing | `fiori-bootstrap` skill |
| Fiori Elements annotations (CDS / XML) | `fiori-elements` skill |
| FPM building block annotations | `fiori-elements` → `fpm-annotations.md` |
| FPM bootstrapping (manifest, Component, PageController) | `fiori-bootstrap` → `fpm.md` |
| ANY FPM app (floorplan = FPM, any backend) | MUST ALWAYS load `fiori-bootstrap` → `fpm.md` + `fiori-elements` → `fpm-annotations.md` — CAP → Walkthrough B, external → Walkthrough A |
| Freestyle UI5 | `fiori-freestyle` skill |
| Mock server + proxy wiring | `cap-integration` skill |
| Consume an existing RAP / external OData (UI-only build) | `rap-integration` skill |
| `mta.yaml` deep audit | `mta-reviewer` skill |
| Full deployment pre-flight (all files + cross-file consistency) | `deployment-validation` skill |
| Deployment readiness | `deployment-checklist` skill |
| Launchpad tile + Workzone registration | `launchpad-workzone` skill |
| Architecture gates + Clean Core | `sap-architecture` skill |
| Deliverables (TDD, UTD) | `deliverable-templates` skill |
| Testing (Jest, OPA5, QUnit) | `sap-unit-testing` skill |
| i18n completeness | `i18n-completeness` skill |
| Code quality / security review | `review-quality-checks` skill |
| New MDK project (any type) | `mdk-patterns` skill — 6-phase workflow (env → scaffold → service → UI → rules → deploy) |
| MDK page / action / rule schemas | `mdk-patterns` skill — Phase 4 & 5 patterns |
| MDK build & deploy to Mobile Services | `mdk-patterns` skill — Phase 6 |
| Read existing MDK project context | `mdk-project-setup` skill — reads `.project.json` + `.service.metadata` directly |
| Check / fix MDK bundler externals | `mdk-bundler-settings` skill — reads/writes `.vscode/settings.json` directly |
| MDK offline sync conflict resolution | `mdk-offline-resilience` skill |
| MDK app versioning, OnWillUpdate, OnDidUpdate | `mdk-app-update` skill |
| MDK rules, clientAPI, NativeScript APIs | `mdk-rules-library` skill |
| MDK anti-patterns, code review checklist | `mdk-best-practices` skill |
| MDK schema version upgrade (24.7 → 26.6) | `mdk-migration` skill |
| CF login, region setup, Mobile Services configuration | `mdk-cf-mobile-services` skill |
| SSAM project conventions, CIM file, ZEquinorSSAM folder | `mdk-ssam-patterns` skill |
| SSAM version upgrade, Metadata Upgrade Tool, merge conflicts | `mdk-ssam-upgrade` skill |
| SSAM Upgrade or Customize interactive workflow (from /intent) | `mdk-ssam-workflow` skill — SSAM project structure templates, CIM creation, Z project scaffolding, override patterns, Z naming, validation checklist |
| CAP backend + MDK mobile frontend full-stack | `mdk-cap-integration` skill |
| Multi-environment deploy, device onboarding, QR code, CI/CD | `mdk-environment-deploy` skill |

---

## Key prohibitions (apply across all generated code)

- **No hardcoded URLs or credentials** anywhere — use Destination Service for backend URLs, env vars for secrets.
- **No `xs-security.json` inlined in `mta.yaml`** — always reference via `path: ./xs-security.json`.
- **No raw SQL** in CAP handlers — CQL only (`SELECT.from`, `INSERT.into`, `UPDATE`, `DELETE.from`).
- **No `req.user.id` or email checks** for authorization — use `req.user.is('RoleName')`.
- **No two-way OData binding** on read-only data — one-way or one-time binding only.
- **No jQuery** — deprecated in UI5 1.120+.
- **No `SimpleForm`** — use `sap.ui.layout.form.Form` with `ColumnLayout`.
- **No entity without `@restrict`** in a service — missing restriction = open to all authenticated users.
- **No `gen/` committed to git** — `gen/` must be in `.gitignore`; it is rebuilt by `mbt build`.
- **No `default-env.json` committed** — contains live VCAP_SERVICES credentials.
- **No `existing_destinations_policy: fail`** — breaks every redeploy; use `update`.
- **No hardcoded strings in MDK metadata** — all user-visible strings use `{i18n>Key}`.
- **No manual `.service.metadata` generation** — use `mdk_mobile_services` (fetch-metadata) or VS Code MDK extension.
- **No files written to `SAPAssetManager/`** (SSAM projects) — read-only reference only; implement in `ZEquinorSSAM/`.

---

## CAP authorization pattern (mandatory on every service)

```cds
service MyService @(requires: 'authenticated-user') {
  entity MyEntity @(restrict: [
    { grant: 'READ',              to: ['Viewer', 'Editor', 'Admin'] },
    { grant: ['CREATE','UPDATE'], to: ['Editor', 'Admin'] },
    { grant: 'DELETE',            to: 'Admin' }
  ]) as projection on db.MyEntity;
}
```

Roles are defined in `xs-security.json`. Dev uses mocked users in `.cdsrc.json`. Production uses XSUAA.

---

## MTA deployment pattern (html5-apps-repo, no standalone approuter)

```
Browser → BTP HTML5 Application Runtime → Destination Service → CAP srv → HANA Cloud
```

`mta.yaml` modules: `*-srv` (nodejs) · `*-db-deployer` (hdb) · `*-ui` (html5) · `*-app-deployer` (com.sap.application.content) · `*-destination-content` (com.sap.application.content)

`mta.yaml` resources: `*-auth` (xsuaa) · `*-db` (hana/hdi-container) · `*-destination` (destination) · `*-html5-repo-host` (html5-apps-repo/app-host)

For the full annotated pattern run the `mta-reviewer` skill. For the `xs-app.json` + destination wiring see `cap-integration` → `deploy-approuter-mta.md`.

---

## Launchpad tile registration (every deployed app)

Add `crossNavigation.inbounds` to `manifest.json` and ensure `sap.app.sap.cloud.service` matches `mta.yaml` destination-content. After deploy, register the app in SAP Build Workzone Content Manager. See `launchpad-workzone` skill.

---

## Scope (what Intent2App builds)

✅ CAP Node.js + Fiori Elements (LR+OP, ALP, Object Page, FPM)
✅ CAP Node.js + Freestyle UI5 (TypeScript)
✅ Fiori Elements consuming external OData / RAP (mock + proxy)
✅ SAP BPA workflow Start UI + Task UI
✅ MDK (Mobile Development Kit) — online/offline CRUD, Mobile Services integration, SSAM projects
🚫 RAP/ABAP Cloud development (consumption only)
🚫 Pro-code side-by-side extensibility (planned, not implemented)
🚫 Event-driven / SAP Event Mesh (planned, not implemented)
🚫 Multi-tenancy (planned, not implemented)
