*Part of the fiori-elements skill.*

# Value helps & actions

Value helps let users pick valid input from a dropdown or a selection dialog instead of typing. Two flavours: **fixed-value** (enums) and **collection-based** (references to another entity). Actions are surfaced as `UI.DataFieldForAction` — never invoked from controller code in Fiori Elements. Define all of this in `srv/annotations.cds`.

## Fixed values (enums) → dropdown

For a small, fixed set of codes (status, category, priority), `Common.ValueListWithFixedValues: true` renders an inline dropdown automatically. No collection needed.

```cds
annotate PurchaseOrderService.PurchaseOrders with {
  POStatus @( Common.Label: 'Status', Common.ValueListWithFixedValues: true );
};
```

For human-readable text behind the code, model a code list (CAP `sap.common.CodeList`) and add `Common.Text` so the UI shows the description, not the raw code:

```cds
POStatus @(
  Common.Label: 'Status',
  Common.ValueListWithFixedValues: true,
  Common.Text: status.name,                 // show description…
  Common.TextArrangement: #TextOnly         // …instead of the code
);
```

## Collection-based value help (references)

For a reference to another entity (vendor, plant, cost centre) where the list is large or maintained elsewhere, use `Common.ValueList` with a `CollectionPath` and parameters that map the picked row back to the local field.

```cds
annotate PurchaseOrderService.PurchaseOrders with {
  plant @( Common.ValueList: {
    $Type         : 'Common.ValueListType',
    CollectionPath: 'Plants',                       // the value-help entity set
    Label         : 'Plant',
    Parameters    : [
      // writes the chosen Plant's ID back into plant_ID, and filters as you type
      { $Type: 'Common.ValueListParameterInOut',
        LocalDataProperty: plant_ID, ValueListProperty: 'ID' },
      // extra display-only columns in the dialog
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'city' }
    ]
  });
};
```

### Parameter types

| Parameter `$Type` | Meaning |
|---|---|
| `Common.ValueListParameterInOut` | maps to a local property; used both to filter and to write back the selection |
| `Common.ValueListParameterIn` | passes a local value INTO the value-help query (constrains the list) |
| `Common.ValueListParameterOut` | only writes a value back from the selected row |
| `Common.ValueListParameterDisplayOnly` | shows a column in the dialog only (no binding) |
| `Common.ValueListParameterConstant` | a fixed filter value applied to the value-help query |

For very large value lists, add `Common.ValueListWithFixedValues: false` (the default) so FE opens a dialog with type-ahead rather than loading everything inline.

## Actions — UI.DataFieldForAction (never call from controllers)

In Fiori Elements, OData actions are declared in annotations and invoked by the FE edit flow — calling them from controller code bypasses draft handling, messages, and refresh. Bind them on the `LineItem` (table toolbar/row) and/or `Identification` (Object Page header).

```cds
// CAP action declaration (srv/service.cds)
// action approve() returns PurchaseOrders;  action reject(reason: String) returns PurchaseOrders;

annotate PurchaseOrderService.PurchaseOrders with @(
  UI.LineItem: [
    // …columns…
    { $Type: 'UI.DataFieldForAction',
      Action: 'PurchaseOrderService.approve',
      Label : 'Approve',
      ![@UI.Criticality]: #Positive },          // green button
    { $Type: 'UI.DataFieldForAction',
      Action: 'PurchaseOrderService.reject',
      Label : 'Reject',
      ![@UI.Criticality]: #Negative }           // red button
  ],
  UI.Identification: [
    { $Type: 'UI.DataFieldForAction', Action: 'PurchaseOrderService.approve', Label: 'Approve' }
  ]
);
```

- The `Action` value is `<ServiceName>.<actionName>` (a bound action on the entity).
- `![@UI.Criticality]` colours the button using the standard enum (`#Positive` green, `#Negative` red, `#Critical` orange, `#Neutral`).
- For actions with parameters (e.g. `reject(reason)`), FE renders a parameter dialog automatically — no controller code.
- Guard transitions server-side in the CAP action handler (e.g. reject an invalid status change with HTTP 409). See `cap-skill` and `sap-unit-testing`.

## Navigation as a "value help" (semantic links)

To make a field a link to a related object, use `Common.SemanticObject` + `Common.SemanticObjectMapping` so FE renders intent-based navigation — not a controller `window.location` call.

## Hard rules

- Enums → `Common.ValueListWithFixedValues: true`; references → `Common.ValueList` with `CollectionPath` + parameters.
- Show descriptions via `Common.Text` + `Common.TextArrangement`, not raw codes.
- Actions ONLY as `UI.DataFieldForAction`; never invoke OData actions from controller code.
- Colour action buttons with `![@UI.Criticality]`; validate the transition in the backend.

## Checklist

Every enum field has a fixed-value help · every reference field has a `ValueList` with `InOut` mapping · descriptions via `Common.Text` · actions declared as `DataFieldForAction` on `LineItem`/`Identification` with criticality colour · no controller-side action calls · server-side transition guards exist.
