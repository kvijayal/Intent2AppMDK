# MDK Page Patterns

*Part of the mdk-patterns skill.*

## Rules

### Page Structure
1. Every page must have `_Type`, `_Name`, and `Caption`
2. `_Name` must exactly match the filename without extension — mismatch breaks every reference
3. `Caption` must always use `{i18n>Key}` — never hardcode text
4. `Control.Type.SectionedTable` is the root control for all list and detail pages
5. Add `DataSubscriptions: ["EntitySetName"]` to SectionedTable on detail pages — without it the page won't refresh after edits

### List Pages
6. Always include `Search: { Enabled: true, Delay: 500, MinimumCharacterThreshold: 3 }` on ObjectTable
7. Always include `EmptySection: { Caption: "{i18n>NoItems}" }` — blank screen with no feedback is a bug
8. Always set `AccessoryType: "DisclosureIndicator"` on ObjectCell when row navigates somewhere
9. Always set `$top` in QueryOptions — never load unbounded entity sets: `"$top=20&$orderby=Name asc"`
10. Include `Footer.AttributeLabel` pointing to a count rule for user feedback

### Detail Pages
11. First section is always `Section.Type.ObjectHeader` — object page won't render correctly without it
12. Use `Section.Type.KeyValue` with `Layout: { NumberOfColumns: 2 }` for property groups
13. Related entity tables go as additional `Section.Type.ObjectTable` sections below KeyValue
14. Use `{@odata.readLink}/RelatedEntitySet` as Target.EntitySet for navigation property sections

### Create/Edit Pages
15. Always include ActionBar with Cancel (Left, SystemItem: "Cancel") and Save/Create (Right)
16. Primary key properties must NOT appear as editable FormCell controls
17. Always set `IsRequired: true` on mandatory fields — pair with CheckRequiredFields action
18. Use `#Control:Name/#Value` to bind form control values in action Properties

## List Page Pattern

```json
{
  "_Type": "Page",
  "_Name": "Products_List",
  "Caption": "{i18n>Products_List_Caption}",
  "ActionBar": { "Items": [
    { "SystemItem": "Add", "Position": "Right",
      "OnPress": "/AppName/Actions/Products/NavToProducts_Create.action" }
  ]},
  "Controls": [{
    "_Name": "SectionedTable0",
    "_Type": "Control.Type.SectionedTable",
    "DataSubscriptions": ["Products"],
    "Sections": [{
      "_Name": "ObjectTable0",
      "_Type": "Section.Type.ObjectTable",
      "Search": { "Enabled": true, "Delay": 500, "MinimumCharacterThreshold": 3,
        "Placeholder": "{i18n>Search_Placeholder}", "BarcodeScanner": false },
      "ObjectCell": {
        "Title": "{Name}", "Subhead": "{ProductId}",
        "Footnote": "{Category}", "StatusText": "{Status}",
        "AccessoryType": "DisclosureIndicator",
        "StatusTextColor": "/AppName/Rules/Products/Products_StatusColor.js",
        "OnPress": "/AppName/Actions/Products/NavToProducts_Detail.action"
      },
      "Footer": { "_Name": "ProductsFooter",
        "AttributeLabel": "/AppName/Rules/Products/Products_Count.js" },
      "EmptySection": { "Caption": "{i18n>NoItems}" },
      "Target": {
        "EntitySet": "Products", "Service": "/AppName/Services/SampleService.service",
        "QueryOptions": "$top=20&$orderby=Name asc"
      }
    }]
  }]
}
```

## Detail Page Pattern

```json
{
  "_Type": "Page",
  "_Name": "Products_Detail",
  "Caption": "{i18n>Products_Detail_Caption}",
  "ActionBar": { "Items": [
    { "Image": "sap-icon://edit", "Position": "Right",
      "OnPress": "/AppName/Actions/Products/NavToProducts_Edit.action" },
    { "Image": "sap-icon://delete", "Position": "Right",
      "OnPress": "/AppName/Actions/Products/Products_ConfirmDelete.action" }
  ]},
  "Controls": [{
    "_Name": "SectionedTable0",
    "_Type": "Control.Type.SectionedTable",
    "DataSubscriptions": ["Products"],
    "Sections": [
      {
        "_Name": "ObjectHeaderSection",
        "_Type": "Section.Type.ObjectHeader",
        "ObjectHeader": {
          "HeadlineText": "{Name}", "Subhead": "{ProductId}",
          "StatusText": "{Status}", "DetailImage": "sap-icon://product",
          "StatusTextColor": "/AppName/Rules/Products/Products_StatusColor.js"
        }
      },
      {
        "_Name": "SectionKeyValue0",
        "_Type": "Section.Type.KeyValue",
        "Header": { "Caption": "{i18n>Details_Header}", "UseTopPadding": false },
        "KeyAndValues": [
          { "KeyName": "{i18n>Products_Name_Label}", "Value": "{Name}" },
          { "KeyName": "{i18n>Products_Price_Label}",
            "Value": "$(N,{Price},'',{minimumFractionDigits:2})" }
        ],
        "Layout": { "NumberOfColumns": 2 }
      }
    ]
  }]
}
```

## Create/Edit Page Pattern

```json
{
  "_Type": "Page", "_Name": "Products_Create",
  "Caption": "{i18n>Products_Create_Caption}",
  "ActionBar": { "Items": [
    { "SystemItem": "Cancel", "Position": "Left",
      "OnPress": "/AppName/Actions/CancelPage.action" },
    { "Caption": "{i18n>Save_Button}", "Position": "Right",
      "OnPress": "/AppName/Actions/Products/Products_CheckRequired.action" }
  ]},
  "Controls": [{
    "_Name": "SectionedTable0", "_Type": "Control.Type.SectionedTable",
    "Sections": [{ "_Name": "FormCellSection0", "_Type": "Section.Type.FormCell",
      "Controls": [
        { "_Name": "Name", "_Type": "Control.Type.FormCell.SimpleProperty",
          "Caption": "{i18n>Products_Name_Label}", "IsEditable": true,
          "IsRequired": true, "PlaceHolder": "{i18n>Products_Name_Placeholder}" },
        { "_Name": "Price", "_Type": "Control.Type.FormCell.SimpleProperty",
          "Caption": "{i18n>Products_Price_Label}", "IsEditable": true,
          "KeyboardType": "Number" },
        { "_Name": "Active", "_Type": "Control.Type.FormCell.Switch",
          "Caption": "{i18n>Products_Active_Label}", "IsEditable": true, "Value": true },
        { "_Name": "Category", "_Type": "Control.Type.FormCell.ListPicker",
          "Caption": "{i18n>Products_Category_Label}", "IsEditable": true,
          "AllowMultipleSelection": false,
          "Items": "/AppName/Rules/Products/GetCategoryItems.js" }
      ]
    }]
  }]
}
```

## FormCell Type Selection

| OData Edm Type | MDK Control | Notes |
|---|---|---|
| `Edm.String` | `FormCell.SimpleProperty` | Default for text |
| `Edm.Boolean` | `FormCell.Switch` | Never use SimpleProperty for boolean |
| `Edm.DateTime` / `Edm.DateTimeOffset` | `FormCell.DatePicker` | Mode: "Date" or "DateTime" |
| `Edm.Decimal` / `Edm.Int32` / `Edm.Int64` | `FormCell.SimpleProperty` + `KeyboardType: "Number"` | |
| Enum / fixed list | `FormCell.ListPicker` | Items rule returns `[{ReturnValue, DisplayValue}]` |
| Multi-line text | `FormCell.Note` | PlaceHolder recommended |
| Key property | Omit from create form | Never editable |
