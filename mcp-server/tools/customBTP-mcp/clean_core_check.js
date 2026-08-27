import path from "node:path";
import { exists, readText, walk } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";

const item = (pass, name, detail) => ({ pass, name, detail });

export default {
  name: "clean_core_check",
  description:
    "Heuristic SAP Clean Core / best-practice scan of an app folder: OData V4 only, @requires/@restrict present on CAP services/entities, no console.log in source, no hardcoded URLs (use destinations). Returns a structured report; advisory, not a substitute for review.",
  inputSchema: {
    type: "object",
    properties: { appDir: { type: "string" } },
    required: ["appDir"]
  },
  async handler({ appDir }) {
    if (!(await exists(appDir))) return errText(`appDir not found: ${appDir}`);
    const files = await walk(appDir);
    const report = [];

    // OData V4 only (manifest data sources)
    let v4 = true;
    const manifest = files.find((f) => f.endsWith("manifest.json"));
    if (manifest) {
      try {
        const j = JSON.parse(await readText(manifest));
        const ds = j["sap.app"]?.dataSources || {};
        for (const k of Object.keys(ds)) {
          const ver = String(ds[k].settings?.odataVersion || "");
          if (ver.startsWith("2")) v4 = false;
        }
      } catch { /* ignore */ }
    }
    report.push(item(v4, "OData V4 only", v4 ? "OK" : "OData V2 data source found — migrate to V4."));

    // CAP authorization
    const cdsFiles = files.filter((f) => f.endsWith(".cds"));
    if (cdsFiles.length) {
      let cdsText = "";
      for (const f of cdsFiles) cdsText += (await readText(f)) + "\n";
      // Match both the shorthand (@requires) and the parenthesised form (@(requires: ...)).
      const hasReq = /(@requires|requires\s*:)/.test(cdsText);
      const hasRestrict = /(@restrict|restrict\s*:)/.test(cdsText);
      report.push(item(hasReq, "Service @requires present", hasReq ? "OK" : "No @requires on any CDS service — every service needs authentication."));
      report.push(item(hasRestrict, "Entity @restrict present", hasRestrict ? "OK" : "No @restrict found — add role-based grants to writable entities."));
    }

    // Value-help backing for filter fields (the #1 cause of empty dropdowns).
    // Every UI.SelectionFields field needs a fixed enum or a Common.ValueList, else its filter/F4 is empty.
    const annFiles = files.filter((f) => /\.cds$/.test(f) || /annotation.*\.xml$/i.test(f) || /\.xml$/.test(f));
    let annText = "";
    for (const f of annFiles) { try { annText += (await readText(f)) + "\n"; } catch { /* ignore */ } }
    const selFields = new Set();
    // CDS:  UI.SelectionFields: [ a, b, c ]
    let sm;
    const cdsSel = /UI\.SelectionFields\s*:\s*\[([\s\S]*?)\]/g;
    while ((sm = cdsSel.exec(annText))) sm[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((f) => selFields.add(f.replace(/['"]/g, "")));
    // XML:  <Annotation Term="UI.SelectionFields"><Collection><PropertyPath>X</PropertyPath>…
    const xmlSel = /Term="UI\.SelectionFields"[\s\S]*?<\/Annotation>/g;
    let xm;
    while ((xm = xmlSel.exec(annText))) {
      let pp; const ppRe = /<PropertyPath>([^<]+)<\/PropertyPath>/g;
      while ((pp = ppRe.exec(xm[0]))) selFields.add(pp[1].trim());
    }
    if (selFields.size) {
      const isBacked = (field) => {
        // field-level ValueList / fixed-values annotation (CDS or XML)
        if (new RegExp(`${field}\\s*@\\([^)]*ValueList`).test(annText)) return true;
        if (new RegExp(`Target="[^"]*/${field}"[\\s\\S]{0,200}?ValueList`).test(annText)) return true;
        if (new RegExp(`ValueListWithFixedValues[\\s\\S]{0,80}?${field}`).test(annText)) return true;
        // inline enum type:  field : SomeType enum { … }
        if (new RegExp(`\\b${field}\\s*:\\s*[\\w.]*\\s*enum\\b`).test(annText)) return true;
        // named enum:  field : T ;  …  type T : … enum { … }
        const tm = annText.match(new RegExp(`\\b${field}\\s*:\\s*([\\w.]+)`));
        if (tm && new RegExp(`type\\s+${tm[1].split(".").pop()}\\b[^{]*enum`).test(annText)) return true;
        return false;
      };
      // Only string/reference (dropdown) fields need a value help. Date/number/boolean fields are
      // range filters with no dropdown, so don't flag them (avoids false positives).
      const isRangeType = (field) => {
        const cdsT = annText.match(new RegExp(`\\b${field}\\s*:\\s*([\\w.]+)`));
        const xmlT = annText.match(new RegExp(`Name="${field}"\\s+Type="(Edm\\.[\\w]+)"`));
        const t = ((cdsT && cdsT[1]) || (xmlT && xmlT[1]) || "").toLowerCase();
        return /(date|time|decimal|double|single|float|integer|int|boolean|amount|quantity|uuid)/.test(t);
      };
      const unbacked = [...selFields].filter((f) => !isBacked(f) && !isRangeType(f));
      report.push(item(
        unbacked.length === 0,
        "Filter value-helps backed",
        unbacked.length
          ? `Filter field(s) with no value-help source (empty dropdown): ${unbacked.join(", ")}. Add a fixed enum (@Common.ValueListWithFixedValues) or a value-list entity (@Common.ValueList + seeded data), or confirm free-text.`
          : "OK"
      ));
    }

    // console.log in source (exclude tests)
    const src = files.filter((f) => /\.(js|ts)$/.test(f) && !/test|node_modules/.test(f));
    let consoleHits = 0, urlHits = 0;
    for (const f of src) {
      const t = await readText(f);
      if (/console\.log\s*\(/.test(t)) consoleHits++;
      if (/['"`]https?:\/\/[^'"`\s)]+/.test(t)) urlHits++;
    }
    report.push(item(consoleHits === 0, "No console.log in source", consoleHits ? `${consoleHits} file(s) use console.log — use cds.log() (CAP) or the UI5 Log module.` : "OK"));
    report.push(item(urlHits === 0, "No hardcoded URLs", urlHits ? `${urlHits} file(s) contain hardcoded URLs — use BTP destinations / env.` : "OK"));

    const pass = report.every((r) => r.pass);
    return jsonText({ appDir: path.resolve(appDir), cleanCore: pass ? "aligned" : "review needed", pass, checks: report });
  }
};
