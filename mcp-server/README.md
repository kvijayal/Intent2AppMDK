# Intent2App — Custom MCP Server

A small, **local** MCP server bundled with Intent2App. It exposes deterministic SAP-BTP tooling distilled from the project's learnings, so the agents don't have to hand-build everything from prose. It is **our own code** (Node, stdio) — it does **not** call or depend on any external SAP MCP server, so it's fine under the enterprise license.

> The `skills/` are the source of truth. Every tool here is a thin automation of a skill. If this server isn't running, the agents fall back to doing the same thing by hand from the skills.

## Packaged tool families

This single bundled server packages four tool families. The UI5/CAP/Fiori families are **replicated** (their public, Apache-2.0 tool logic re-implemented in our own code) — we never install or run the external SAP MCP servers, so the licensing stays clean and `.mcp.json` stays unchanged.

| Family | Source (replicated from) | Tools |
|---|---|---|
| **Custom-BTP** (our own) | Intent2App skills | `scaffold_app`, `validate_namespace`, `add_cds_entity`, `generate_annotations`, `gen_mock_from_edmx`, `configure_service`, `run_checks`, `clean_core_check` |
| **UI5** | [github.com/UI5/mcp-server](https://github.com/UI5/mcp-server) | `ui5_get_guidelines`, `ui5_get_version_info`, `ui5_get_api_reference`, `ui5_get_project_info`, `ui5_run_manifest_validation`, `ui5_run_ui5_linter` |
| **CAP** | [github.com/cap-js/mcp-server](https://github.com/cap-js/mcp-server) | `cap_search_model`, `cap_search_docs` |
| **Fiori** | [SAP/open-ux-tools — fiori-mcp-server](https://github.com/SAP/open-ux-tools/blob/main/packages/fiori-mcp-server/README.md) | `fiori_search_docs`, `fiori_list_apps`, `fiori_download_odata_metadata` |

> Some upstream Fiori tools (app generation, EDMX-based scaffolding) are intentionally **not** re-added — the Custom-BTP family already covers them via `scaffold_app`, `generate_annotations`, `gen_mock_from_edmx`, and `configure_service`.

## Install & verify

```bash
cd mcp-server
npm install        # installs @modelcontextprotocol/sdk
npm run smoke      # dependency-free check: all 19 tools registered & exercised
node index.js      # starts the stdio server (Ctrl-C to stop); Claude Code launches it via ../.mcp.json
```

`../.mcp.json` registers it as the `intent2app` server (`node ${CLAUDE_PROJECT_DIR}/mcp-server/index.js`). In Claude Code, run `/doctor` to confirm it connected and its tools are listed as `mcp__intent2app__*`.

## Tools

| Tool | Encodes (skill) | What it does |
|---|---|---|
| `scaffold_app` | fiori-app-bootstrapping | Copy a `reference-apps/` starter into `output/<app>/` and rewrite the namespace in all 4 places |
| `validate_namespace` | fiori-app-bootstrapping | Cross-check Component / manifest / index.html / ui5.yaml namespace + lowercase rule |
| `add_cds_entity` | cap-best-practices | Append a conventions-compliant entity to `db/schema.cds` |
| `generate_annotations` | fiori-annotations | Emit `annotations.cds` (CAP) or `annotation.xml` (RAP/external) for a floorplan |
| `gen_mock_from_edmx` | destinations-and-services | Parse EDMX → metadata + mockdata + `ui5-mock.yaml` (offline run) |
| `configure_service` | destinations-and-services | Patch manifest dataSources + emit proxy/approuter/mta snippets (real backend) |
| `run_checks` | unit-testing / CLAUDE.md | Run `cds build` / `npm test` (CAP) or lint / typecheck (UI5); structured results |
| `clean_core_check` | sap-architecture-decisions | Heuristic Clean Core scan (V4, @requires/@restrict, no console.log, no hardcoded URLs) |
| `ui5_get_guidelines` | UI5 (replicated) | Return the UI5 coding/tooling/CAP-integration guidelines to follow before any UI5 work |
| `ui5_get_version_info` | UI5 (replicated) | Query the SAPUI5/OpenUI5 CDN for current / latest / LTS version details |
| `ui5_get_api_reference` | UI5 (replicated) | Search the UI5 API reference for a control/module, scoped to the project's UI5 version |
| `ui5_get_project_info` | UI5 (replicated) | Read `ui5.yaml` + `package.json` → framework name/version, deps, project type |
| `ui5_run_manifest_validation` | UI5 (replicated) | Validate `manifest.json` structure + namespace consistency |
| `ui5_run_ui5_linter` | UI5 (replicated) | Run `@ui5/linter` → deprecated APIs, a11y issues, bugs (optional `--fix`) |
| `cap_search_model` | CAP (replicated) | `cds compile --to json` + fuzzy-search definitions, elements, associations, annotations |
| `cap_search_docs` | CAP (replicated) | Keyword search of capire (cap.cloud.sap) topics → canonical URLs + summaries |
| `fiori_search_docs` | Fiori (replicated) | Keyword search of Fiori elements / annotations / UI5 / OPA5 / Fiori-tools docs |
| `fiori_list_apps` | Fiori (replicated) | Scan a directory for Fiori apps (manifest.json) → id, type, service, floorplan |
| `fiori_download_odata_metadata` | Fiori (replicated) | Fetch a service's `$metadata` → save `metadata.xml` (feed to `gen_mock_from_edmx`) |

## Layout

```
mcp-server/
├── index.js          # stdio/http server; wires the registry to the MCP SDK
├── smoke-test.js     # node smoke-test.js — no SDK needed
├── tools/
│   ├── index.js      # the registry (allTools) — imports every family
│   ├── _util.js      # okText/errText/jsonText result helpers (shared)
│   ├── CustomBTP-mcp/ # our own tools (scaffold_app, run_checks, clean_core_check, …)
│   ├── ui5-mcp/      # UI5 family (replicated from UI5/mcp-server)
│   ├── cap-mcp/      # CAP family (replicated from cap-js/mcp-server)
│   └── fiori-mcp/    # Fiori family (replicated from open-ux-tools fiori-mcp-server)
└── lib/
    ├── fs-utils.js   # copy/walk/read/write helpers
    ├── namespace.js  # find/validate/rewrite the UI5 namespace
    ├── edmx.js       # tolerant $metadata parser + mock-row generator
    └── starters.js   # appType → reference-apps starter + path resolution
```

Each tool file is one default export `{ name, description, inputSchema, handler }`. From inside a family folder, shared imports are one level up/down: `import { okText } from "../_util.js"` and `import { exists } from "../../lib/fs-utils.js"`.

## Adding a tool

1. Create `tools/<family>-mcp/<name>.js` default-exporting `{ name, description, inputSchema, handler }` (JSON-Schema `inputSchema`; `handler(args)` returns `{ content: [{ type: "text", text }] }`). Import shared helpers as `../_util.js` and `../../lib/*`.
2. Register it in `tools/index.js` (import from `./<family>-mcp/<name>.js`, add to `allTools`).
3. Update `EXPECTED` in `smoke-test.js` and run `npm run smoke`.
