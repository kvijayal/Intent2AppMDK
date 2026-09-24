---
name: mdk-app-builder
description: >
  Use for all SAP MDK (Mobile Development Kit) development — page templates, action
  templates, rule patterns, offline OData, binding syntax, i18n, and project operations.
  Trigger on: "create MDK page", "generate MDK action", "MDK CRUD", "MDK offline",
  "MDK rule", "MDK binding", "MDK deploy", "MDK validate", "MDK best practices",
  "ObjectTable", "FormCell", "clientAPI", "offline OData", "UploadOfflineOData".
---

# MDK App Builder

MDK is metadata-driven: the app is defined in JSON files (pages, actions, rules).
No native mobile code. The MDK client interprets metadata at runtime on iOS and Android.

---

## Protected Files — Never Generate or Modify
- `.project.json` — managed by MDK toolchain
- `.service.metadata` — created via VS Code: `MDK: Open Mobile App Editor`
- `Services/*.xml` — never create XML in Services folder

---

## File Path Conventions

```
/AppName/Pages/EntityName/EntityName_List.page
/AppName/Actions/EntityName/EntityName_CreateEntity.action
/AppName/Rules/EntityName/EntityName_StatusColor.js
/AppName/Services/ServiceName.service
i18n/i18n.properties
```

`_Name` in every artifact must exactly match filename without extension.

---

## Page Templates

### List Page (ObjectTable with Search)

```json
{
  "_Name": "Products_List",
  "_Type": "Page",
  "Caption": "{i18n>Products_List_Caption}",
  "Controls": [{
    "_Name": "SectionedTable0",
    "_Type": "Control.Type.SectionedTable",
    "DataSubscriptions": ["Products"],
    "Sections": [{
      "_Name": "ObjectTable0",
      "_Type": "Section.Type.ObjectTable",
      "Search": { "Enabled": true, "Delay": 500, "MinimumCharacterThreshold": 3, "Placeholder": "{i18n>Search_Placeholder}", "BarcodeScanner": false },
      "ObjectCell": {
        "Title": "{Name}", "Subhead": "{ProductId}", "Footnote": "{Category}",
        "StatusText": "{Status}", "AccessoryType": "DisclosureIndicator",
        "OnPress": "/AppName/Actions/Products/NavToProducts_Detail.action",
        "StatusTextColor": "/AppName/Rules/Products/Products_StatusColor.js"
      },
      "EmptySection": { "Caption": "{i18n>NoItems}" },
      "Footer": { "_Name": "ObjectTableFooter", "AttributeLabel": "/AppName/Rules/Products/Products_Count.js" },
      "Target": {
        "EntitySet": "Products",
        "Service": "/AppName/Services/SampleService.service",
        "QueryOptions": "$top=20&$orderby=Name asc"
      }
    }]
  }]
}
```

### Detail Page (ObjectHeader + KeyValue)

```json
{
  "_Name": "Products_Detail",
  "_Type": "Page",
  "Caption": "{i18n>Products_Detail_Caption}",
  "ActionBar": { "Items": [
    { "Image": "sap-icon://edit", "Position": "Right", "OnPress": "/AppName/Actions/Products/NavToProducts_Edit.action" }
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
          "DetailImageIsCircular": false
        }
      },
      {
        "_Name": "SectionKeyValue0",
        "_Type": "Section.Type.KeyValue",
        "Header": { "Caption": "{i18n>Details_Header}", "UseTopPadding": false },
        "KeyAndValues": [
          { "KeyName": "{i18n>Name_Label}", "Value": "{Name}" },
          { "KeyName": "{i18n>Category_Label}", "Value": "{Category}" },
          { "KeyName": "{i18n>Price_Label}", "Value": "$(N,{Price},'',{minimumFractionDigits:2})" }
        ],
        "Layout": { "NumberOfColumns": 2 }
      }
    ]
  }]
}
```

### Create/Edit Page (FormCell)

