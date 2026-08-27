# Intent2App (NL2BTP) — Project Context

**Intent2App** is an AI-powered scaffolding and development orchestrator for SAP BTP applications. It turns natural language requirements into runnable apps across CAP, Fiori Elements, Freestyle UI5, and MDK (Mobile Development Kit).

---

## MCP Server

The local Intent2App MCP server starts automatically when this project opens in Claude Code (via `.mcp.json` → `node mcp-server/start.js`). It auto-installs `node_modules` on first run.

**Server URL:** stdio (no port — spawned as child process)
**Pre-flight check:** `mcp__intent2app__validate_namespace { "namespace": "com.preflight.check", "projectDir": "." }`

---

## Commands

| Command | Purpose |
|---|---|
| `/intent <requirement or path>` | End-to-end flow: requirement → TDD → scaffold → validate. Supports CAP/Fiori/UI5 and MDK. |
| `/modify <change description>` | Modify an existing project — adds features, entities, or pages to an already-scaffolded app. |
| `/review` | Code review against Clean Core, SAP conventions, and domain best practices. |
| `/test` | Generate and run unit tests for the current project. |
| `/document` | Generate technical documentation for the current project. |
| `/deploy` | Deployment readiness audit — checks mta.yaml, xs-app.json, xs-security.json before mbt build or cf deploy. |

---

## Tools by Domain

### CAP / BTP Scaffolding
| Tool | Purpose |
|---|---|
| `mcp__intent2app__scaffold_app` | Scaffold a new CAP/Fiori/UI5 project from a starter template |
| `mcp__intent2app__validate_namespace` | Validate SAP namespace conventions |
| `mcp__intent2app__add_cds_entity` | Add a CDS entity to an existing CAP service |
| `mcp__intent2app__generate_annotations` | Generate Fiori annotations from a CDS service |
| `mcp__intent2app__gen_mock_from_edmx` | Generate mock data from EDMX metadata |
| `mcp__intent2app__configure_service` | Configure a CAP service with auth, destinations, or OData settings |
| `mcp__intent2app__run_checks` | Run cds build + lint checks on a CAP project |
| `mcp__intent2app__clean_core_check` | Verify the app follows SAP Clean Core principles |
| `mcp__intent2app__create_start_ui` | Generate SAP Build Process Automation Start UI |
| `mcp__intent2app__create_task_ui` | Generate SAP Build Process Automation Task UI |

### UI5
| Tool | Purpose |
|---|---|
| `mcp__intent2app__ui5_get_guidelines` | Get UI5 development guidelines |
| `mcp__intent2app__ui5_get_version_info` | Get current UI5 version information |
| `mcp__intent2app__ui5_get_api_reference` | Look up UI5 API reference |
| `mcp__intent2app__ui5_get_project_info` | Read UI5 project configuration |
| `mcp__intent2app__ui5_run_manifest_validation` | Validate manifest.json |
| `mcp__intent2app__ui5_run_ui5_linter` | Run ui5lint on the project |

### CAP Documentation
| Tool | Purpose |
|---|---|
| `mcp__intent2app__cap_search_model` | Search CAP CDS model documentation |
| `mcp__intent2app__cap_search_docs` | Search CAP developer documentation |

### Fiori
| Tool | Purpose |
|---|---|
| `mcp__intent2app__fiori_search_docs` | Search Fiori Elements documentation |
| `mcp__intent2app__fiori_list_apps` | List Fiori apps in the current workspace |
| `mcp__intent2app__fiori_download_odata_metadata` | Download OData EDMX from a service URL |

### MDK — Core (exact replicas of @sap/mdk-mcp-server tools)
| Tool | MDK Tool Name | Purpose |
|---|---|---|
| `mcp__intent2app__mdk_create` | `mdk-create` | Scaffold MDK project or add entity metadata using templates (crud/list detail/base). Uses @sap/generator-mdk (Yeoman). Reads `.service.metadata` automatically. |
| `mcp__intent2app__mdk_gen` | `mdk-gen` | Generate pages, actions, i18n, or rules. Returns LLM prompts for pages/actions/i18n; semantic search for rules. |
| `mcp__intent2app__mdk_manage` | `mdk-manage` | build / deploy / validate / migrate / show-qrcode / open-mobile-app-editor. Auto-reads `mdk.bundlerExternals` from `.vscode/settings.json` for deploy. |
| `mcp__intent2app__mdk_get_docs` | `mdk-docs` | Search MDK component schemas and examples (search / component / property / example / search-samples). |
| `mcp__intent2app__mdk_fetch_mobile_metadata` | `mdk-fetch-mobile-metadata` | Fetch OData EDMX from Mobile Services via conduit pattern → saves `.service.metadata`. |

### MDK — Supplementary (not in @sap/mdk-mcp-server)
| Tool | Purpose |
|---|---|
| `mcp__intent2app__mdk_mobile_services` | All Mobile Services operations: list apps / get destinations / fetch metadata / create new app |
| `mcp__intent2app__mdk_check_settings` | Check / fix `mdk.bundlerExternals` in `.vscode/settings.json` |
| `mcp__intent2app__mdk_read_project_context` | Read existing MDK project — `.project.json`, entity sets, page/action counts |

---

## Agents

