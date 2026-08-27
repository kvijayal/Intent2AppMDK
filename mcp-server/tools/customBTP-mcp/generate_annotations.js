import { writeText } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

// Normalise the value-help inputs. enumFields → fixed-value dropdowns; valueHelps → collection-based
// (Common.ValueList) F4 help. The statusField is auto-treated as a fixed-value enum so the status
// filter always has a populated dropdown (the #1 cause of empty filter bars).
function collectValueHelps({ enumFields, valueHelps, statusField, selectionFields }) {
  const enums = new Set((enumFields || []).filter(Boolean));
  // A status field used as a filter must have a dropdown — default it to a fixed-value enum.
  if (statusField && (selectionFields || []).includes(statusField)) enums.add(statusField);
  const refs = (valueHelps || []).map((v) => ({
    field: v.field,
    localProperty: v.localProperty || v.field,
    collectionPath: v.collectionPath,
    keyProp: v.keyProp || "ID",
    textProp: v.textProp || null,
    displayOnly: v.displayOnly || []
  })).filter((v) => v.field && v.collectionPath);
  return { enums: [...enums], refs };
}

function cdsAnnotations(args) {
  const { service, entity, titleField, descriptionField, columns, selectionFields, statusField, criticalityField } = args;
  const { enums, refs } = collectValueHelps(args);
  const li = columns
    .map((c) =>
      c === statusField && criticalityField
        ? `        { $Type: 'UI.DataFieldForAnnotation', Target: '@UI.DataPoint#${statusField}', Label: '${c}', ![@UI.Importance]: #High }`
        : `        { $Type: 'UI.DataField', Value: ${c} }`
    )
    .join(",\n");
  const sf = (selectionFields || []).map((f) => `        ${f}`).join(",\n");
  const dataPoint =
    statusField && criticalityField
      ? `    UI.DataPoint #${statusField}: { $Type: 'UI.DataPointType', Value: ${statusField}, Criticality: ${criticalityField}, CriticalityRepresentation: #WithIcon },\n`
      : "";

  // Field-level value-help annotations (the bit that was missing → empty dropdowns).
  const fieldLines = [];
  for (const f of enums) fieldLines.push(`    ${f} @( Common.ValueListWithFixedValues: true );`);
  for (const v of refs) {
    const params = [
      `            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: ${v.localProperty}, ValueListProperty: '${v.keyProp}' }`,
      ...(v.textProp ? [`            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: '${v.textProp}' }`] : []),
      ...v.displayOnly.map((d) => `            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: '${d}' }`)
    ].join(",\n");
    const text = v.textProp ? `\n    ${v.field} @( Common.Text: ${v.field}.${v.textProp}, Common.TextArrangement: #TextFirst );` : "";
    fieldLines.push(
      `    ${v.field} @( Common.ValueList: {\n` +
      `        $Type         : 'Common.ValueListType',\n` +
      `        CollectionPath: '${v.collectionPath}',\n` +
      `        Label         : '${v.field}',\n` +
      `        Parameters    : [\n${params}\n        ]\n    } );${text}`
    );
  }
  const fieldBlock = fieldLines.length
    ? `\nannotate ${service}.${entity} with {\n${fieldLines.join("\n")}\n};\n`
    : "";

  return `using { ${service} } from './service';

annotate ${service}.${entity} with @(
${dataPoint}    UI.HeaderInfo: {
        TypeName      : '${entity}',
        TypeNamePlural: '${entity}s',
        Title         : { Value: ${titleField || columns[0]} }${descriptionField ? `,\n        Description   : { Value: ${descriptionField} }` : ""}
    },
    UI.SelectionFields: [
${sf || "        " + columns[0]}
    ],
    UI.LineItem: [
${li}
    ]
);
${fieldBlock}`;
}

