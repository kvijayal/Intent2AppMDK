import path from "node:path";
import { exists, appendText } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

export default {
  name: "add_cds_entity",
  description:
    "Append a CDS entity to db/schema.cds following CAP conventions: PascalCase entity, camelCase fields, optional managed aspect and @odata.etag. Flags naming violations and reminds you to expose it in srv and add @requires/@restrict.",
  inputSchema: {
    type: "object",
    properties: {
      appDir: { type: "string" },
      entity: { type: "string", description: "PascalCase entity name." },
      keyField: {
        type: "object",
        properties: { name: { type: "string" }, type: { type: "string" } },
        description: "e.g. {name:'ID', type:'UUID'}."
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, type: { type: "string" }, mandatory: { type: "boolean" } }
        }
      },
      managed: { type: "boolean", default: true },
      etag: { type: "boolean", default: false, description: "Add @odata.etag to a modifiedAt/updatedAt field." },
      schemaPath: { type: "string", description: "Override path to schema.cds." }
    },
    required: ["appDir", "entity", "fields"]
  },
  async handler({ appDir, entity, keyField, fields = [], managed = true, etag = false, schemaPath }) {
    if (!/^[A-Z][A-Za-z0-9]+$/.test(entity)) return errText(`Entity must be PascalCase: "${entity}".`);
    const sp = schemaPath || path.join(appDir, "db", "schema.cds");
    if (!(await exists(sp))) return errText(`schema.cds not found at ${sp}.`);

    const lines = [`\nentity ${entity}${managed ? " : managed" : ""} {`];
    if (keyField?.name) lines.push(`    key ${keyField.name} : ${keyField.type || "UUID"};`);
    for (const f of fields) {
      let line = `    ${f.name} : ${f.type}`;
      if (f.mandatory) line += " @mandatory";
      if (etag && /modifiedat|updatedat/i.test(f.name)) line += " @odata.etag";
      line += ";";
      if (!/^[a-z][A-Za-z0-9]*$/.test(f.name)) line += "  // WARN: field should be camelCase";
      lines.push(line);
    }
    lines.push("}");
    const block = lines.join("\n") + "\n";
    await appendText(sp, block);

    return okText(
      `Appended to ${sp}:\n${block}\n` +
        `Now: 1) expose via projection in srv/*.cds, 2) add @requires on the service and @restrict on this entity, 3) run cds build.`
    );
  }
};
