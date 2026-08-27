*Part of the fiori-bootstrap skill.*

# Analytical List Page (ALP)

> For the OData **V2** generic-template ALP (`sap.suite.ui.generic.template`), see [`bootstrap-alp-v2.md`](bootstrap-alp-v2.md).

The Analytical List Page is a List Report variant that puts a **chart and a table side-by-side (or stacked)** above a shared, content-aware filter bar, with drill-down from the visual to the rows. Use it for "explore-then-act" scenarios where users slice aggregated KPIs before drilling to detail. It is `sap.fe.templates.AnalyticalListPage`.

## When ALP vs plain List Report

| Use ALP when… | Use List Report when… |
|---|---|
| Users analyse aggregates (sums/counts by dimension) before acting | Users find/edit individual records |
| A chart adds insight (trends, distribution, contribution) | A flat table is enough |
| KPIs/visual filters help narrow a large set | The filter bar alone suffices |
| You have a meaningful `UI.Chart` + measures to aggregate | You have no analytical measures |

If there is no chart and no aggregation, do not use ALP — it adds cost with no benefit.

## Manifest — convert the List target to ALP

Start from the LROP manifest (`list-report-op.md`) and change ONLY the List target's `name`. The Object Page target is unchanged.

```jsonc
"targets": {
  "POList": {
    "type": "Component",
    "id": "POList",
    "name": "sap.fe.templates.AnalyticalListPage",
    "options": {
      "settings": {
        "contextPath": "/PurchaseOrders",
        "variantManagement": "Page",
        "initialLoad": "Enabled",
        "defaultTemplateAnnotationPath": "com.sap.vocabularies.UI.v1.SelectionPresentationVariant#alp",
        "controlConfiguration": {
          "@com.sap.vocabularies.UI.v1.PresentationVariant": {
            "tableSettings": { "type": "ResponsiveTable", "selectionMode": "Multi" }
          }
        },
        "navigation": {
          "PurchaseOrders": { "detail": { "route": "PODetail" } }
        }
      }
    }
  },
  "PODetail": {
    "type": "Component",
    "id": "PODetail",
    "name": "sap.fe.templates.ObjectPage",
    "options": { "settings": { "contextPath": "/PurchaseOrders", "editableHeaderContent": false } }
  }
}
```

- **`defaultTemplateAnnotationPath`** points the ALP at the `SelectionPresentationVariant` qualifier (here `#alp`) that ties together the selection (filters) and the presentation (chart + table). If you only have a `PresentationVariant`, point at that instead.
- Libraries are the same as LROP, plus the charting library: add **`sap.viz`** and **`sap.chart`** to `dependencies.libs`.

```jsonc
"libs": {
  "sap.ui.core": {}, "sap.m": {}, "sap.fe.core": {}, "sap.fe.templates": {},
  "sap.fe.macros": {}, "sap.uxap": {}, "sap.ui.layout": {},
  "sap.chart": {}, "sap.viz": {}
}
```

## Annotation prerequisites (the ALP will not render without these)

ALP needs, at minimum, a `UI.Chart`, a `UI.PresentationVariant` that lists both the chart and the table, and (recommended) a `UI.SelectionPresentationVariant` so the filter defaults travel with the presentation. Define these in `srv/annotations.cds` (see the `fiori-elements` skill, `references/alp-charts.md`).

```cds
annotate PurchaseOrderService.PurchaseOrders with @(

  // KPI behind the measure (gives the chart a colour-coded data point)
  UI.DataPoint #amount: {
    $Type: 'UI.DataPointType', Value: TotalAmount, Title: 'Total Amount'
  },

  // The chart itself
  UI.Chart #alp: {
    $Type            : 'UI.ChartDefinitionType',
    ChartType        : #Column,
    Dimensions       : [ POStatus ],
    Measures         : [ TotalAmount ],
    MeasureAttributes: [{
      $Type    : 'UI.ChartMeasureAttributeType',
      Measure  : TotalAmount,
      Role     : #Axis1,
      DataPoint: '@UI.DataPoint#amount'
    }]
  },

  // Presentation = chart + the existing LineItem table, default sort
  UI.PresentationVariant #alp: {
    $Type         : 'UI.PresentationVariantType',
    Visualizations: [ '@UI.Chart#alp', '@UI.LineItem' ],
    SortOrder     : [{ Property: TotalAmount, Descending: true }]
  },

  // Ties selection (filters) + presentation together → referenced by the manifest
  UI.SelectionPresentationVariant #alp: {
    $Type              : 'UI.SelectionPresentationVariantType',
    SelectionVariant   : { $Type: 'UI.SelectionVariantType', SelectOptions: [] },
    PresentationVariant: '@UI.PresentationVariant#alp'
  }
);
```

You still need `UI.SelectionFields` (filter bar) and `UI.LineItem` (the table) from the List Report annotations — the ALP reuses them.

## Backend aggregation

ALP charts aggregate server-side. On CAP, expose the entity with `@Aggregation.ApplySupported` / `@Analytics` capabilities (CAP adds default aggregation support for OData V4 analytical queries). Ensure measures are numeric and dimensions are groupable; keep `operationMode: "Server"`.

## Checklist

Target template is `sap.fe.templates.AnalyticalListPage` · `defaultTemplateAnnotationPath` points at the SPV/PV qualifier · `sap.chart` + `sap.viz` libs added · `UI.Chart` + `UI.PresentationVariant` (+ `SelectionPresentationVariant`) present · measures aggregate server-side · `SelectionFields` + `LineItem` reused · `contextPath` not `entitySet`.
