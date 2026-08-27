*Part of the fiori-elements skill.*

> OData **V2** `sap.suite.ui.generic.template` List Report **extension** scenarios (custom column, custom action, custom filter, cross-app navigation, filter-bar value help, Object Page field group). For base V4 CAP List Report annotations, see [`list-report.md`](list-report.md).

# SAP UI5 Fiori List Report — Extensions Guide (OData V2)

This guide covers exactly how to implement the following extensions on a SAP Fiori List Report application using OData V2 and `sap.suite.ui.generic.template`:

1. Custom Column Extension
2. Cross Application Navigation
3. Custom Filter
4. Custom Action
5. Value Help on Filter Bar
6. Field Group on Object Page

---

## Placeholder Reference

Replace every placeholder below with the actual value from your project before generating any file.

| Placeholder | Description | Example |
|---|---|---|
| `<AppId>` | Full application namespace/ID from `manifest.json` | `com.mycompany.myapp` |
| `<ServiceUrl>` | OData V2 service root URL | `/sap/opu/odata/sap/MY_SERVICE_SRV/` |
| `<Namespace>` | EDMX namespace of the entity types in `metadata.xml` | `MY_SERVICE_SRV` |
| `<ContainerNamespace>` | EDMX namespace of the entity container in `metadata.xml` | `MY_SERVICE_SRV_Entities` |
| `<EntitySet>` | OData entity set name (used in pages, extension keys) | `Products` |
| `<EntityType>` | OData entity type name (used in annotation targets) | `Product` |
| `<KeyProperty>` | Key property of the entity (used in ComboBox binding) | `ProductID` |
| `<DisplayProperty>` | Property to display in the custom column cell | `ProductName` |
| `<LeadingProperty>` | OData property the custom column represents (for p13nData) | `ProductID` |
| `<ColumnId>` | Unique XML ID for the custom column element | `customProductColumn` |
| `<ColumnKey>` | Unique key for personalisation (p13nData columnKey) | `CustomProductCol` |
| `<ColumnHeaderText>` | Label text shown in the custom column header | `Product` |
| `<CustomFilterKey>` | Key used to identify the custom filter control | `customProductFilter` |
| `<CustomControlId>` | XML ID of the custom filter control (ComboBox/Input/Select) | `productFilterCombo` |
| `<FilterLabel>` | Label shown next to the custom filter in the filter bar | `Product ID` |
| `<FilterProperty>` | OData property on which the filter is applied | `ProductID` |
| `<AppStateKey>` | JavaScript property name used to store the filter value in app state | `selectedProduct` |
| `<ActionKey>` | Internal key for the custom action in `manifest.json` | `editAction` |
| `<ActionButtonId>` | XML element ID for the action button | `editActionBtn` |
| `<ActionButtonText>` | Label shown on the action button | `Edit` |
| `<ActionHandlerMethod>` | JavaScript method name for the action handler | `onEditPress` |
| `<SemanticObject>` | Fiori semantic object of the navigation target app | `SalesOrder` |
| `<SemanticAction>` | Fiori intent action of the navigation target app | `display` |
| `<FieldGroupQualifier>` | Qualifier string for the UI.FieldGroup annotation | `GeneralInfo` |
| `<FieldGroupLabel>` | Label for the field group section on the Object Page | `General Information` |
| `<FacetLabel>` | Label shown as the section title on the Object Page | `General Information` |
| `<FacetId>` | Unique ID for the facet (ReferenceFacet) | `GeneralSection` |
| `<Property1>`, `<Property2>`, `<Property3>` | Entity properties to show inside the field group | `Name`, `Category`, `Price` |

---

## Project Structure

```
webapp/
├── Component.js
├── manifest.json
├── annotations/
│   └── annotation.xml
├── ext/
│   ├── controller/
│   │   └── ListReportExt.controller.js
│   └── fragment/
│       ├── customFilter.fragment.xml
│       ├── ResponsiveTableCells.fragment.xml
│       └── ResponsiveTableColumns.fragment.xml
├── i18n/
│   └── i18n.properties
└── localService/
    └── mainService/
        └── metadata.xml
```

---

## manifest.json

### sap.app — Data Sources

```json
"dataSources": {
    "annotation": {
        "type": "ODataAnnotation",
        "uri": "annotations/annotation.xml",
        "settings": { "localUri": "annotations/annotation.xml" }
    },
    "mainService": {
        "uri": "<ServiceUrl>",
        "type": "OData",
        "settings": {
            "annotations": ["annotation"],
            "localUri": "localService/mainService/metadata.xml",
            "odataVersion": "2.0"
        }
    }
}
```

