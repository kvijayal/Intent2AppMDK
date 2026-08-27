*Part of the fiori-annotations skill.*

# Object Page annotations

The Object Page header and body sections are annotation-driven: `UI.HeaderInfo` (title block), `UI.HeaderFacets` (header KPIs/status), `UI.FieldGroup` (blocks of fields), `UI.Facets` with `ReferenceFacet` (the body sections), and `UI.Identification` (page actions). Real example: `Claude-Code/purchaseOrder/srv/annotations.cds`.

## UI.HeaderInfo — the title block

`Title` is the main heading; `Description` is the subtitle; `TypeName`/`TypeNamePlural` label the object kind (used in messages, share dialogs, breadcrumbs).

```cds
UI.HeaderInfo: {
  TypeName      : 'Purchase Order',
  TypeNamePlural: 'Purchase Orders',
  Title         : { $Type: 'UI.DataField', Value: PONumber },
  Description   : { $Type: 'UI.DataField', Value: Vendor }
}
```

## UI.HeaderFacets — compact header content (status, KPIs)

Each header facet is a `ReferenceFacet` targeting a `DataPoint` (or a small `FieldGroup`). This is where the semantic status badge belongs, so it shows colour + icon prominently at the top.

```cds
// Status DataPoint (shared with the LineItem in the List Report)
UI.DataPoint #POStatus: {
  $Type                    : 'UI.DataPointType',
  Value                    : POStatus,
  Criticality              : POStatusCriticality,
  CriticalityRepresentation: #WithIcon          // 0 Neutral,1 Negative,2 Critical,3 Positive
},
UI.HeaderFacets: [
  { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#POStatus', Label: 'Status' }
]
```

## UI.FieldGroup — labelled blocks of fields

A `FieldGroup` is a reusable set of `DataField`s. Define one per logical section; reference them from `UI.Facets`.

```cds
UI.FieldGroup #PODetails: {
  $Type: 'UI.FieldGroupType',
  Label: 'Purchase Order Details',
  Data : [
    { $Type: 'UI.DataField', Value: POID,        Label: 'PO ID' },
    { $Type: 'UI.DataField', Value: PONumber,    Label: 'PO Number' },
    { $Type: 'UI.DataField', Value: Vendor,      Label: 'Vendor' },
    { $Type: 'UI.DataField', Value: OrderDate,   Label: 'Order Date' },
    { $Type: 'UI.DataField', Value: DeliveryDate, Label: 'Delivery Date' },
    { $Type: 'UI.DataField', Value: Description, Label: 'Description' }
  ]
},
UI.FieldGroup #POFinancials: {
  $Type: 'UI.FieldGroupType',
  Label: 'Financials',
  Data : [
    { $Type: 'UI.DataField', Value: TotalAmount, Label: 'Total Amount' },  // currency via @Measures.ISOCurrency
    { $Type: 'UI.DataField', Value: Currency,    Label: 'Currency' }
  ]
}
```

## UI.Facets — the body sections

`UI.Facets` is the ordered list of Object Page sections. A `ReferenceFacet` renders a single `FieldGroup` (or a `DataPoint`/chart). Each facet's `ID` is an anchor — the in-page navigation uses it, and FPM custom sections position relative to it (`position.anchor`).

```cds
UI.Facets: [
  { $Type: 'UI.ReferenceFacet', ID: 'PODetailsFacet',    Label: 'PO Details',
    Target: '@UI.FieldGroup#PODetails' },
  { $Type: 'UI.ReferenceFacet', ID: 'POFinancialsFacet', Label: 'Financials',
    Target: '@UI.FieldGroup#POFinancials' }
]
```

### Collection facets (grouping sub-sections)

To group several reference facets under one section header, use a `CollectionFacet`:

```cds
{ $Type: 'UI.CollectionFacet', ID: 'OverviewFacet', Label: 'Overview',
  Facets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#PODetails',    Label: 'Details' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#POFinancials', Label: 'Financials' }
  ]
}
```

### A table as a section (related items)

To show child/related records as a section, point a `ReferenceFacet` at a navigation property's `LineItem`:

```cds
{ $Type: 'UI.ReferenceFacet', ID: 'ItemsFacet', Label: 'Items',
  Target: 'Items/@UI.LineItem' }
```

## UI.Identification — page-level actions

Actions in the Object Page header toolbar are `DataFieldForAction` entries in `UI.Identification`. Fiori Elements invokes the bound OData action through its edit flow — never call actions from controller code.

```cds
UI.Identification: [
  { $Type: 'UI.DataFieldForAction', Action: 'PurchaseOrderService.approve', Label: 'Approve' },
  { $Type: 'UI.DataFieldForAction', Action: 'PurchaseOrderService.reject',  Label: 'Reject' }
]
```

Criticality on an action (`![@UI.Criticality]: #Positive` / `#Negative`) colours the button. See `value-helps.md` for action details.

## When annotations aren't enough

For UI that annotations cannot express (e.g. an inverted `ObjectStatus` badge with a descriptive paragraph), add an FPM custom section — see `fiori-app-bootstrapping/references/fpm.md`. Keep pure-data sections as annotations; use extensions only for bespoke presentation.

## Checklist

`HeaderInfo` with `Title` + `Description` + `TypeName(Plural)` · status in `HeaderFacets` via `DataPoint` + `#WithIcon` · fields grouped in `FieldGroup`s · `Facets` lists `ReferenceFacet`s with stable `ID`s · related records via `nav/@UI.LineItem` · actions as `DataFieldForAction` in `Identification` · amount paired with `@Measures.ISOCurrency` · labels via `Common.Label`/i18n.
