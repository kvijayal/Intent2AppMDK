# FPM Annotations

*Part of the fiori-elements skill. Covers annotation patterns for Flexible Programming Model (FPM) building blocks — `macros:FilterBar`, `macros:Table`, `macros:Chart`, custom sections, and side effects. For manifest/routing/bootstrapping see `fiori-bootstrap/references/fpm.md`.*

> **Annotations first.** Only reach for FPM when a requirement is genuinely beyond what standard List Report / Object Page annotations can express.

---

## 1. FilterBar building block — `UI.SelectionFields`

The `macros:FilterBar` reads `UI.SelectionFields` from the OData metadata (CAP CDS or local `annotation.xml`).

**Always use a qualifier** when the backend service already defines `UI.SelectionFields` on the entity — this avoids overwriting backend filter fields.

```cds
// CAP — srv/annotations.cds
annotate MyService.Orders with @(
  UI.SelectionFields #FPMFilter: [
    status,
    customerName,
    createdAt
  ]
);
```

```xml
<!-- RAP/external — webapp/annotations/annotation.xml -->
<Annotation Term="UI.SelectionFields" Qualifier="FPMFilter">
  <Collection>
    <PropertyPath>Status</PropertyPath>
    <PropertyPath>CustomerName</PropertyPath>
    <PropertyPath>CreatedAt</PropertyPath>
  </Collection>
</Annotation>
```

Reference in the view's `macros:FilterBar`:
```xml
<macros:FilterBar
  id="FilterBar"
  metaPath="/Orders/@com.sap.vocabularies.UI.v1.SelectionFields#FPMFilter" />
```

**Rules:**
- Qualifier in `metaPath` uses `#` separator: `...SelectionFields#FPMFilter`
- Omit `#Qualifier` only when no qualifier is used in the annotation
- `metaPath` entity set name must match `contextPath` in the manifest routing target (without the leading `/`)

---

## 2. Table building block — `UI.LineItem`

```cds
// CAP — srv/annotations.cds
annotate MyService.Orders with @(
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: orderNumber, Label: 'Order #' },
    { $Type: 'UI.DataField', Value: customerName, Label: 'Customer' },
    {
      $Type       : 'UI.DataFieldForAnnotation',
      Target      : '@UI.DataPoint#Status',
      Label       : 'Status'
    },
    { $Type: 'UI.DataField', Value: totalAmount, Label: 'Total' }
  ],

  UI.DataPoint #Status: {
    Value           : status,
    Criticality     : statusCriticality,
    CriticalityRepresentation: #WithIcon
  }
);
```

Reference in the view's `macros:Table`:
```xml
<macros:Table
  id="Table"
  metaPath="/Orders/@com.sap.vocabularies.UI.v1.LineItem"
  filterBar="FilterBar" />
```

**Rules:**
- `filterBar` attribute must exactly match the `id` of the `macros:FilterBar` — this links filtering
- Always compute `statusCriticality` as an integer (0–3) in a CAP `after('READ')` handler; never hardcode colour strings
- Hide the raw criticality field: `statusCriticality @( UI.Hidden: true );`

---

## 3. Chart building block — `UI.Chart`

```cds
annotate MyService.Orders with @(
  UI.Chart #FPMChart: {
    $Type         : 'UI.ChartDefinitionType',
    ChartType     : #Bar,
    Dimensions    : [status],
    Measures      : [totalAmount],
    MeasureAttributes: [{
      $Type    : 'UI.ChartMeasureAttributeType',
      Measure  : totalAmount,
      Role     : #Axis1,
      DataPoint: '@UI.DataPoint#Amount'
    }]
  },

  UI.DataPoint #Amount: {
    Value: totalAmount,
    Title: 'Total Amount'
  }
);
```

```xml
<macros:Chart
  id="Chart"
  metaPath="/Orders/@com.sap.vocabularies.UI.v1.Chart#FPMChart"
  contextPath="/Orders" />
```

**Rules:**
- `sap.chart` and `sap.viz` must be in `manifest.json` `sap.ui5.dependencies.libs`
- Always pair a `UI.Chart` with a `UI.DataPoint` for each measure

---

## 4. Custom section on an Object Page

Register via `manifest.json` content block; the section fragment uses relative bindings resolved by FE from the entity context.