### sap.ui5 — Model, flexEnabled

```json
"flexEnabled": false,
"models": {
    "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
            "defaultBindingMode": "TwoWay",
            "defaultCountMode": "Inline",
            "refreshAfterChange": false,
            "metadataUrlParams": { "sap-value-list": "none" }
        }
    }
}
```

> `"sap-value-list": "none"` prevents the framework from loading value help from V2 metadata. Value help is defined in `annotation.xml` instead.

### sap.ui.generic.app — Page Settings

```json
"sap.ui.generic.app": {
    "_version": "1.3.0",
    "settings": {
        "forceGlobalRefresh": false,
        "objectPageHeaderType": "Dynamic",
        "considerAnalyticalParameters": true,
        "showDraftToggle": false
    },
    "pages": {
        "ListReport|<EntitySet>": {
            "entitySet": "<EntitySet>",
            "component": {
                "name": "sap.suite.ui.generic.template.ListReport",
                "list": true,
                "settings": {
                    "condensedTableLayout": true,
                    "smartVariantManagement": true,
                    "enableTableFilterInPageVariant": true,
                    "filterSettings": {
                        "dateSettings": { "useDateRange": true }
                    },
                    "tableSettings": { "type": "ResponsiveTable" }
                }
            },
            "pages": {
                "ObjectPage|<EntitySet>": {
                    "entitySet": "<EntitySet>",
                    "defaultLayoutTypeIfExternalNavigation": "MidColumnFullScreen",
                    "component": { "name": "sap.suite.ui.generic.template.ObjectPage" }
                }
            }
        }
    }
}
```

> `"type": "ResponsiveTable"` is required. Without it, the `ResponsiveTableColumnsExtension` and `ResponsiveTableCellsExtension` extension points do not exist.

### sap.ui5 — All Extensions (View Extensions + Controller Extension + Custom Action)

```json
"extends": {
    "extensions": {
        "sap.ui.viewExtensions": {
            "sap.suite.ui.generic.template.ListReport.view.ListReport": {
                "ResponsiveTableColumnsExtension|<EntitySet>": {
                    "className": "sap.ui.core.Fragment",
                    "fragmentName": "<AppId>.ext.fragment.ResponsiveTableColumns",
                    "type": "XML"
                },
                "ResponsiveTableCellsExtension|<EntitySet>": {
                    "className": "sap.ui.core.Fragment",
                    "fragmentName": "<AppId>.ext.fragment.ResponsiveTableCells",
                    "type": "XML"
                },
                "SmartFilterBarControlConfigurationExtension|<EntitySet>": {
                    "className": "sap.ui.core.Fragment",
                    "fragmentName": "<AppId>.ext.fragment.customFilter",
                    "type": "XML"
                }
            },
            "sap.suite.ui.generic.template.ObjectPage.view.Details": {}
        },
        "sap.ui.controllerExtensions": {
            "sap.suite.ui.generic.template.ListReport.view.ListReport": {
                "controllerName": "<AppId>.ext.controller.ListReportExt",
                "sap.ui.generic.app": {
                    "<EntitySet>": {
                        "EntitySet": "<EntitySet>",
                        "Actions": {
                            "<ActionKey>": {
                                "id": "<ActionButtonId>",
                                "text": "<ActionButtonText>",
                                "press": "<ActionHandlerMethod>",
                                "requiresSelection": true
                            }
                        }
                    }
                }
            }
        }
    }
}
```

**Rules:**
- The part after `|` in extension keys (e.g., `ResponsiveTableColumnsExtension|<EntitySet>`) must exactly match the entity set name.
- `fragmentName` must be the fully qualified path: `<AppId>.ext.fragment.<FragmentFileName>`.
- The controller extension returns a plain object, not a class. Actions are declared inside `sap.ui.generic.app.<EntitySet>.Actions`.
- `requiresSelection: true` disables the button when no row is selected. Set to `false` for always-enabled.

---

## 1. Custom Column Extension

### ext/fragment/ResponsiveTableColumns.fragment.xml

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns="sap.m">
    <Column id="<ColumnId>">
        <Text text="<ColumnHeaderText>"/>
        <customData>
            <core:CustomData key="p13nData"
                value="\{&quot;columnKey&quot;: &quot;<ColumnKey>&quot;, &quot;leadingProperty&quot;: &quot;<LeadingProperty>&quot;, &quot;columnIndex&quot;: &quot;101&quot;}"/>
        </customData>
    </Column>