function xmlAnnotations(args) {
  const { service, entity, columns, statusField, criticalityField } = args;
  const { enums, refs } = collectValueHelps(args);
  const cols = columns
    .map((c) =>
      c === statusField && criticalityField
        ? `            <Record Type="UI.DataFieldForAnnotation"><PropertyValue Property="Target" AnnotationPath="@UI.DataPoint#${statusField}"/></Record>`
        : `            <Record Type="UI.DataField"><PropertyValue Property="Value" Path="${c}"/></Record>`
    )
    .join("\n");
  const dp =
    statusField && criticalityField
      ? `        <Annotation Term="UI.DataPoint" Qualifier="${statusField}">
          <Record>
            <PropertyValue Property="Value" Path="${statusField}"/>
            <PropertyValue Property="Criticality" Path="${criticalityField}"/>
            <PropertyValue Property="CriticalityRepresentation" EnumMember="UI.CriticalityRepresentationType/WithIcon"/>
          </Record>
        </Annotation>\n`
      : "";

  // Field-level value-help annotations (sibling <Annotations> targets).
  let vh = "";
  for (const f of enums) {
    vh += `      <Annotations Target="${service}.${entity}/${f}">
        <Annotation Term="Common.ValueListWithFixedValues" Bool="true"/>
      </Annotations>\n`;
  }
  for (const v of refs) {
    const params = [
      `              <Record Type="Common.ValueListParameterInOut"><PropertyValue Property="LocalDataProperty" PropertyPath="${v.localProperty}"/><PropertyValue Property="ValueListProperty" String="${v.keyProp}"/></Record>`,
      ...(v.textProp ? [`              <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="${v.textProp}"/></Record>`] : []),
      ...v.displayOnly.map((d) => `              <Record Type="Common.ValueListParameterDisplayOnly"><PropertyValue Property="ValueListProperty" String="${d}"/></Record>`)
    ].join("\n");
    vh += `      <Annotations Target="${service}.${entity}/${v.field}">
        <Annotation Term="Common.ValueList">
          <Record>
            <PropertyValue Property="CollectionPath" String="${v.collectionPath}"/>
            <PropertyValue Property="Parameters">
              <Collection>
${params}
              </Collection>
            </PropertyValue>
          </Record>
        </Annotation>${v.textProp ? `\n        <Annotation Term="Common.Text" Path="${v.field}/${v.textProp}"><Annotation Term="UI.TextArrangement" EnumMember="UI.TextArrangementType/TextFirst"/></Annotation>` : ""}
      </Annotations>\n`;
  }
  const needsCommon = enums.length || refs.length;

  return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml"><edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/></edmx:Reference>
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>
  <edmx:DataServices>
    <Schema Namespace="local" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Annotations Target="${service}.${entity}">
${dp}        <Annotation Term="UI.LineItem">
          <Collection>
${cols}
          </Collection>
        </Annotation>
      </Annotations>
${needsCommon ? vh : ""}    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
`;
}

export default {
  name: "generate_annotations",
  description:
    "Generate Fiori Elements UI annotations for a floorplan. target='cds' emits annotations.cds (CAP); target='xml' emits a local annotation.xml (RAP/external). Emits value helps so filters/F4 are populated, not empty: enumFields → @Common.ValueListWithFixedValues; valueHelps → @Common.ValueList (CollectionPath + InOut/DisplayOnly params, optional Common.Text). The status field, if a filter, is auto-given a fixed-value dropdown. Status columns use the SAP standard criticality enum (0 Neutral, 1 Negative, 2 Critical, 3 Positive) with CriticalityRepresentation #WithIcon.",
  inputSchema: {
    type: "object",
    properties: {
      target: { type: "string", enum: ["cds", "xml"], default: "cds" },
      floorplan: { type: "string", enum: ["list-report", "object-page", "alp", "fpm"], default: "list-report" },
      service: { type: "string", description: "Service name (cds, e.g. PurchaseOrderService) or OData service target (xml)." },
      entity: { type: "string" },
      columns: { type: "array", items: { type: "string" } },
      selectionFields: { type: "array", items: { type: "string" } },
      titleField: { type: "string" },
      descriptionField: { type: "string" },
      statusField: { type: "string", description: "Field rendered with semantic colour (auto-given a fixed-value dropdown if used as a filter)." },
      criticalityField: { type: "string", description: "Integer field/source driving the status criticality." },
      enumFields: { type: "array", items: { type: "string" }, description: "Fields whose values are a fixed code list → @Common.ValueListWithFixedValues (inline dropdown)." },
      valueHelps: {
        type: "array",
        description: "Collection-based F4 value helps. Each: field, collectionPath (the value-list entity set), keyProp (default ID), textProp (shown + Common.Text), localProperty (default = field, e.g. assoc_ID), displayOnly[].",
        items: {
          type: "object",
          properties: {
            field: { type: "string" }, collectionPath: { type: "string" },
            keyProp: { type: "string" }, textProp: { type: "string" },
            localProperty: { type: "string" }, displayOnly: { type: "array", items: { type: "string" } }
          },
          required: ["field", "collectionPath"]
        }
      },
      outPath: { type: "string", description: "If given, write the result to this file instead of returning it inline." }
    },
    required: ["service", "entity", "columns"]
  },
  async handler(args) {
    const { target = "cds", outPath } = args;
    if (!args.columns?.length) return errText("Provide at least one column.");
    const content = target === "xml" ? xmlAnnotations(args) : cdsAnnotations(args);
    // Warn about filter fields with no value-help source (→ empty dropdown).
    const { enums, refs } = collectValueHelps(args);
    const backed = new Set([...enums, ...refs.map((r) => r.field)]);
    const unbacked = (args.selectionFields || []).filter((f) => !backed.has(f) && f !== args.statusField);
    const warn = unbacked.length
      ? `\n\n⚠ Filter field(s) with no value-help source: ${unbacked.join(", ")}. ` +
        `If any is a code/category/reference field, add it to enumFields (fixed list) or valueHelps (value-list entity) ` +
        `so its dropdown is populated; date/number fields are fine as range filters.`
      : "";
    if (outPath) {
      await writeText(outPath, content);
      return okText(`Wrote ${target} annotations to ${outPath}:\n\n${content}${warn}`);
    }
    return okText(content + warn);
  }
};
