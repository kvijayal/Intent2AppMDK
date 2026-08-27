*Part of the fiori-elements skill.*

# Local vs backend annotations (RAP / external services)

When the OData service is owned elsewhere (RAP / ABAP Cloud, S/4HANA, or any deployed service), UI annotations can live in two places. Choosing correctly is a **Clean Core** decision — document it in the Technical Design Document.

| | Backend CDS metadata extension | Local `annotation.xml` (in the UI app) |
|---|---|---|
| Where | ABAP CDS metadata-extension on the released service | `webapp/annotations/annotation.xml` in the Fiori app |
| Owner | the backend/core (governed) | the app team |
| Scope | shared by **all** consumers of the service | this **one** app only |
| Clean Core | preferred — the released, reusable contract | acceptable for app-specific UI only |
| Use for | semantically correct UI metadata that belongs to the data model | layout tweaks, app-only labels/groupings, presentation a single app needs |

> For a **CAP** backend you own, neither applies — put annotations in `srv/annotations.cds` (server-driven, reusable). This page is for services you do **not** own.

## Decision rule

1. Does the annotation describe what the data *means* and would benefit every consumer (e.g. a field's semantic status, a value help that's intrinsic to the field)? → **backend CDS metadata extension** (the Clean Core, released contract).
2. Is it purely how *this* app lays things out (column order, a section grouping, an app-specific label, a presentation variant)? → **local `annotation.xml`**.
3. **Never modify the released core service in place** to satisfy one app's layout. If a backend change is genuinely warranted, it is a metadata extension on the released interface, recorded in the TDD as a backend change — not an in-stack modification.

## Backend: CDS metadata extension (Clean Core)

A metadata extension annotates a released CDS view without modifying it (ABAP, applied in the backend system):

```abap
@Metadata.layer: #CUSTOMER
annotate view ZC_PurchaseOrder with
{
  @UI.lineItem: [{ position: 10, importance: #HIGH }]
  @UI.identification: [{ position: 10 }]
  PurchaseOrder;

  @UI.lineItem: [{ position: 20 }]
  @UI.dataPoint: { criticality: 'OverallStatusCriticality',
                   criticalityRepresentation: #WITH_ICON }
  OverallStatus;
}
```

This travels with the service, so every app (and the SAP Fiori elements runtime) sees the same metadata. The same 0–3 criticality enum applies (0 Neutral, 1 Negative, 2 Critical, 3 Positive).

## Local: annotation.xml in the UI app

App-specific OData V4 annotations as an EDMX `<Annotations>` document. Same vocabulary terms as CDS, just XML.

```xml
<edmx:Edmx Version="4.0"
  xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
  xmlns:Edm="http://docs.oasis-open.org/odata/ns/edm">
  <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
    <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
  </edmx:Reference>
  <edmx:DataServices>
    <Schema Namespace="local" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <Annotations Target="ZPO_SRV.PurchaseOrders">
        <Annotation Term="UI.LineItem">
          <Collection>
            <Record Type="UI.DataField">
              <PropertyValue Property="Value" Path="PONumber"/>
              <Annotation Term="UI.Importance" EnumMember="UI.ImportanceType/High"/>
            </Record>
            <Record Type="UI.DataField">
              <PropertyValue Property="Value" Path="Vendor"/>
            </Record>
          </Collection>
        </Annotation>
      </Annotations>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

### Register the local annotation file in manifest.json

Add it as an `ODataAnnotation` data source AND list it under the service's `settings.annotations`, so it merges on top of the backend metadata.

```jsonc
"dataSources": {
  "mainService": {
    "uri": "/sap/opu/odata4/sap/zpo/srvd/sap/zpo/0001/",
    "type": "OData",
    "settings": {
      "odataVersion": "4.0",
      "localUri": "localService/mainService/metadata.xml",
      "annotations": [ "localAnnotations" ]
    }
  },
  "localAnnotations": {
    "type": "ODataAnnotation",
    "uri": "annotations/annotation.xml",
    "settings": { "localUri": "annotations/annotation.xml" }
  }
}
```

## Merge order & precedence

Fiori Elements merges annotations in the order listed in `settings.annotations`, applied on top of the service's own metadata. A later source overrides an earlier one for the same target/term — so a local file can refine (but should not fight) the backend. Keep overrides minimal and intentional.

## Trade-offs

- **Backend extension:** reusable, governed, survives across apps; but needs a backend change/transport and broader sign-off. Best for semantically-correct metadata.
- **Local annotation.xml:** fast, app-scoped, no backend change; but duplicated if several apps need the same tweak and easy to drift from the model. Best for one app's presentation only.

## Checklist

Semantic/data-meaning annotations → backend CDS metadata extension (Clean Core, in the TDD) · app-only layout → local `annotation.xml` · never modify the core in place · local file registered as `ODataAnnotation` + listed in `settings.annotations` · EDMX saved via `localUri` · overrides minimal · criticality enum consistent (0–3, `#WithIcon`).