```json
{
  "_Name": "Products_Create",
  "_Type": "Page",
  "Caption": "{i18n>Products_Create_Caption}",
  "ActionBar": { "Items": [
    { "SystemItem": "Cancel", "Position": "Left", "OnPress": "/AppName/Actions/CancelPage.action" },
    { "Caption": "{i18n>Save_Button}", "Position": "Right", "OnPress": "/AppName/Actions/Products/Products_CheckRequiredFields.action" }
  ]},
  "Controls": [{
    "_Name": "SectionedTable0",
    "_Type": "Control.Type.SectionedTable",
    "Sections": [{
      "_Name": "FormCellSection0",
      "_Type": "Section.Type.FormCell",
      "Controls": [
        { "_Name": "Name",     "_Type": "Control.Type.FormCell.SimpleProperty", "Caption": "{i18n>Name_Label}",     "IsEditable": true, "IsRequired": true, "PlaceHolder": "{i18n>Name_Placeholder}" },
        { "_Name": "Status",   "_Type": "Control.Type.FormCell.ListPicker",     "Caption": "{i18n>Status_Label}",   "IsEditable": true, "AllowMultipleSelection": false, "Items": "/AppName/Rules/Products/GetStatusItems.js" },
        { "_Name": "Active",   "_Type": "Control.Type.FormCell.Switch",         "Caption": "{i18n>Active_Label}",   "IsEditable": true, "Value": true },
        { "_Name": "DueDate",  "_Type": "Control.Type.FormCell.DatePicker",     "Caption": "{i18n>DueDate_Label}",  "IsEditable": true, "Mode": "Date" },
        { "_Name": "Note",     "_Type": "Control.Type.FormCell.Note",           "Caption": "{i18n>Note_Label}",     "IsEditable": true, "PlaceHolder": "{i18n>Note_Placeholder}" }
      ]
    }]
  }]
}
```

---

## Action Templates

### CreateEntity Action

```json
{
  "_Type": "Action.Type.ODataService.CreateEntity",
  "ActionResult": { "_Name": "createProduct" },
  "Properties": {
    "Name":   "#Control:Name/#Value",
    "Status": "#Control:Status/#SelectedValue",
    "Active": "#Control:Active/#Value"
  },
  "Target": { "EntitySet": "Products", "Service": "/AppName/Services/SampleService.service" },
  "OnSuccess": "/AppName/Actions/Products/Products_CreateSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_CreateFailed.action"
}
```

### UpdateEntity Action

```json
{
  "_Type": "Action.Type.ODataService.UpdateEntity",
  "ActionResult": { "_Name": "updateProduct" },
  "Properties": { "Name": "#Control:Name/#Value", "Status": "#Control:Status/#SelectedValue" },
  "Target": { "EntitySet": "Products", "ReadLink": "{@odata.readLink}", "Service": "/AppName/Services/SampleService.service" },
  "OnSuccess": "/AppName/Actions/Products/Products_UpdateSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_UpdateFailed.action"
}
```

### DeleteEntity with Confirmation

```json
{
  "_Type": "Action.Type.Message",
  "Title": "{i18n>Delete_Title}",
  "Message": "{i18n>Delete_Confirmation}",
  "OKCaption": "{i18n>Delete_Button}",
  "CancelCaption": "{i18n>Cancel_Button}",
  "OnOK": "/AppName/Actions/Products/Products_DeleteEntity.action"
}
```

```json
{
  "_Type": "Action.Type.ODataService.DeleteEntity",
  "ActionResult": { "_Name": "deleteProduct" },
  "Target": { "EntitySet": "Products", "ReadLink": "{@odata.readLink}", "Service": "/AppName/Services/SampleService.service" },
  "OnSuccess": "/AppName/Actions/Products/Products_DeleteSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_DeleteFailed.action"
}
```

### Navigation Action

```json
{ "_Type": "Action.Type.Navigation", "PageToOpen": "/AppName/Pages/Products/Products_Detail.page" }
```

Modal (Create/Edit):
```json
{ "_Type": "Action.Type.Navigation", "PageToOpen": "/AppName/Pages/Products/Products_Create.page", "ModalPage": true, "ModalPageFullscreen": true }
```

### CheckRequiredFields (chain before save)