</core:FragmentDefinition>
```

### ext/fragment/ResponsiveTableCells.fragment.xml

```xml
<core:FragmentDefinition xmlns:core="sap.ui.core" xmlns="sap.m">
    <Link text="{<DisplayProperty>}" press="onPress"/>
</core:FragmentDefinition>
```

**Rules:**
- The number of root elements in the Cells fragment must match the number of `Column` elements in the Columns fragment (one cell per column, in the same order).
- `p13nData` is required on every custom column. `columnKey` must be unique across all columns. `columnIndex` above 100 places the column after all standard columns.
- The `press` handler (`onPress`) on the Link is resolved from the controller extension.

---

## 2. Cross Application Navigation

Implemented as `onPress` in the controller extension. Wired to the `press` event of the Link in the custom column cell fragment.

```javascript
onPress: function (oEvent) {
    var oCrossNav = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService
        ? sap.ushell.Container.getService("CrossApplicationNavigation")
        : null;

    if (!oCrossNav) { return; }

    oCrossNav.toExternal({
        target: {
            semanticObject: "<SemanticObject>",
            action: "<SemanticAction>"
        }
    });
}
```

**Rules:**
- Always guard with `sap.ushell && sap.ushell.Container` before calling `getService`. Without this the app crashes when run outside Fiori Launchpad (e.g., during local development).
- `<SemanticObject>` and `<SemanticAction>` must match the intent registered in the Fiori Launchpad catalog for the target application.

---

## 3. Custom Filter

### ext/fragment/customFilter.fragment.xml

```xml
<core:FragmentDefinition xmlns="sap.m" xmlns:smartfilterbar="sap.ui.comp.smartfilterbar" xmlns:core="sap.ui.core">
    <smartfilterbar:ControlConfiguration
        groupId="_BASIC"
        key="<CustomFilterKey>"
        label="<FilterLabel>"
        visibleInAdvancedArea="true">
        <smartfilterbar:customControl>
            <ComboBox id="<CustomControlId>" items="{path: '/<EntitySet>'}">
                <core:Item key="{<KeyProperty>}" text="{<KeyProperty>}"/>
            </ComboBox>
        </smartfilterbar:customControl>
    </smartfilterbar:ControlConfiguration>
</core:FragmentDefinition>
```

**Rules:**
- `groupId="_BASIC"` places the filter in the basic (default visible) area.
- `key="<CustomFilterKey>"` must exactly match the key used in `getControlByKey("<CustomFilterKey>")` in the controller.
- `visibleInAdvancedArea="true"` also shows the field in the advanced filter dialog.
- The `id` on the inner control (`<CustomControlId>`) is used in the controller via `this.oView.byId("<CustomControlId>")`.

### Controller Hooks for Custom Filter

Three methods must be implemented together:

```javascript
// Persist custom filter value before navigating away
getCustomAppStateDataExtension: function (oCustomData) {
    if (oCustomData) {
        var oCustomControl = this.oView.byId("<CustomControlId>");
        if (oCustomControl) {
            oCustomData.<AppStateKey> = oCustomControl.getSelectedKey();
        }
    }
},

// Restore custom filter value after back navigation
restoreCustomAppStateDataExtension: function (oCustomData) {
    if (oCustomData && oCustomData.<AppStateKey>) {
        var oCustomControl = this.oView.byId("<CustomControlId>");
        if (oCustomControl) {
            oCustomControl.setSelectedKey(oCustomData.<AppStateKey>);
        }
    }
},

