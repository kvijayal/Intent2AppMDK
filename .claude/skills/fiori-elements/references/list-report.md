*Part of the fiori-annotations skill.*

# List Report annotations

The List Report's filter bar and table are driven entirely by annotations in `srv/annotations.cds` — `UI.SelectionFields` (filter bar) and `UI.LineItem` (table columns). No view code. Real example: `Claude-Code/purchaseOrder/srv/annotations.cds`.

## File structure

Split field-level annotations (labels, measures, value-help flags) from entity-level annotations (LineItem, SelectionFields, DataPoint). Keep this in `srv/annotations.cds`, separate from `srv/service.cds`.

```cds
using { PurchaseOrderService } from './service';

// ── Field-level: labels, currency, hidden criticality ───────────────────────
annotate PurchaseOrderService.PurchaseOrders with {
  PONumber    @(Common.Label: 'PO Number');
  Vendor      @(Common.Label: 'Vendor');
  OrderDate   @(Common.Label: 'Order Date');
  TotalAmount @(Common.Label: 'Total Amount', Measures.ISOCurrency: Currency);  // ← currency pairing
  Currency    @(Common.Label: 'Currency');
  POStatus    @(Common.Label: 'Status', Common.ValueListWithFixedValues: true); // ← enum dropdown
  POStatusCriticality @(UI.Hidden: true);  // ← raw integer never shown as a column
};
```

### Currency via @Measures.ISOCurrency

Annotate the amount field with `Measures.ISOCurrency: <currencyField>`. Fiori Elements then formats `TotalAmount` with its currency symbol/code and right-aligns it. Always pair a monetary amount with its currency — never show a bare number.

### Hide the raw criticality integer

The criticality column (`POStatusCriticality`, an integer 0–3 computed in the CAP `after('READ')` handler) drives colour/icon but must not appear as its own column. Mark it `UI.Hidden: true`. The user sees the status text + colour + icon, never the number.

## Entity-level annotations

```cds
annotate PurchaseOrderService.PurchaseOrders with @(

  // ── Semantic status DataPoint (referenced by the LineItem column) ─────────
  UI.DataPoint #POStatus: {
    $Type                    : 'UI.DataPointType',
    Value                    : POStatus,
    Criticality              : POStatusCriticality,
    CriticalityRepresentation: #WithIcon          // colour + icon (accessibility)
  },

  // ── Filter bar ─────────────────────────────────────────────────────────────
  UI.SelectionFields: [ POStatus, Vendor, OrderDate, TotalAmount ],

  // ── Table columns ──────────────────────────────────────────────────────────
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: PONumber,  Label: 'PO Number', ![@UI.Importance]: #High },
    { $Type: 'UI.DataField', Value: Vendor,    Label: 'Vendor',    ![@UI.Importance]: #High },
    { $Type: 'UI.DataField', Value: OrderDate, Label: 'Order Date' },
    { $Type: 'UI.DataField', Value: TotalAmount, Label: 'Total Amount', ![@UI.Importance]: #High },
    // Semantic status column → renders as ObjectStatus with colour + icon
    { $Type: 'UI.DataFieldForAnnotation', Target: '@UI.DataPoint#POStatus',
      Label: 'Status', ![@UI.Importance]: #High }
  ]
);
```

## The semantic status column (the key pattern)

A status column that shows colour + icon is NOT a plain `UI.DataField`. It is a three-part chain:

1. A **`UI.DataPoint`** (qualifier `#POStatus`) whose `Value` is the status text, `Criticality` is the hidden integer, and `CriticalityRepresentation` is `#WithIcon`.
2. A **`UI.DataFieldForAnnotation`** in the `LineItem` that targets `@UI.DataPoint#POStatus`.
3. The hidden criticality integer (`UI.Hidden: true`), computed server-side.

Fiori Elements renders this as an `sap.m.ObjectStatus` with the right semantic colour and icon — never colour alone, satisfying accessibility.

### Criticality enum (SAP standard — memorise)

| Value | Meaning | Colour | Typical status |
|---|---|---|---|
| `0` | Neutral | grey | DRAFT |
| `1` | Negative | red | REJECTED |
| `2` | Critical | orange | SUBMITTED / pending |
| `3` | Positive | green | APPROVED / COMPLETED |

Always pair with `CriticalityRepresentation: #WithIcon`. Compute the integer in a CAP `after('READ')` handler (see `cap-best-practices`); the UI never derives it.

## Column importance (responsive priority)

`![@UI.Importance]: #High` keeps a column visible when the responsive table collapses on small screens; lower-priority columns drop into the pop-in area first. Mark the identifying and status columns `#High`.

## Optional refinements

- **Default sort:** add a `UI.PresentationVariant` with `SortOrder` and reference `@UI.LineItem` in `Visualizations` (this is also the bridge to ALP — see `alp-charts.md`).
- **Line-item action:** add a `UI.DataFieldForAction` to the `LineItem` (e.g. `Action: 'PurchaseOrderService.approve'`) — never invoke OData actions from controller code (see `value-helps.md`).
- **Initial filter values:** add a `UI.SelectionVariant` with `SelectOptions`.

## Checklist

`SelectionFields` lists the filter fields · `LineItem` lists columns with `#High` on key ones · status is a `DataPoint` + `DataFieldForAnnotation` with `#WithIcon` · raw criticality `UI.Hidden` · amount paired with `@Measures.ISOCurrency` · all labels via `Common.Label`/i18n · `contextPath` in the manifest matches this entity.
