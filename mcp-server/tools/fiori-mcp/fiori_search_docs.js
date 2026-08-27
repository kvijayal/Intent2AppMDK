// Replicated from SAP/open-ux-tools — fiori-mcp-server (Apache-2.0)
// Upstream tool: "search_docs" — search Fiori elements / Annotations / UI5 /
// OPA5 / Fiori tools documentation. Self-contained curated keyword index;
// offline-robust, no embeddings model and no external MCP dependency.
import { okText, errText } from "../_util.js";

// Curated SAP Fiori documentation index — { title, url, keywords, summary }.
// URLs are stable doc landing pages (capire / SAP Help / UI5 demokit topics).
const FE_OVERVIEW = "https://ui5.sap.com/#/topic/03265b0408e2432c9571d6b3feb6b1fd";
const CAP_FIORI   = "https://cap.cloud.sap/docs/advanced/fiori";
const FIORI_TOOLS = "https://help.sap.com/docs/SAP_FIORI_tools";
const UI5_DOCS    = "https://ui5.sap.com/";

const DOCS = [
  { title: "Fiori Elements Overview (floorplans)", url: FE_OVERVIEW,
    keywords: ["fiori elements", "floorplan", "list report", "object page", "alp", "analytical list page", "overview page", "worklist", "template"],
    summary: "Metadata-driven templates: List Report + Object Page, Analytical List Page, Overview Page, Worklist. Driven by OData + UI annotations." },
  { title: "UI.LineItem (table columns)", url: CAP_FIORI,
    keywords: ["lineitem", "table", "column", "list report", "datafield", "responsive table", "selection mode"],
    summary: "@UI.LineItem defines the columns of a List Report / table; each entry is a DataField, DataFieldForAnnotation, or DataFieldForAction. See the fiori-annotations skill." },
  { title: "UI.SelectionFields (filter bar)", url: CAP_FIORI,
    keywords: ["selectionfields", "filter", "filter bar", "search", "selectionvariant", "default filter"],
    summary: "@UI.SelectionFields exposes properties as filter-bar fields on a List Report / ALP. See the fiori-annotations skill." },
  { title: "Object Page (HeaderInfo, Facets, FieldGroup)", url: CAP_FIORI,
    keywords: ["object page", "headerinfo", "facets", "fieldgroup", "section", "header", "identification", "datapoint"],
    summary: "@UI.HeaderInfo (title/subtitle), @UI.Facets (sections), @UI.FieldGroup (grouped fields), @UI.Identification (default detail fields)." },
  { title: "Analytical List Page (Chart + Table)", url: FE_OVERVIEW,
    keywords: ["alp", "analytical list page", "chart", "presentationvariant", "kpi", "aggregation", "dimension", "measure"],
    summary: "ALP pairs @UI.Chart + @UI.PresentationVariant over an analytical (aggregatable) entity; supports visual filters and KPIs." },
  { title: "Value Help (Common.ValueList)", url: CAP_FIORI,
    keywords: ["value help", "valuelist", "f4", "common.valuelist", "dropdown", "fixed values", "valuelistwithfixedvalues"],
    summary: "@Common.ValueList wires an F4 value help to a property; @Common.ValueListWithFixedValues renders a dropdown. See the fiori-annotations skill." },
  { title: "Criticality & Semantic Colors", url: CAP_FIORI,
    keywords: ["criticality", "status", "semantic", "color", "datapoint", "criticalityrepresentation", "withicon", "traffic light"],
    summary: "@UI.DataPoint Criticality: 0 Neutral · 1 Negative/red · 2 Critical/orange · 3 Positive/green, with CriticalityRepresentation #WithIcon. Never colour alone." },
  { title: "Actions (DataFieldForAction)", url: CAP_FIORI,
    keywords: ["action", "datafieldforaction", "button", "bound action", "determining action"],
    summary: "Surface OData actions in the UI with @UI.DataFieldForAction; trigger backend logic without controller code. Pair with @Common.SideEffects." },
  { title: "Side Effects", url: CAP_FIORI,
    keywords: ["side effects", "sideeffects", "refresh", "recalculate", "targetproperties", "targetentities", "trigger"],
    summary: "@Common.SideEffects re-fetches fields/entities after a change so computed values (e.g. criticality, totals) refresh in the UI." },
  { title: "Draft Handling in Fiori Elements", url: CAP_FIORI,
    keywords: ["draft", "edit", "create", "object page", "odata.draft.enabled", "sticky", "draft mode"],
    summary: "Editable Object Pages need @odata.draft.enabled (or sticky sessions). Without drafts an Object Page is display-only." },
  { title: "Building Apps with SAP Fiori Tools", url: FIORI_TOOLS,
    keywords: ["fiori tools", "application generator", "guided development", "page map", "service modeler", "annotation modeler", "vscode", "bas"],
    summary: "SAP Fiori tools: app generator, Page Map, Guided Development, and annotation/service modelers in VS Code / SAP BAS." },
  { title: "UI5 Programming Model (MVC, binding)", url: UI5_DOCS,
    keywords: ["ui5", "mvc", "controller", "view", "xml view", "data binding", "model", "fragment", "component"],
    summary: "UI5 MVC: XML views + controllers, JSON/OData models, two-way binding for editable fields, async routing via the Component router." },
  { title: "OPA5 Integration Testing", url: "https://ui5.sap.com/#/topic/2696ab50faad458f9b4027ec2f9b884d",
    keywords: ["opa5", "integration test", "journey", "page object", "waitfor", "opatest", "int-test", "matchers", "actions"],
    summary: "OPA5 drives the running app via Page Objects (arrangements/actions/assertions) and waitFor matchers; structure tests as journeys." },
  { title: "QUnit Unit Testing", url: "https://ui5.sap.com/#/topic/09d145cd86ee4f8e9d08715f1b364c51",
    keywords: ["qunit", "unit test", "formatter", "controller test", "module", "assert", "unit-test", "sinon", "stub"],
    summary: "QUnit unit tests for formatters/controllers; isolate with sinon stubs/mocks. Run via the unit-test page." }
];

export default {
  name: "fiori_search_docs",
  description:
    "Search SAP Fiori documentation by keyword — Fiori elements floorplans, UI annotations, value helps, criticality, actions, side effects, drafts, UI5, OPA5/QUnit, and SAP Fiori tools — returning relevant topics with canonical URLs and a one-line summary each. (Replicates the Fiori MCP server's search_docs as an offline-robust curated index — no external MCP dependency.)",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What you want to learn (e.g. 'list report columns', 'value help', 'object page facets', 'opa5 journey', 'criticality status')." },
      limit: { type: "number", default: 5, description: "Max topics to return." }
    },
    required: ["query"]
  },
  async handler({ query, limit = 5 } = {}) {
    if (!query) return errText("query is required");
    const terms = query.toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);

    const ranked = DOCS.map((d) => {
      const hay = (d.title + " " + d.keywords.join(" ") + " " + d.summary).toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (d.keywords.some((k) => k === t)) score += 5;
        else if (hay.includes(t)) score += 2;
      }
      return { d, score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

    const results = (ranked.length ? ranked : DOCS.map((d) => ({ d, score: 0 })))
      .slice(0, limit)
      .map(({ d }) => ({ title: d.title, url: d.url, summary: d.summary }));

    return okText(JSON.stringify({
      query,
      matched: ranked.length,
      note: ranked.length === 0 ? "No keyword match — showing general Fiori topics. See https://ui5.sap.com/ and the fiori-annotations skill." : undefined,
      results
    }, null, 2));
  }
};