// Apply custom filter before the table fetches data
onBeforeRebindTableExtension: function (oEvent) {
    var oBindingParams = oEvent.getParameter("bindingParams");
    oBindingParams.parameters = oBindingParams.parameters || {};
    var oSmartTable = oEvent.getSource();
    var oSmartFilterBar = this.byId(oSmartTable.getSmartFilterId());
    if (oSmartFilterBar instanceof SmartFilterBar) {
        var oCustomControl = oSmartFilterBar.getControlByKey("<CustomFilterKey>");
        if (oCustomControl instanceof ComboBox) {
            var vSelected = oCustomControl.getSelectedKey();
            if (vSelected) {
                oBindingParams.filters.push(new Filter("<FilterProperty>", "EQ", vSelected));
            }
        }
    }
}
```

---

## 4. Custom Action

Declared in `manifest.json` (shown above). The handler is implemented in the controller extension:

```javascript
<ActionHandlerMethod>: function (oEvent) {
    MessageToast.show("<ActionButtonText> action triggered");
}
```

**Rules:**
- The method name must exactly match the value of `"press"` in the `manifest.json` action definition.
- The action button appears in the table toolbar, not the page header.
- `requiresSelection: true` — button is greyed out until a table row is selected.

---

## 5. Value Help on Filter Bar

Defined in `annotation.xml` using `Common.ValueList`. No code or manifest change required.

```xml
<Annotations Target="<Namespace>.<EntityType>/<FilterProperty>">
    <Annotation Term="Common.ValueList">
        <Record Type="Common.ValueListType">
            <PropertyValue Property="CollectionPath" String="<EntitySet>"/>
            <PropertyValue Property="SearchSupported" Bool="true"/>
            <PropertyValue Property="Parameters">
                <Collection>
                    <Record Type="Common.ValueListParameterInOut">
                        <PropertyValue Property="ValueListProperty" String="<FilterProperty>"/>
                        <PropertyValue Property="LocalDataProperty" PropertyPath="<FilterProperty>"/>
                    </Record>
                </Collection>
            </PropertyValue>
        </Record>
    </Annotation>
</Annotations>
```

**Rules:**
- `Target` format is `<Namespace>.<EntityType>/<FilterProperty>` — all three parts come from the OData metadata.
- `CollectionPath` is the entity set that provides value help rows (can be a different entity set if needed).
- `ValueListParameterInOut` maps a column in the value help list to a local property and writes the selected value back. Use `ValueListParameterOut` for output-only, `ValueListParameterIn` for pre-filtering without write-back.
- `"sap-value-list": "none"` in the default model's `metadataUrlParams` in `manifest.json` is required when value help is defined through annotations.

---

## 6. Field Group on Object Page

Defined in `annotation.xml` using `UI.FieldGroup` and `UI.Facets`. No code or manifest change required.

```xml
<Annotations Target="<Namespace>.<EntityType>">
    <Annotation Term="UI.FieldGroup" Qualifier="<FieldGroupQualifier>">
        <Record Type="UI.FieldGroupType">
            <PropertyValue Property="Label" String="<FieldGroupLabel>"/>
            <PropertyValue Property="Data">
                <Collection>
                    <Record Type="UI.DataField">
                        <PropertyValue Property="Value" Path="<Property1>"/>
                    </Record>
                    <Record Type="UI.DataField">
                        <PropertyValue Property="Value" Path="<Property2>"/>
                    </Record>
                    <Record Type="UI.DataField">
                        <PropertyValue Property="Value" Path="<Property3>"/>
                    </Record>
                </Collection>
            </PropertyValue>
        </Record>
    </Annotation>

    <Annotation Term="UI.Facets">
        <Collection>
            <Record Type="UI.ReferenceFacet">
                <PropertyValue Property="Label" String="<FacetLabel>"/>
                <PropertyValue Property="ID" String="<FacetId>"/>
                <PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#<FieldGroupQualifier>"/>
            </Record>
        </Collection>
    </Annotation>
</Annotations>
```

**Rules:**
- The `Qualifier` in `UI.FieldGroup` must exactly match the part after `#` in the `ReferenceFacet` `Target` (`@UI.FieldGroup#<FieldGroupQualifier>`).
- Both annotations target the entity type (not a property) — the `Target` is `<Namespace>.<EntityType>`.
- Add more `UI.DataField` records inside `Data` to include more properties in the section.
- Add more `ReferenceFacet` records inside `UI.Facets` to create multiple sections on the Object Page.

---

## Complete annotation.xml

