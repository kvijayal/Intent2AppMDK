*Part of the fiori-elements skill.*

# Analytical List Page — charts & KPIs

The ALP floorplan needs analytical annotations on top of the List Report ones: a `UI.Chart`, a `UI.PresentationVariant` listing both chart and table, and (recommended) a `UI.SelectionPresentationVariant`. KPIs are expressed as `UI.DataPoint`s. Put these in `srv/annotations.cds`. For the manifest side (`sap.fe.templates.AnalyticalListPage`, `defaultTemplateAnnotationPath`, `sap.chart`/`sap.viz` libs) see `fiori-bootstrap/references/analytical-list-page.md`.

## UI.DataPoint — the KPI / measure backing

A `DataPoint` gives a measure a title and, optionally, a target/criticality so the chart and KPI header can colour-code it.

```cds
UI.DataPoint #amount: {
  $Type: 'UI.DataPointType',
  Value: TotalAmount,
  Title: 'Total Amount',
  // optional KPI thresholds → criticality calculation:
  // CriticalityCalculation: {
  //   ImprovementDirection: #Maximize,
  //   DeviationRangeLowValue: 1000, ToleranceRangeLowValue: 5000
  // }
}
```

## UI.Chart — the visualization

The chart declares its type, the dimensions (categorical axes / grouping) and measures (aggregated values), and links each measure to a `DataPoint` and an axis `Role`.

```cds
UI.Chart #alp: {
  $Type            : 'UI.ChartDefinitionType',
  Title            : 'Spend by Status',
  ChartType        : #Column,
  Dimensions       : [ POStatus ],
  Measures         : [ TotalAmount ],
  MeasureAttributes: [{
    $Type    : 'UI.ChartMeasureAttributeType',
    Measure  : TotalAmount,
    Role     : #Axis1,                 // measures → value axis
    DataPoint: '@UI.DataPoint#amount'  // colour/threshold for this measure
  }]
}
```

Two-dimension example (grouped/stacked):

```cds
UI.Chart #byVendor: {
  $Type     : 'UI.ChartDefinitionType',
  ChartType : #Column,
  Dimensions: [ Vendor, POStatus ],   // category + series
  Measures  : [ TotalAmount ],
  MeasureAttributes: [{ $Type: 'UI.ChartMeasureAttributeType',
    Measure: TotalAmount, Role: #Axis1, DataPoint: '@UI.DataPoint#amount' }]
}
```

### Common ChartType values

| `ChartType` | Use for |
|---|---|
| `#Column` / `#Bar` | compare a measure across a categorical dimension (vertical / horizontal) |
| `#Line` | trend of a measure over an ordered dimension (e.g. date) |
| `#Donut` / `#Pie` | contribution / share of a whole (one dimension) |
| `#StackedColumn` / `#StackedBar` | part-to-whole across categories (two dimensions) |
| `#Combination` | bars + line on shared axes (mixed measures) |
| `#Bubble` / `#Scatter` | relationship between two/three measures |

`Role` values: `#Category` / `#Category2` for dimensions; `#Axis1` / `#Axis2` / `#Axis3` for measures.

## UI.PresentationVariant — chart + table together

The ALP shows the chart and the table; the `PresentationVariant` lists both visualizations and the default sort. `@UI.LineItem` reuses the List Report table.

```cds
UI.PresentationVariant #alp: {
  $Type         : 'UI.PresentationVariantType',
  Visualizations: [ '@UI.Chart#alp', '@UI.LineItem' ],
  SortOrder     : [{ Property: TotalAmount, Descending: true }],
  GroupBy       : [ POStatus ]
}
```

## UI.SelectionPresentationVariant — selection + presentation

Bundles default filters (a `SelectionVariant`) with the presentation so the manifest can point at one annotation. Reference its qualifier from `defaultTemplateAnnotationPath`.

```cds
UI.SelectionPresentationVariant #alp: {
  $Type              : 'UI.SelectionPresentationVariantType',
  Text               : 'Spend Analysis',
  SelectionVariant   : {
    $Type        : 'UI.SelectionVariantType',
    SelectOptions: [{
      $Type        : 'UI.SelectOptionType',
      PropertyName : POStatus,
      Ranges       : [{ $Type: 'UI.SelectionRangeType', Sign: #I, Option: #EQ, Low: 'SUBMITTED' }]
    }]
  },
  PresentationVariant: '@UI.PresentationVariant#alp'
}
```

## KPI header (optional but typical for ALP)

ALP can show KPI tiles in the header via `UI.KPI` referencing a `DataPoint` + `SelectionVariant`. The `DataPoint`'s `CriticalityCalculation` (or a direct `Criticality`) colours the KPI using the same 0–3 enum (0 Neutral, 1 Negative/red, 2 Critical/orange, 3 Positive/green).

## Backend aggregation prerequisite

Charts aggregate server-side. On CAP, the OData V4 analytical query support handles `$apply`/aggregation for groupable dimensions and numeric measures — keep the model `operationMode: "Server"` and ensure measures are numeric. Do not aggregate client-side.

## Checklist

`UI.Chart` defines `ChartType` + `Dimensions` + `Measures` + `MeasureAttributes` (each measure → `DataPoint` + `Role`) · `PresentationVariant` lists `[@UI.Chart#…, @UI.LineItem]` with sort · `SelectionPresentationVariant` bundles filters + presentation (referenced by the manifest) · KPIs as `DataPoint` with criticality · `SelectionFields` + `LineItem` reused from the List Report.
