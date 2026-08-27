// MDK documentation search tool — offline-robust curated index of MDK component
// schemas, action types, binding syntax, offline patterns, and best practices.
// Mirrors the pattern of fiori_search_docs.js.
import { okText, errText } from "../_util.js";

const MDK_DOCS = [
  {
    title: "MDK Page Types — SectionedTable, ObjectTable, ObjectHeader, FormCell, KeyValue",
    keywords: ["page", "section", "sectionedtable", "objecttable", "objectheader", "formcell", "keyvalue", "list", "detail", "create", "edit"],
    summary: "MDK pages use SectionedTable as root. List pages: Section.Type.ObjectTable with Search. Detail: Section.Type.ObjectHeader + Section.Type.KeyValue. Create/Edit: Section.Type.FormCell with FormCell controls.",
    url: "https://help.sap.com/docs/MDK/977416d43cd74bdc958289038749100e/65d2a27ab7e448429e04b9c57cf5a61a.html"
  },
  {
    title: "MDK FormCell Controls — SimpleProperty, Switch, DatePicker, ListPicker, Note",
    keywords: ["formcell", "simpleproperty", "switch", "datepicker", "listpicker", "note", "input", "form", "control", "edm", "editable"],
    summary: "Edm.String→SimpleProperty, Edm.Boolean→Switch, Edm.DateTime→DatePicker, enum→ListPicker, multi-line→Note. Set IsRequired:true, pair with CheckRequiredFields action. Primary keys must not be editable.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK OData Action Types — CreateEntity, UpdateEntity, DeleteEntity, ChangeSet",
    keywords: ["odata", "createentity", "updateentity", "deleteentity", "changeset", "action", "create", "update", "delete", "batch"],
    summary: "Action.Type.ODataService.CreateEntity/UpdateEntity/DeleteEntity. Always set ActionResult._Name, OnSuccess, OnFailure. Update/Delete: Target.ReadLink={@odata.readLink}. Properties binding: #Control:Name/#Value (SimpleProperty) or /#SelectedValue (ListPicker).",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Navigation Actions — Navigation, ModalPage, CloseModalPage",
    keywords: ["navigation", "navigate", "modal", "modalpage", "closemodalpage", "push", "back", "closepage"],
    summary: "Action.Type.Navigation with PageToOpen. Create/Edit pages: ModalPage:true + ModalPageFullscreen:true. Navigate back: ClosePage or CloseModalPage action. Always confirm delete with Message action first.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Offline OData — InitializeOfflineOData, DownloadOfflineOData, UploadOfflineOData",
    keywords: ["offline", "offlineodata", "initialize", "download", "upload", "sync", "definingrequests", "local", "sqlite", "field worker"],
    summary: "Offline sync order: InitializeOfflineOData (app launch) → DownloadOfflineOData (on open) → UploadOfflineOData (before CRUD) → DownloadOfflineOData (after upload). DefiningRequests filter entity sets. ShowActivityIndicator:true on all sync actions.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Binding Syntax — OData, i18n, Rules, Control values",
    keywords: ["binding", "i18n", "rule", "odata", "readlink", "actionresult", "control", "selectedvalue", "format", "expression"],
    summary: "{PropertyName} OData binding. {i18n>Key} localization. {#Control:Name/#Value} form control value. {#Control:Name/#SelectedValue} ListPicker. {@odata.readLink} for Update/Delete. {{#ActionResults:name/#Property:error}} for OnFailure messages.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Rules — clientAPI, getPageProxy, evaluateTargetPath, UpdateLinks",
    keywords: ["rule", "javascript", "clientapi", "getpageproxy", "evaluatetargetpath", "updatelinks", "createlinkspecifierproxy", "visibility", "statuscolor", "listpicker"],
    summary: "Rules are ES6 modules: export default function Name(clientAPI){}. Return a value or Promise. Use clientAPI.read() for OData, clientAPI.count() for counts, clientAPI.binding for entity data. ListPicker returns [{ReturnValue,DisplayValue}]. UpdateLinks uses createLinkSpecifierProxy.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK i18n — Internationalization, key naming, hardcoded strings",
    keywords: ["i18n", "internationalization", "label", "caption", "hardcoded", "key", "naming", "translation", "localization"],
    summary: "All user-visible strings must use {i18n>Key}. Key naming: EntityName_PropertyName_Label, PageName_Caption, ActionName_Message. Never hardcode text in metadata JSON. Always read existing i18n.properties before adding keys to avoid duplicates.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Project Structure — Pages, Actions, Rules, Services, i18n",
    keywords: ["project", "structure", "pages", "actions", "rules", "services", "i18n", "service.metadata", "project.json", "folder"],
    summary: "Pages:/AppName/Pages/Entity/. Actions:/AppName/Actions/Entity/. Rules:/AppName/Rules/Entity/. Service:/AppName/Services/Name.service. _Name must match filename without extension. Never modify .project.json, .service.metadata, or Services/*.xml.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Deploy — mdkcli validate, build, deploy, Mobile Services, QR code",
    keywords: ["deploy", "validate", "build", "mobile services", "qr code", "cf", "cloud foundry", "mdkcli", "mdk-tools"],
    summary: "Pipeline: npx @sap/mdk-tools validate → build --target zip → deploy --target mobile --showqr. Requires CF login (cf login --sso) and .service.metadata. QR code at .build/qrcode.png. For CAP projects, MDK is at app/<name>_mdk/.",
    url: "https://help.sap.com/docs/MDK"
  },
  {
    title: "MDK Schema Migration — versions 24.7 to 26.6",
    keywords: ["migration", "schema", "version", "upgrade", "26.6", "26.3", "25.9", "25.6", "24.11", "24.7", "breaking", "deprecated"],
    summary: "Migration path: 24.7→24.11→25.6→25.9→26.3→26.6. Run npx @sap/mdk-tools migrate then validate. New in 26.6: FormCell.AIFeedback, FormCell.Stepper, FilterBar. New in 25.6: DataTable.Grouping, ListPicker.Search. Never skip versions.",
    url: "https://help.sap.com/docs/MDK/977416d43cd74bdc958289038749100e"
  },
  {
    title: "MDK Best Practices — conventions, anti-patterns, code review checklist",
    keywords: ["best practices", "conventions", "anti-patterns", "review", "checklist", "performance", "security", "quality"],
    summary: "Always: DataSubscriptions on detail pages, Search on list pages, OnSuccess/OnFailure on OData actions, ModalPage for create/edit. Never: hardcode strings, guess property names, modify .project.json. Use $top on QueryOptions for pagination.",
    url: "https://help.sap.com/docs/MDK"
  }
];

