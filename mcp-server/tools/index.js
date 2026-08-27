// Tool registry — Intent2App custom MCP tools.
// NOTE: MDK scaffolding (mdk-create, mdk-gen, mdk-manage, mdk-docs, mdk-fetch-mobile-metadata)
// is handled by the official @sap/mdk-mcp-server wired in .mcp.json as "mdk-mcp" server.
// This server provides only supplementary tools not in the SAP server.

// ── Custom-BTP scaffolding tools ─────────────────────────────────────────────
import scaffold_app         from "./CustomBTP-mcp/scaffold_app.js";
import validate_namespace   from "./CustomBTP-mcp/validate_namespace.js";
import add_cds_entity       from "./CustomBTP-mcp/add_cds_entity.js";
import generate_annotations from "./CustomBTP-mcp/generate_annotations.js";
import gen_mock_from_edmx   from "./CustomBTP-mcp/gen_mock_from_edmx.js";
import configure_service    from "./CustomBTP-mcp/configure_service.js";
import run_checks           from "./CustomBTP-mcp/run_checks.js";
import clean_core_check     from "./CustomBTP-mcp/clean_core_check.js";
import create_start_ui      from "./CustomBTP-mcp/create_start_ui.js";
import create_task_ui       from "./CustomBTP-mcp/create_task_ui.js";

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

// ── MDK supplementary tools (not in @sap/mdk-mcp-server) ─────────────────────
// The official SAP server handles: mdk-create, mdk-gen, mdk-manage, mdk-docs, mdk-fetch-mobile-metadata
// These add: Mobile Services app/destination discovery, project context reading, settings validation
import mdk_mobile_services     from "./mdk-mcp/mdk_mobile_services.js";
import mdk_check_settings      from "./mdk-mcp/mdk_check_settings.js";
import mdk_read_project_context from "./mdk-mcp/mdk_read_project_context.js";

export const allTools = [
  // BTP scaffolding
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
  // MDK supplementary
  mdk_mobile_services, mdk_check_settings, mdk_read_project_context
];
