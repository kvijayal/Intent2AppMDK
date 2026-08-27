// Tool registry — Intent2App local MCP server.
// Pattern mirrors CAP/Fiori/UI5: local self-contained tools here,
// official SAP server (@sap/mdk-mcp-server) wired separately in .mcp.json.

// ── CAP / BTP scaffolding tools ──────────────────────────────────────────────
import scaffold_app         from "./customBTP-mcp/scaffold_app.js";
import validate_namespace   from "./customBTP-mcp/validate_namespace.js";
import add_cds_entity       from "./customBTP-mcp/add_cds_entity.js";
import generate_annotations from "./customBTP-mcp/generate_annotations.js";
import gen_mock_from_edmx   from "./customBTP-mcp/gen_mock_from_edmx.js";
import configure_service    from "./customBTP-mcp/configure_service.js";
import run_checks           from "./customBTP-mcp/run_checks.js";
import clean_core_check     from "./customBTP-mcp/clean_core_check.js";
import create_start_ui      from "./customBTP-mcp/create_start_ui.js";
import create_task_ui       from "./customBTP-mcp/create_task_ui.js";

// ── UI5 tools ─────────────────────────────────────────────────────────────────
import ui5_get_guidelines          from "./ui5-mcp/ui5_get_guidelines.js";
import ui5_get_version_info        from "./ui5-mcp/ui5_get_version_info.js";
import ui5_get_api_reference       from "./ui5-mcp/ui5_get_api_reference.js";
import ui5_get_project_info        from "./ui5-mcp/ui5_get_project_info.js";
import ui5_run_manifest_validation from "./ui5-mcp/ui5_run_manifest_validation.js";
import ui5_run_ui5_linter          from "./ui5-mcp/ui5_run_ui5_linter.js";

// ── CAP tools ─────────────────────────────────────────────────────────────────
import cap_search_model from "./cap-mcp/cap_search_model.js";
import cap_search_docs  from "./cap-mcp/cap_search_docs.js";

// ── Fiori tools ───────────────────────────────────────────────────────────────
import fiori_search_docs             from "./fiori-mcp/fiori_search_docs.js";
import fiori_list_apps               from "./fiori-mcp/fiori_list_apps.js";
import fiori_download_odata_metadata from "./fiori-mcp/fiori_download_odata_metadata.js";

// ── MDK tools — local self-contained replications ────────────────────────────
// These mirror the official @sap/mdk-mcp-server tools (Apache-2.0).
// The SAP server is also wired in .mcp.json as "mdk" for full fidelity.
// Local tools are offline-robust fallbacks (no Yeoman/vector embeddings needed).
import mdk_create          from "./mdk-mcp/mdk_create.js";       // mirrors: mdk-create
import mdk_gen             from "./mdk-mcp/mdk_gen.js";          // mirrors: mdk-gen
import mdk_manage          from "./mdk-mcp/mdk_manage.js";       // mirrors: mdk-manage
import mdk_get_docs        from "./mdk-mcp/mdk_get_docs.js";     // mirrors: mdk-docs
import mdk_mobile_services from "./mdk-mcp/mdk_mobile_services.js"; // supplementary: not in SAP server

export const allTools = [
  // CAP / BTP
  scaffold_app, validate_namespace, add_cds_entity, generate_annotations,
  gen_mock_from_edmx, configure_service, run_checks, clean_core_check,
  create_start_ui, create_task_ui,
  // UI5
  ui5_get_guidelines, ui5_get_version_info, ui5_get_api_reference,
  ui5_get_project_info, ui5_run_manifest_validation, ui5_run_ui5_linter,
  // CAP
  cap_search_model, cap_search_docs,
  // Fiori
  fiori_search_docs, fiori_list_apps, fiori_download_odata_metadata,
  // MDK
  mdk_create, mdk_gen, mdk_manage, mdk_get_docs, mdk_mobile_services
];
