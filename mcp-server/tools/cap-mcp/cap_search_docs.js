// Replicated from https://github.com/cap-js/mcp-server (Apache-2.0)
// Upstream tool: "search_docs" — semantic search over CAP documentation.
// Self-contained replication: a curated keyword index of capire (cap.cloud.sap)
// topics. Offline-robust, no embeddings model and no external MCP dependency.
import { okText, errText } from "../_util.js";

// Curated capire topic index — { title, url, keywords, summary }.
const DOCS = [
  { title: "Domain Modeling (CDS entities & types)", url: "https://cap.cloud.sap/docs/guides/domain-modeling",
    keywords: ["model", "entity", "type", "aspect", "managed", "cuid", "key", "schema", "cds", "domain", "association", "composition"],
    summary: "Define entities/types in db/schema.cds. Reuse @sap/cds/common; use `managed`/`cuid` aspects; model relations with Association/Composition." },
  { title: "Providing Services (service.cds + handlers)", url: "https://cap.cloud.sap/docs/guides/providing-services",
    keywords: ["service", "provide", "expose", "projection", "handler", "srv", "applicationservice", "before", "after", "on", "crud"],
    summary: "Expose entities as OData V4 services via projections in srv/service.cds; add custom logic in before/after/on handlers." },
  { title: "Consuming Services (remote/external OData)", url: "https://cap.cloud.sap/docs/guides/using-services",
    keywords: ["consume", "remote", "external", "import", "edmx", "csn", "cds import", "destination", "mock remote"],
    summary: "Import an external service's EDMX, model it as a remote service, and call it with cds.connect.to + queries." },
  { title: "Events & Messaging", url: "https://cap.cloud.sap/docs/guides/messaging/",
    keywords: ["event", "emit", "messaging", "queue", "subscribe", "broker", "outbox", "pub/sub", "async"],
    summary: "Emit and subscribe to events; use the messaging service and transactional outbox for reliable async integration." },
  { title: "Authorization (@requires / @restrict)", url: "https://cap.cloud.sap/docs/guides/security/authorization",
    keywords: ["auth", "authorization", "requires", "restrict", "role", "grant", "where", "xsuaa", "secure", "privilege", "scope"],
    summary: "Every service needs @requires; every writable entity needs @restrict with grant/to/where. Instance-based filters via where." },
  { title: "Authentication & XSUAA", url: "https://cap.cloud.sap/docs/node.js/authentication",
    keywords: ["authentication", "auth", "xsuaa", "ias", "jwt", "mocked", "dummy", "user", "login", "development auth"],
    summary: "Configure cds.requires.auth: mocked/dummy in dev with users; xsuaa/ias in production. Roles map to scopes." },
  { title: "Fiori Drafts (@odata.draft.enabled)", url: "https://cap.cloud.sap/docs/advanced/fiori#draft-support",
    keywords: ["draft", "fiori", "odata.draft.enabled", "edit", "create", "object page", "sticky", "draftadministrativedata"],
    summary: "Enable @odata.draft.enabled on the service-level entity for Fiori Elements create/edit. Draft is required for editable Object Pages." },
  { title: "Serving Fiori UIs from CAP", url: "https://cap.cloud.sap/docs/advanced/fiori",
    keywords: ["fiori", "ui", "app", "annotations", "value help", "side effects", "cds-plugin-ui5", "ui annotations"],
    summary: "Add UI annotations in annotations.cds; serve apps under app/. Value helps via @Common.ValueList; side effects via @Common.SideEffects." },
  { title: "Computed & Virtual Fields", url: "https://cap.cloud.sap/docs/guides/providing-services#calculated-elements",
    keywords: ["computed", "virtual", "calculated", "criticality", "derived", "default", "transient", "after read"],
    summary: "Calculated elements in CDS, or fill virtual fields in an after-READ handler (e.g. status criticality 0/1/2/3)." },
  { title: "Localized Data (i18n / texts)", url: "https://cap.cloud.sap/docs/guides/localized-data",
    keywords: ["localized", "i18n", "texts", "translation", "language", "locale", "labels"],
    summary: "Mark elements `localized`; CAP manages a .texts entity and serves the best language automatically." },
  { title: "Temporal Data", url: "https://cap.cloud.sap/docs/guides/temporal-data",
    keywords: ["temporal", "validfrom", "validto", "time slice", "history", "as of"],
    summary: "Model time-dependent data with @cds.valid.from/to; CAP applies as-of-now filtering automatically." },
  { title: "Databases (SQLite / HANA)", url: "https://cap.cloud.sap/docs/guides/databases",
    keywords: ["database", "db", "sqlite", "hana", "deploy", "csv", "seed", "cds deploy", "in-memory", "persistence"],
    summary: "Dev = in-memory SQLite (@cap-js/sqlite ^2 with cds ^9); prod = HANA. Seed with CSV in db/data/; cds deploy initializes." },
  { title: "Actions & Functions (bound/unbound)", url: "https://cap.cloud.sap/docs/guides/providing-services#actions-functions",
    keywords: ["action", "function", "bound", "unbound", "operation", "side effect", "datafieldforaction", "transition"],
    summary: "Declare actions/functions in CDS; implement with srv.on('ActionName', ...). Surface in Fiori via UI.DataFieldForAction." },
  { title: "Testing (cds.test / Jest)", url: "https://cap.cloud.sap/docs/node.js/cds-test",
    keywords: ["test", "jest", "cds.test", "unit", "integration", "supertest", "expect", "coverage", "axios"],
    summary: "Use cds.test(project) to spin up the service in-process; assert via GET/POST. Pair with Jest; raise testTimeout for cold starts." },
  { title: "Deployment (MTA / Cloud Foundry / Kyma)", url: "https://cap.cloud.sap/docs/guides/deployment/",
    keywords: ["deploy", "mta", "cloud foundry", "cf", "kyma", "approuter", "mtar", "build", "production"],
    summary: "Build an MTA (mta.yaml) with approuter + srv + db modules; deploy to CF or Kyma. Bind XSUAA/HANA service instances." },
  { title: "Multitenancy", url: "https://cap.cloud.sap/docs/guides/multitenancy/",
    keywords: ["multitenancy", "mtx", "tenant", "saas", "subscription", "extensibility"],
    summary: "Add @sap/cds-mtxs for tenant onboarding, per-tenant schema isolation, and extensibility." },
  { title: "Generic Features (audit, ETags, search)", url: "https://cap.cloud.sap/docs/guides/providing-services#generic-features",
    keywords: ["etag", "concurrency", "managed", "audit", "createdat", "modifiedat", "search", "@cds.search", "optimistic lock"],
    summary: "Use `managed` for audit columns, @odata.etag for optimistic concurrency (412 on conflict), @cds.search for free-text search." }
];

export default {
  name: "cap_search_docs",
  description:
    "Search CAP (capire) documentation by keyword and return the most relevant topics with canonical cap.cloud.sap URLs and a one-line summary each. Use to find authoritative CAP guidance on modeling, services, auth, drafts, testing, deployment, etc. (Replicates the CAP MCP server's search_docs as an offline-robust curated index — no external MCP dependency.)",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What you want to learn (e.g. 'how to add authorization', 'draft enabled', 'cds test', 'deploy to cloud foundry')." },
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
      note: ranked.length === 0 ? "No keyword match — showing general CAP topics. See https://cap.cloud.sap/docs/ for the full documentation." : undefined,
      results
    }, null, 2));
  }
};
