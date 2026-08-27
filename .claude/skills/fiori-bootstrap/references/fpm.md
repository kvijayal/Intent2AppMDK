*Part of the fiori-app-bootstrapping skill.*

# Flexible Programming Model (FPM)

FPM lets you extend or replace Fiori Elements pages with **your own XML using SAP building blocks** (`sap.fe.macros`) while keeping the FE runtime, lifecycle, and OData handling. Reach for FPM only when annotations cannot express the UI you need — annotations first, extension second. Two patterns:

1. **Custom section / column** added to a standard List Report or Object Page via the manifest `content` block + an XML fragment.
2. **Custom page** — a fully custom page driven by `sap.fe.core.fpm.Page` with your own root view, still embedded in the FE app.

The `purchaseOrder` app demonstrates pattern 1: a custom Object Page section rendering a semantic `ObjectStatus` badge that annotations can't produce.

## Pattern 1a — custom Object Page section (real example)

Register the section under the Object Page target in `manifest.json`. The `template` is the dotted path to an XML fragment; `position` anchors it relative to an existing facet by its annotation `ID`.

```jsonc
"PODetail": {
  "type": "Component",
  "name": "sap.fe.templates.ObjectPage",
  "options": {
    "settings": {
      "contextPath": "/PurchaseOrders",
      "editableHeaderContent": false,
      "content": {
        "body": {
          "sections": {
            "CustomPOStatusSection": {
              "template": "purchase.order.list.ext.customSection.POStatusSection",
              "title": "{i18n>poStatusSectionTitle}",
              "position": { "placement": "After", "anchor": "PODetailsFacet" }
            }
          }
        }
      }
    }
  }
}
```

The fragment lives at `webapp/ext/customSection/POStatusSection.fragment.xml`. Fiori Elements injects the Object Page entity context automatically, so **relative bindings resolve against `/PurchaseOrders(<key>)`** — no controller needed for a display-only section:

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns:m="sap.m" xmlns:l="sap.ui.layout">
  <m:VBox class="sapUiSmallMargin">
    <!-- ObjectStatus the annotation DataPoint cannot render (inverted badge) -->
    <m:ObjectStatus
      title="Current Status"
      text="{POStatus}"
      state="{= %{POStatusCriticality} === 3 ? 'Success'
               : %{POStatusCriticality} === 2 ? 'Warning'
               : %{POStatusCriticality} === 1 ? 'Error' : 'None' }"
      icon="{= %{POStatusCriticality} === 3 ? 'sap-icon://accept'
               : %{POStatusCriticality} === 2 ? 'sap-icon://alert'
               : %{POStatusCriticality} === 1 ? 'sap-icon://error' : 'sap-icon://pending' }"
      inverted="true" />
  </m:VBox>
</core:FragmentDefinition>
```

Note the criticality mapping mirrors the SAP enum (3 Positive→Success, 2 Critical→Warning, 1 Negative→Error, 0 Neutral→None). Prefer annotations for pure-data sections; use a fragment only for the semantic UI annotations can't control.

## Pattern 1b — building blocks in a custom section

Inside a custom fragment you can drop FE **macros** that behave like the standard table/chart/filter but are placed wherever you want. They need a `metaPath` (annotation term) and a `contextPath`:

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns:macros="sap.fe.macros">
  <!-- A fully functional FE table bound to a navigation property -->
  <macros:Table id="itemsTable"
                metaPath="Items/@com.sap.vocabularies.UI.v1.LineItem"
                contextPath="/PurchaseOrders" />

  <!-- An FE chart -->
  <macros:Chart id="trendChart"
                metaPath="@com.sap.vocabularies.UI.v1.Chart#alp"
                contextPath="/PurchaseOrders" />

  <!-- A filter bar building block -->
  <macros:FilterBar id="customFilterBar"
                    metaPath="@com.sap.vocabularies.UI.v1.SelectionFields"
                    contextPath="/PurchaseOrders" />
</core:FragmentDefinition>
```

`sap.fe.macros` must be in `dependencies.libs`. Building blocks keep FE's data binding, value helps, and variant handling — you do not re-implement OData calls.

## Pattern 2 — custom page (sap.fe.core.fpm)

For a page that is not a ListReport/ObjectPage at all, target the FPM component and supply your own root view:

```jsonc
"targets": {
  "MyCustomPage": {
    "type": "Component",
    "id": "MyCustomPage",
    "name": "sap.fe.core.fpm",
    "options": {
      "settings": {
        "viewName": "purchase.order.list.ext.main.Main",
        "contextPath": "/PurchaseOrders"
      }
    }
  }
}
```

The view `webapp/ext/main/Main.view.xml` is an `sap.fe.core.fpm.Page` (or a plain `sap.ui.core.mvc.View`) hosting macros and standard `sap.m` controls. A controller extending `sap.fe.core.PageController` gives access to `this.getExtensionAPI()` for routing, edit flow, and messages — without bypassing the FE lifecycle.

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:macros="sap.fe.macros"
          xmlns:fpm="sap.fe.core.fpm"
          controllerName="purchase.order.list.ext.main.Main">
  <fpm:Page>
    <macros:Table metaPath="@com.sap.vocabularies.UI.v1.LineItem"
                  contextPath="/PurchaseOrders" />
  </fpm:Page>
</mvc:View>
```

## Required libraries

Add `sap.fe.macros` (and `sap.fe.core`) on top of the standard FE libs; add `sap.chart`/`sap.viz` if you embed `<macros:Chart>`.

## Hard rules

- **Annotations first.** Only extend when a requirement is genuinely beyond annotations (custom badge, bespoke layout, control not covered by a term).
- **Never call OData actions from controller code** — surface them as `UI.DataFieldForAction`; FE invokes them through its edit flow.
- Fragment/view files live under `webapp/ext/...`; the `template`/`viewName` path is dotted and namespace-prefixed.
- Use `this.getExtensionAPI()` (not raw router/model access) inside FPM controllers so FE stays in control.

## Checklist

Custom section registered under `content.body.sections` with `template` + `position.anchor` (an existing facet `ID`) · fragment under `webapp/ext/` · relative bindings rely on the injected context · macros carry `metaPath` + `contextPath` · `sap.fe.macros` in libs · annotations preferred, extension justified · actions stay as `DataFieldForAction`.