```xml
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/UI.xml">
        <edmx:Include Namespace="com.sap.vocabularies.UI.v1" Alias="UI"/>
    </edmx:Reference>
    <edmx:Reference Uri="https://sap.github.io/odata-vocabularies/vocabularies/Common.xml">
        <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
    </edmx:Reference>
    <edmx:Reference Uri="<ServiceUrl>$metadata">
        <edmx:Include Namespace="<Namespace>"/>
        <edmx:Include Namespace="<ContainerNamespace>"/>
    </edmx:Reference>
    <edmx:DataServices>
        <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="local">

            <!-- Value Help on filter bar field -->
            <Annotations Target="<Namespace>.<EntityType>/<FilterProperty>">
                <Annotation Term="Common.ValueList">
                    <Record Type="Common.ValueListType">
                        <PropertyValue Property="CollectionPath" String="<EntitySet>"/>
                        <PropertyValue Property="SearchSupported" Bool="true"/>
                        <PropertyValue Property="Parameters">
                            <Collection>
                                <Record Type="Common.ValueListParameterInOut">
                                    <PropertyValue Property="ValueListProperty" String="<FilterProperty>"/>
                                    <PropertyValue Property="LocalDataProperty" PropertyPath="<FilterProperty>"/>
                                </Record>
                            </Collection>
                        </PropertyValue>
                    </Record>
                </Annotation>
            </Annotations>

            <!-- Field Group and Facets for Object Page -->
            <Annotations Target="<Namespace>.<EntityType>">
                <Annotation Term="UI.FieldGroup" Qualifier="<FieldGroupQualifier>">
                    <Record Type="UI.FieldGroupType">
                        <PropertyValue Property="Label" String="<FieldGroupLabel>"/>
                        <PropertyValue Property="Data">
                            <Collection>
                                <Record Type="UI.DataField">
                                    <PropertyValue Property="Value" Path="<Property1>"/>
                                </Record>
                                <Record Type="UI.DataField">
                                    <PropertyValue Property="Value" Path="<Property2>"/>
                                </Record>
                                <Record Type="UI.DataField">
                                    <PropertyValue Property="Value" Path="<Property3>"/>
                                </Record>
                            </Collection>
                        </PropertyValue>
                    </Record>
                </Annotation>
                <Annotation Term="UI.Facets">
                    <Collection>
                        <Record Type="UI.ReferenceFacet">
                            <PropertyValue Property="Label" String="<FacetLabel>"/>
                            <PropertyValue Property="ID" String="<FacetId>"/>
                            <PropertyValue Property="Target" AnnotationPath="@UI.FieldGroup#<FieldGroupQualifier>"/>
                        </Record>
                    </Collection>
                </Annotation>
            </Annotations>

        </Schema>
    </edmx:DataServices>
</edmx:Edmx>
```

---

## Complete Controller Extension

```javascript
sap.ui.define([
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/comp/smartfilterbar/SmartFilterBar",
    "sap/m/ComboBox"
], function (MessageToast, Filter, SmartFilterBar, ComboBox) {
    'use strict';

    return {

        // Custom Action handler
        <ActionHandlerMethod>: function (oEvent) {
            MessageToast.show("<ActionButtonText> action triggered");
        },

        // Cross Application Navigation (triggered from custom column cell Link)
        onPress: function (oEvent) {
            var oCrossNav = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService
                ? sap.ushell.Container.getService("CrossApplicationNavigation")
                : null;
            if (!oCrossNav) { return; }
            oCrossNav.toExternal({
                target: {
                    semanticObject: "<SemanticObject>",
                    action: "<SemanticAction>"
                }
            });
        },

        // Custom Filter — persist state before navigation
        getCustomAppStateDataExtension: function (oCustomData) {
            if (oCustomData) {
                var oCustomControl = this.oView.byId("<CustomControlId>");
                if (oCustomControl) {
                    oCustomData.<AppStateKey> = oCustomControl.getSelectedKey();
                }
            }
        },

        // Custom Filter — restore state after back navigation
        restoreCustomAppStateDataExtension: function (oCustomData) {
            if (oCustomData && oCustomData.<AppStateKey>) {
                var oCustomControl = this.oView.byId("<CustomControlId>");
                if (oCustomControl) {
                    oCustomControl.setSelectedKey(oCustomData.<AppStateKey>);
                }
            }
        },

        // Custom Filter — apply to table OData binding
        onBeforeRebindTableExtension: function (oEvent) {
            var oBindingParams = oEvent.getParameter("bindingParams");
            oBindingParams.parameters = oBindingParams.parameters || {};
            var oSmartTable = oEvent.getSource();
            var oSmartFilterBar = this.byId(oSmartTable.getSmartFilterId());
            if (oSmartFilterBar instanceof SmartFilterBar) {
                var oCustomControl = oSmartFilterBar.getControlByKey("<CustomFilterKey>");
                if (oCustomControl instanceof ComboBox) {
                    var vSelected = oCustomControl.getSelectedKey();
                    if (vSelected) {
                        oBindingParams.filters.push(new Filter("<FilterProperty>", "EQ", vSelected));
                    }
                }
            }
        }
    };
});
```