| Agent | Spawned by | Purpose |
|---|---|---|
| `cap-developer` | `/intent` STEP 8 | Builds CAP backend — CDS models, services, handlers, auth, CSV fixtures |
| `fiori-developer` | `/intent` STEP 8 | Builds Fiori UI — annotations, floorplans, freestyle UI5 |
| `mdk-developer` | `/intent` STEP 8 (MDK path) | Builds MDK mobile layer — pages, actions, rules, i18n, offline configuration |
| `architect-scan` | `/review` | Architecture review against SAP Clean Core and best practices |
| `reviewer` | `/review` | Code review — naming, conventions, anti-patterns |
| `tester` | `/test` | Unit test generation and execution |
| `documenter` | `/document` | Technical documentation generation |
| `deployer` | `/deploy` | Read-only deployment readiness auditor — mta.yaml, xs-app.json, xs-security.json audit |
| `procode-developer` | `/intent` (RAP path) | Pro-code extensibility (ABAP Cloud, RAP) — out of scope for NL2BTP |

---

## Skills

### MDK Skills
| Skill | Triggers on |
|---|---|
| `mdk-patterns` | Page types, action chains, offline patterns, binding syntax, i18n |
| `mdk-rules-library` | clientAPI methods, UpdateLinks, rule templates, NativeScript APIs |
| `mdk-best-practices` | Code review checklist, anti-patterns, conventions |
| `mdk-migration` | Schema version upgrades 24.7 → 26.6, migration commands |
| `mdk-offline-resilience` | Conflict resolution actions, DefiningRequests tuning, retry patterns |
| `mdk-app-update` | OnWillUpdate / OnDidUpdate hooks, forced update, schema migration across versions |

### CAP / Fiori / SAP Skills
| Skill | Triggers on |
|---|---|
| `cap-skill` | CDS modeling, handlers, services, auth, schema |
| `cap-integration` | EDMX/mock, local proxy, MTA deploy, BAS destinations |
| `fiori-elements` | List Report, Object Page, value helps, annotations |
| `fiori-bootstrap` | All Fiori floorplans and app types |
| `fiori-freestyle` | Freestyle UI5 in CAP and standalone |
| `sap-architecture` | SAP BTP architecture decisions, clean core, pattern catalog |
| `sap-clean-core` | Clean Core compliance rules |
| `sap-conventions` | SAP naming, bootstrapping, coding standards |
| `sap-unit-testing` | CAP Jest, UI5 OPA5 test patterns |
| `application-sanity-check` | Pre-deploy checklist, sanity check results format |
| `deployment-checklist` | MTA structure, xs-app security, build readiness checks |
| `deployment-validation` | Deployment templates and validation patterns |
| `i18n-completeness` | i18n key coverage checks, manifest locale config |
| `launchpad-workzone` | SAP Launchpad / Work Zone configuration |
| `mta-reviewer` | Full mta.yaml compatibility audit — 13 check categories |
| `rap-integration` | RAP/ABAP Cloud integration patterns |
| `review-quality-checks` | Code review quality standards |
| `deliverable-templates` | TDD, architecture docs, test plans |
| `procode-extensibility` | RAP, ABAP Cloud extension patterns |

---

## Key Rules

1. **MDK path is separate** — when the user selects MDK in `/intent`, skip all CAP/Fiori gates. MDK uses Mobile Services destinations, not CDS models.
2. **Workspace-first** — always scan for existing `.project.json` or `.service.metadata` before asking questions. If found, offer to modify the existing project.
3. **CF login requires a terminal** — `cf login --sso` cannot happen inside Claude Code chat. Instruct the developer to run it in a terminal.
4. **`.service.metadata` is sacred** — never generate it manually. Use `mdk_mobile_services` (fetch-metadata operation) or VS Code → "MDK: Open Mobile App Editor".
5. **Schema version is 26.6** — current default per `@sap/mdk-mcp-server` 0.4.0 `mdkConfig.schemaVersion`.
6. **`mdk.bundlerExternals`** — always check `.vscode/settings.json` before deploy. Run `mdk_check_settings` if unsure.
7. **No hardcoded strings** — all user-visible MDK strings use `{i18n>Key}`.
8. **OnSuccess + OnFailure** — every OData action must have both.
9. **Delete confirmation** — always show a `Message` dialog before `DeleteEntity`.
10. **Modal navigation** — Create/Edit pages always use `ModalPage: true, ModalPageFullscreen: true`.

---

## Reference Apps

Located in `reference-apps/`:

| Folder | Type | Description |
|---|---|---|
| `cap-service-only/` | CAP | CAP backend service only |
| `cap-fullstack-listreport/` | CAP + Fiori | Full CAP + Fiori Elements List Report |
| `cap-fullstack-freestyle/` | CAP + UI5 | Full CAP + Freestyle UI5 |
| `fiori-elements-external-service/` | Fiori | Fiori Elements consuming external OData |
| `freestyle-ui5-ts/` | UI5 | Standalone Freestyle UI5 TypeScript |
| `mdk-online-crud/` | MDK | Online CRUD — Customers entity (ESPM OData) |
| `mdk-offline-crud/` | MDK | Offline CRUD — Work Orders with sync actions |

---

## MDK Developer Flow (quick reference)

```
1. Scan workspace for existing .project.json → offer modify or create new
2. CF login check (terminal only: cf login --sso)
3. mdk_mobile_services { operation: "list" } → show apps
4. mdk_mobile_services { operation: "destinations", appId } → show destinations
5. mdk_mobile_services { operation: "fetch-metadata", appId, destination, folderRootPath }
   → saves .service.metadata
6. mdk_check_settings { operation: "check" } → validate bundlerExternals
7. mdk_create { scope: "project", templateType: "crud", oDataEntitySets, offline }
8. mdk_gen (additional pages/actions/rules if needed)
9. mdk_manage { operation: "validate" } → must be 0 errors
10. mdk_manage { operation: "deploy" } → generates .build/qrcode.png
11. mdk_manage { operation: "show-qrcode" } → scan with SAP Mobile Services Client
```