```json
{
  "_Type": "Action.Type.CheckRequiredFields",
  "PageToCheck": "#Page:Products_Create",
  "OnSuccess": "/AppName/Actions/Products/Products_CreateEntity.action",
  "OnFailure": "/AppName/Actions/ValidationFailed.action"
}
```

### ToastMessage (Success/Failure)

```json
{ "_Type": "Action.Type.ToastMessage", "Message": "{i18n>CreateSuccess_Message}", "Duration": 3, "Animated": true, "OnSuccess": "/AppName/Actions/ClosePage.action" }
```

```json
{ "_Type": "Action.Type.ToastMessage", "Message": "{{#ActionResults:createProduct/#Property:error}}", "Duration": 5, "Animated": true }
```

---

## Offline Action Templates

### InitializeOfflineOData

```json
{
  "_Type": "Action.Type.OfflineOData.Initialize",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "_ODataInitialize" },
  "ShowActivityIndicator": true,
  "ActivityIndicatorText": "{i18n>Initializing_Message}",
  "DefiningRequests": [
    { "Name": "Products", "Query": "Products" },
    { "Name": "Categories", "Query": "Categories?$filter=Active eq true" }
  ],
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/InitializeFailed.action"
}
```

### UploadOfflineOData (before any CRUD)

```json
{
  "_Type": "Action.Type.OfflineOData.Upload",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "sync" },
  "ShowActivityIndicator": true,
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/SyncFailed.action"
}
```

### DownloadOfflineOData

```json
{
  "_Type": "Action.Type.OfflineOData.Download",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "sync" },
  "ShowActivityIndicator": true,
  "OnSuccess": "/AppName/Actions/Service/SyncSuccess.action",
  "OnFailure": "/AppName/Actions/Service/SyncFailed.action"
}
```

---

> For JavaScript rule patterns and clientAPI reference, see `mdk-rules-reference` skill.


## Binding Reference

| Pattern | Use |
|---|---|
| `{PropertyName}` | OData property from current binding |
| `{@odata.readLink}` | OData read link (Update/Delete Target) |
| `{i18n>KeyName}` | Localized string |
| `#Control:Name/#Value` | SimpleProperty, Switch, DatePicker, Note value |
| `#Control:Name/#SelectedValue` | ListPicker selected value |
| `{{#ActionResults:name/#Property:error}}` | Action failure error message |
| `/AppName/Rules/Name.js` | Rule reference |
| `$(N,{Price},'',{minimumFractionDigits:2})` | Number format |
| `$(D,{Date},'',{format:'medium'})` | Date format |

---

## i18n Key Naming Convention

```properties
Products_List_Caption=Products
Products_Detail_Caption=Product Details
Products_Create_Caption=Create Product
Name_Label=Name
Status_Label=Status
Price_Label=Price
Name_Placeholder=Enter name
Save_Button=Save
Cancel_Button=Cancel
Delete_Button=Delete
Delete_Title=Confirm Delete
Delete_Confirmation=Are you sure you want to delete this record?
CreateSuccess_Message=Record created successfully
NoItems=No items found
Search_Placeholder=Search
Details_Header=Details
Initializing_Message=Initializing...
```

---

## Project Operations (CLI)

```bash
# Validate schema — always first
npx @sap/mdk-tools validate --project <projectDir>

# Build bundle
npx @sap/mdk-tools build --target zip --project <projectDir>

# Deploy to Mobile Services (requires cf login --sso + .service.metadata)
npx @sap/mdk-tools deploy --target mobile --showqr --project <projectDir>

# Migrate schema version
npx @sap/mdk-tools migrate --project <projectDir>
```

QR code saved to `.build/qrcode.png` — open in VS Code Explorer to scan.

---

## Best Practices Checklist

- [ ] All `_Name` match filename without extension
- [ ] All OData actions have `OnSuccess` + `OnFailure`
- [ ] `OnFailure` uses `{{#ActionResults:name/#Property:error}}`
- [ ] Delete has `Message` confirmation dialog before delete action
- [ ] Create/Edit navigation uses `ModalPage: true, ModalPageFullscreen: true`
- [ ] All list pages: `Search.Enabled: true` + `EmptySection`
- [ ] All detail pages: start with `ObjectHeader` + `DataSubscriptions`
- [ ] No hardcoded strings — all `{i18n>Key}`
- [ ] `$top` set on all ObjectTable QueryOptions
- [ ] Offline: Upload before CRUD → Download after Upload


