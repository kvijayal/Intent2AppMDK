*Part of the fiori-bootstrap skill.*

# Standalone Object Page

A standalone Object Page app shows a **single record** entered directly by key (typically launched from a tile, a cross-app navigation, or a deep link) without a preceding List Report. It is `sap.fe.templates.ObjectPage` used as the entry target. The same template also serves as the detail page in an LROP app (`list-report-op.md`); here it is the only floorplan.

## When to use

- The user always arrives with a known key (intent-based navigation `#PurchaseOrder-display?PONumber=...`, a tile, or an email link).
- There is no need to browse a list first.
- You want a focused "display/edit one object" experience.

If users need to search/pick first, use List Report + Object Page instead.

## sap.app — data source

Same OData V4 data source block as any FE app:

```jsonc
"dataSources": {
  "mainService": {
    "uri": "/odata/v4/purchaseorder/",
    "type": "OData",
    "settings": { "odataVersion": "4.0" }
  }
}
```

## Routing — one route with the key in the pattern

The single route carries the entity key. There is no empty `:?query:` list route.

```jsonc
"routing": {
  "routes": [
    {
      "name": "PODetail",
      "pattern": "PurchaseOrders({key}):?query:",
      "target": "PODetail"
    }
  ],
  "targets": {
    "PODetail": {
      "type": "Component",
      "id": "PODetail",
      "name": "sap.fe.templates.ObjectPage",
      "options": {
        "settings": {
          "contextPath": "/PurchaseOrders",
          "editableHeaderContent": false
        }
      }
    }
  }
}
```

- **`pattern: "PurchaseOrders({key}):?query:"`** — Fiori Elements binds the page to `/PurchaseOrders(<key>)` automatically. `{key}` resolves the entity's key (for a single string/UUID key) or a composite `(prop1=…,prop2=…)` form for multi-key entities.
- **`contextPath: "/PurchaseOrders"`** — the bound entity set (never `entitySet`).
- **`editableHeaderContent: false`** — header is display-only; set `true` only if header fields must be editable in edit mode.

If you also want an "object not found" fallback, add a second target `sap.fe.templates.ObjectPage` is not needed — FE handles the not-found state; just ensure the key pattern is correct.

## Model settings

Same default-model block as every backend-bound app:

```jsonc
"models": {
  "": {
    "dataSource": "mainService",
    "type": "sap.ui.model.odata.v4.ODataModel",
    "settings": {
      "operationMode": "Server",
      "autoExpandSelect": true,
      "earlyRequests": true,
      "groupId": "$auto",
      "updateGroupId": "$auto"
    }
  },
  "i18n": {
    "type": "sap.ui.model.resource.ResourceModel",
    "settings": { "bundleName": "purchase.order.list.i18n.i18n" }
  }
}
```

## Required libraries

```jsonc
"dependencies": {
  "minUI5Version": "{RECOMMENDED_UI5_VERSION}",
  "libs": {
    "sap.ui.core": {}, "sap.m": {}, "sap.fe.core": {},
    "sap.fe.templates": {}, "sap.fe.macros": {},
    "sap.uxap": {}, "sap.ui.layout": {}
  }
}
```

## Header & facets come from annotations

The Object Page layout is annotation-driven. Define these in `srv/annotations.cds` (see `fiori-elements` `references/object-page.md`):

- **`UI.HeaderInfo`** — `TypeName`/`TypeNamePlural`, `Title`, `Description` shown at the top.
- **`UI.HeaderFacets`** — compact KPIs/status badges in the header area (e.g. a `UI.DataPoint` status with `CriticalityRepresentation: #WithIcon`).
- **`UI.FieldGroup` + `UI.Facets`** (`ReferenceFacet`) — the body sections. Each `ReferenceFacet` targets a `FieldGroup` (a labelled block of fields) or another collection facet.
- **`UI.Identification`** — page-level actions (rendered in the header toolbar) via `UI.DataFieldForAction`.

Minimal real example (from the purchaseOrder app):

```cds
UI.HeaderInfo: {
  TypeName: 'Purchase Order', TypeNamePlural: 'Purchase Orders',
  Title: { Value: PONumber }, Description: { Value: Vendor }
},
UI.HeaderFacets: [
  { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#POStatus', Label: 'Status' }
],
UI.Facets: [
  { $Type: 'UI.ReferenceFacet', ID: 'PODetailsFacet', Label: 'PO Details',
    Target: '@UI.FieldGroup#PODetails' }
]
```

## Checklist

Single route with `{key}` in the pattern · target `sap.fe.templates.ObjectPage` (Component) · `contextPath` not `entitySet` · `editableHeaderContent` set deliberately · `HeaderInfo` + `HeaderFacets` + `Facets`/`FieldGroup` in annotations · V4 model settings · all FE libs declared.
