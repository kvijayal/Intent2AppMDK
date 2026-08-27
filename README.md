# Intent2App v0.2.0

Orchestrator-driven, Clean-Core-aligned SAP BTP build framework.

From a requirement or Functional Design to a runnable, code-verified app with a
Technical Design and Unit Testing Document.

**Supported stacks:** CAP (CAPM) · Fiori Elements · Freestyle UI5 · MDK (Mobile Development Kit)

---

## Quick Start

```bash
# 1. Open your project in Claude Code
claude

# The MCP server starts automatically on first open.
# start.js installs @modelcontextprotocol/sdk automatically if missing.
# No terminal to keep open. No manual npm install needed.

# 2. Run the intent command
/intent <path-to-FD.md>
# or
/intent "I need a mobile MDK app for field technicians to manage work orders offline"
```

> **How it works:** Claude Code reads `.mcp.json` and spawns `node mcp-server/start.js` as a stdio child process. `start.js` auto-installs `node_modules` on first run if missing, then starts `index.js`. The server is ready in seconds — no separate terminal, no port to manage.
>
> **Requirement:** Node.js >= 22 (Node 24 recommended per SAP MDK tutorial)

---

## MCP Tools

| Domain | Tool | Description |
|---|---|---|
| **Scaffold** | `scaffold_app` | Copy a reference starter + rewrite namespace |
| **Scaffold** | `add_cds_entity` | Add CDS entity with managed/cuid |
| **Scaffold** | `validate_namespace` | Check namespace consistency in 4 places |
| **CAP** | `configure_service` | Wire mock/remote OData service |
| **CAP** | `generate_annotations` | Generate backend Fiori annotations |
| **CAP** | `gen_mock_from_edmx` | Generate mock data from EDMX |
| **CAP** | `clean_core_check` | Clean Core compliance check |
| **CAP** | `run_checks` | CDS build + lint + TypeScript typecheck |
| **UI5** | `ui5_get_api_reference` | Search UI5 API reference |
| **UI5** | `ui5_get_guidelines` | Get UI5 coding guidelines |
| **UI5** | `ui5_get_version_info` | Get UI5 version info |
| **UI5** | `ui5_get_project_info` | Read UI5 project config |
| **UI5** | `ui5_run_manifest_validation` | Validate manifest.json |
| **UI5** | `ui5_run_ui5_linter` | Run ui5lint |
| **CAP docs** | `cap_search_docs` | Search CAP documentation |
| **CAP docs** | `cap_search_model` | Search CDS model |
| **Fiori** | `fiori_search_docs` | Search Fiori documentation |
| **Fiori** | `fiori_list_apps` | List Fiori apps in project |
| **Fiori** | `fiori_download_odata_metadata` | Download OData metadata (EDMX) |
| **Workflow** | `create_start_ui` | Scaffold SBPA Workflow Start UI |
| **Workflow** | `create_task_ui` | Scaffold SBPA Workflow Task UI |
| **MDK** | `mdk_get_docs` | Search MDK documentation |
| **MDK** | `mdk_read_project_context` | Read MDK project config + entity sets |
| **MDK** | `mdk_validate_project` | Run mdkcli validate |
| **MDK** | `mdk_build_project` | Run mdkcli build |
| **MDK** | `mdk_deploy_project` | Deploy to SAP Mobile Services |

---

## Agents

| Agent | Trigger |
|---|---|
| `cap-developer` | Spawned by /intent for CAP backend |
| `fiori-developer` | Spawned by /intent for Fiori/UI5 frontend |
| `mdk-developer` | Spawned by /intent for MDK mobile frontend |
| `architect-scan` | Architecture scan and decision |
| `reviewer` | Code review and security audit |
| `tester` | Unit test generation |
| `documenter` | TDD and UTP document generation |
| `procode-developer` | Pro-code extensibility (reserved) |

---

## Skills

| Skill | Covers |
|---|---|
| `mdk-patterns` | **MDK** pages, actions, rules, offline, binding, i18n, deploy |
| `cap-skill` | CAP schema, service, handlers, security, modeling |
| `cap-integration` | EDMX, mock, proxy, BAS destinations, MTA deploy |
| `fiori-elements` | UI.LineItem, annotations, criticality, drafts, value helps |
| `fiori-bootstrap` | Manifest, routing, floorplan setup per app type |
| `fiori-freestyle` | TypeScript MVC, XML views, OData model |
| `sap-architecture` | Decision gates, pattern catalog, backend vs RAP |
| `sap-clean-core` | Clean Core compliance reference |
| `sap-conventions` | SAP naming, namespace, coding conventions |
| `sap-unit-testing` | CAP Jest, UI5 OPA5, QUnit |
| `deliverable-templates` | TDD, UTP, Architecture, Requirement Register |
| `application-sanity-check` | 9-point build validation checklist |
| `procode-extensibility` | Pro-code patterns (reserved) |

---

## MDK Prerequisites

```bash
npm install -g @sap/mdk-tools   # MDK CLI
cf login --sso                  # Cloud Foundry login for deploy
# VS Code MDK Extension: SAPSE.vsc-extension-mdk (for .service.metadata)
```

---

## Reference

- CAP: https://cap.cloud.sap/docs
- MDK: https://help.sap.com/docs/MDK
- UI5: https://ui5.sap.com
- Fiori Tools: https://help.sap.com/docs/SAP_FIORI_tools