export default {
  name: "mdk_get_docs",
  description:
    "Search SAP MDK (Mobile Development Kit) documentation by keyword — page types, FormCell controls, OData actions, binding syntax, offline OData, rules (clientAPI), i18n, project structure, deployment, schema migration, and best practices. Returns relevant topics with canonical URLs and summaries.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What you want to learn (e.g. 'offline sync', 'FormCell types', 'binding syntax', 'deploy QR code', 'UpdateLinks rule')." },
      limit: { type: "number", default: 5, description: "Max topics to return." }
    },
    required: ["query"]
  },
  async handler({ query, limit = 5 } = {}) {
    if (!query) return errText("query is required");
    const terms = query.toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);

    const ranked = MDK_DOCS.map((d) => {
      const hay = (d.title + " " + d.keywords.join(" ") + " " + d.summary).toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (d.keywords.some((k) => k === t)) score += 5;
        else if (hay.includes(t)) score += 2;
      }
      return { d, score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

    const results = (ranked.length ? ranked : MDK_DOCS.map((d) => ({ d, score: 0 })))
      .slice(0, limit)
      .map(({ d }) => ({ title: d.title, url: d.url, summary: d.summary }));

    return okText(JSON.stringify({
      query,
      matched: ranked.length,
      note: ranked.length === 0 ? "No keyword match — showing general MDK topics. See https://help.sap.com/docs/MDK." : undefined,
      results
    }, null, 2));
  }
};