---

## Quick Reference — Best Practices

## 8. Performance

### ✅ DO: Paginate all lists with `$top`

```json
"QueryOptions": "$top=20&$orderby=Name asc"
```

### ✅ DO: Use `$select` to limit payload on list pages

```json
"QueryOptions": "$top=20&$select=ProductId,Name,Status,Price&$orderby=Name asc"
```
On detail pages load the full entity. On list pages load only what the ObjectCell displays.

### ✅ DO: Use `MinimumCharacterThreshold: 3` on Search

```json
"Search": { "Enabled": true, "Delay": 500, "MinimumCharacterThreshold": 3 }
```
This prevents a search query firing on every keystroke.

### ✅ DO: Return early from rules when data is missing

```js
export default function StatusColor(clientAPI) {
  if (!clientAPI.binding) return '#6A6D70'; // early return — grey default
  switch (clientAPI.binding.Status) { ... }
}
```

### ❌ DON'T: Call `clientAPI.read()` in rules that run per-row (ObjectCell bindings)

```js
// ❌ This fires one OData read per row in the list — extremely slow
"ObjectCell": {
  "StatusText": "/App/Rules/GetStatusFromOData.js"  // called per row!
}

// ✅ Read data once in OnLoaded or use binding properties directly
"ObjectCell": {
  "StatusText": "{Status}"  // binding — zero extra reads
}
```

---


## 9. Security

### ✅ DO: Never store sensitive data in `clientData` or `AppSettings`

`AppSettings` (NativeScript) persists to device storage. Don't store passwords,
tokens, or PII in `appSettingsModule.setString()`.

### ✅ DO: Rely on SAP Mobile Services for authentication

MDK authentication (SSO, OAuth, passcode) is configured in Mobile Services, not
in MDK metadata. Don't implement custom auth in rules.

### ✅ DO: Use `VerifyPasscode` action before sensitive operations

```json
{
  "_Type": "Action.Type.VerifyPasscode",
  "OnSuccess": "/App/Actions/SensitiveOperation.action"
}
```

### ❌ DON'T: Put service credentials in metadata files

OData service destinations are defined in SAP Mobile Services and referenced by
destination name — never hardcode URLs, credentials, or tokens in metadata.

---


## 10. Code Review Checklist

Before raising a pull request or deploying, verify:

**Metadata**
- [ ] All `_Name` values match their filename (no extension)
- [ ] Every OData action has `OnSuccess` and `OnFailure`
- [ ] `OnFailure` shows `{{#ActionResults:name/#Property:error}}`
- [ ] Delete operations preceded by a `Message` confirmation dialog
- [ ] Create/Edit navigation uses `ModalPage: true, ModalPageFullscreen: true`
- [ ] All list pages have `Search` enabled and `EmptySection` set
- [ ] All detail pages start with `ObjectHeader` and have `DataSubscriptions`
- [ ] No hardcoded strings — all user-visible text uses `{i18n>Key}`
- [ ] `$top` set on all ObjectTable QueryOptions

**Rules**
- [ ] All rules use `export default function`
- [ ] All rules return a value or Promise
- [ ] All `.catch()` blocks log the error and return a safe default
- [ ] No `async/await` — Promise chains only
- [ ] ListPicker rules return `[{ ReturnValue, DisplayValue }]`
- [ ] No OData reads inside per-row bindings

**Offline (if applicable)**
- [ ] Upload before every Create/Update/Delete
- [ ] Download chained after Upload success
- [ ] `ShowActivityIndicator: true` on Initialize, Upload, Download
- [ ] `DefiningRequests` filtered — not syncing full entity sets

**i18n**
- [ ] All keys referenced in metadata exist in `i18n.properties`
- [ ] No orphaned keys in `i18n.properties`

**Before deploy**
- [ ] `npx @sap/mdk-tools validate --project .` passes with 0 errors