```json
"PODetail": {
  "type": "Component",
  "name": "sap.fe.templates.ObjectPage",
  "options": {
    "settings": {
      "contextPath": "/Orders",
      "content": {
        "body": {
          "sections": {
            "CustomStatusSection": {
              "template": "<appId>.ext.customSection.StatusSection",
              "title": "{i18n>statusSectionTitle}",
              "position": { "placement": "After", "anchor": "GeneralInfoFacet" }
            }
          }
        }
      }
    }
  }
}
```

**Required annotations** — the custom section fragment can still use `UI.DataPoint` criticality from the standard annotation set; it does not need separate annotation terms. Use standard `UI.FieldGroup` if you just want a reordered field group:

```cds
annotate MyService.Orders with @(
  UI.FieldGroup #CustomStatus: {
    Data: [
      { $Type: 'UI.DataField', Value: status },
      { $Type: 'UI.DataField', Value: statusCriticality }
    ]
  }
);
```

**Rules:**
- `position.anchor` must match an existing facet `ID` in `UI.Facets`
- Fragment file lives under `webapp/ext/<customSection>/`; template path is dotted and namespace-prefixed
- Use `this.getExtensionAPI()` inside FPM controllers — never raw router/model access

---

## 5. Side effects after FPM actions

When an action in a custom section or FPM page changes data that other building blocks display, declare `@Common.SideEffects` so the FE runtime refreshes only the affected properties — not the whole page.

```cds
annotate MyService.Orders actions {
  approve @(
    Common.SideEffects #afterApprove: {
      TargetProperties: ['status', 'statusCriticality', 'totalAmount']
    }
  );
};
```

**Rules:**
- Always declare side effects for any bound action that modifies fields shown in a `macros:Table` or `macros:FilterBar`
- Use `TargetEntities` instead of `TargetProperties` when the action affects a composition child entity

---

## 6. Required `manifest.json` flags (FPM-specific)

| Setting | Location | Required value | Why |
|---|---|---|---|
| `flexEnabled` | `sap.ui5` | `true` | FPM page lifecycle won't initialize without it |
| `sap.fe.core` | `sap.ui5.dependencies.libs` | `{}` | FPM runtime |
| `sap.fe.macros` | `sap.ui5.dependencies.libs` | `{}` | Building blocks |
| routing `name` | `sap.ui5.routing.targets` | `"sap.fe.core.fpm"` | Loads the FPM page component |
| `Component.js` extends | — | `sap/fe/core/AppComponent` | Not `sap/ui/core/UIComponent` |

---

## Checklist

- [ ] `UI.SelectionFields` uses qualifier → `metaPath` ends with `#Qualifier`
- [ ] `macros:Table filterBar` ID matches `macros:FilterBar id` exactly
- [ ] Criticality computed as integer 0–3 in CAP `after READ`; raw field has `UI.Hidden: true`
- [ ] Custom section `position.anchor` matches an existing `UI.Facets` entry `ID`
- [ ] `@Common.SideEffects` declared for every bound action that modifies displayed fields
- [ ] `flexEnabled: true` and `sap.fe.macros` in manifest libs
- [ ] Actions surfaced as `UI.DataFieldForAction` — never called from controller code directly

---

## SDK Reference

| Resource | URL |
| --- | --- |
| Flexible Programming Model — Overview | [sapui5.hana.ondemand.com — FPM Overview](https://sapui5.hana.ondemand.com/sdk/#/topic/549eb55fd90d4c61a8a0de7671b0a5bb) |
| `sap.fe.macros` API Reference | [sapui5.hana.ondemand.com — sap.fe.macros](https://sapui5.hana.ondemand.com/sdk/#/api/sap.fe.macros) |
| Building Blocks — Getting Started | [sapui5.hana.ondemand.com — Building Blocks](https://sapui5.hana.ondemand.com/sdk/#/topic/24e45e1cb1bb4519a602c6b9f1d88d84) |
| FPM Custom Page Controller | [sapui5.hana.ondemand.com — Custom Page Controller](https://sapui5.hana.ondemand.com/sdk/#/topic/d6b5561f3d6b46d3bd1e60cca0ab6dc4) |
| `@Common.SideEffects` (CAP docs) | [cap.cloud.sap — Side Effects](https://cap.cloud.sap/docs/advanced/fiori#side-effects) |
