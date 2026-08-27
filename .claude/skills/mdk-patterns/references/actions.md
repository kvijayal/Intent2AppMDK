# MDK Action Patterns

*Part of the mdk-patterns skill.*

## Rules

### All OData Actions
1. Every OData action must have `ActionResult: { "_Name": "resultName" }`
2. Every OData action must have `OnSuccess` and `OnFailure`
3. `OnFailure` ToastMessage must use `"{{#ActionResults:resultName/#Property:error}}"` to show backend error
4. `ShowActivityIndicator: true` on all offline sync actions (Initialize, Upload, Download)

### Create / Update Actions
5. Properties binding: `"#Control:ControlName/#Value"` for SimpleProperty, Switch, DatePicker, Note
6. Properties binding: `"#Control:ControlName/#SelectedValue"` for ListPicker — never `/#Value`
7. `ControlName` in binding must exactly match the control's `_Name` in the page

### Update / Delete Actions
8. Target must include `"ReadLink": "{@odata.readLink}"` — without it the wrong entity is modified
9. Never call DeleteEntity directly — always precede with a `Message` confirmation dialog

### Navigation
10. Create/Edit pages: always `"ModalPage": true, "ModalPageFullscreen": true`
11. Detail pages: plain Navigation with PageToOpen only — no ModalPage
12. After successful Create/Update: chain to `ClosePage` or `CloseModalPage` action

### Action Chains
13. Chain `CheckRequiredFields` before every Create/Update save action
14. Chain `UploadOfflineOData` before Create/Update/Delete in offline apps
15. Chain `DownloadOfflineOData` after every `UploadOfflineOData` success

## CRUD Action Set Pattern

```json
// CreateEntity
{
  "_Type": "Action.Type.ODataService.CreateEntity",
  "_Name": "Products_CreateEntity",
  "ActionResult": { "_Name": "createProduct" },
  "Properties": {
    "Name":     "#Control:Name/#Value",
    "Price":    "#Control:Price/#Value",
    "Active":   "#Control:Active/#Value",
    "Category": "#Control:Category/#SelectedValue"
  },
  "Target": { "EntitySet": "Products", "Service": "/AppName/Services/SampleService.service" },
  "OnSuccess": "/AppName/Actions/Products/Products_CreateSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_CreateFailed.action"
}

// UpdateEntity
{
  "_Type": "Action.Type.ODataService.UpdateEntity",
  "_Name": "Products_UpdateEntity",
  "ActionResult": { "_Name": "updateProduct" },
  "Properties": { "Name": "#Control:Name/#Value", "Price": "#Control:Price/#Value" },
  "Target": {
    "EntitySet": "Products", "ReadLink": "{@odata.readLink}",
    "Service": "/AppName/Services/SampleService.service"
  },
  "OnSuccess": "/AppName/Actions/Products/Products_UpdateSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_UpdateFailed.action"
}

// ConfirmDelete (always before DeleteEntity)
{
  "_Type": "Action.Type.Message", "_Name": "Products_ConfirmDelete",
  "Title": "{i18n>Delete_Title}", "Message": "{i18n>Delete_Confirmation}",
  "OKCaption": "{i18n>Delete_Button}", "CancelCaption": "{i18n>Cancel_Button}",
  "OnOK": "/AppName/Actions/Products/Products_DeleteEntity.action"
}

// DeleteEntity
{
  "_Type": "Action.Type.ODataService.DeleteEntity", "_Name": "Products_DeleteEntity",
  "ActionResult": { "_Name": "deleteProduct" },
  "Target": {
    "EntitySet": "Products", "ReadLink": "{@odata.readLink}",
    "Service": "/AppName/Services/SampleService.service"
  },
  "OnSuccess": "/AppName/Actions/Products/Products_DeleteSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_DeleteFailed.action"
}

// Success Toast (Create/Update — chain to ClosePage)
{
  "_Type": "Action.Type.ToastMessage", "_Name": "Products_CreateSuccess",
  "Message": "{i18n>CreateSuccess_Message}", "Duration": 3, "Animated": true,
  "OnSuccess": "/AppName/Actions/CancelPage.action"
}

// Failure Toast (show backend error)
{
  "_Type": "Action.Type.ToastMessage", "_Name": "Products_CreateFailed",
  "Message": "{{#ActionResults:createProduct/#Property:error}}",
  "Duration": 5, "Animated": true
}

// CheckRequiredFields (chain before save)
{
  "_Type": "Action.Type.CheckRequiredFields", "_Name": "Products_CheckRequired",
  "PageToCheck": "#Page:Products_Create",
  "OnSuccess": "/AppName/Actions/Products/Products_CreateEntity.action",
  "OnFailure": "/AppName/Actions/Products/Products_ValidationFailed.action"
}

// Navigation to Create (modal)
{
  "_Type": "Action.Type.Navigation", "_Name": "NavToProducts_Create",
  "PageToOpen": "/AppName/Pages/Products/Products_Create.page",
  "ModalPage": true, "ModalPageFullscreen": true
}

// Navigation to Detail (push)
{
  "_Type": "Action.Type.Navigation", "_Name": "NavToProducts_Detail",
  "PageToOpen": "/AppName/Pages/Products/Products_Detail.page"
}
```

## Offline Action Pattern

```json
// UploadOfflineOData (before every CRUD — wired in CheckRequiredFields OnSuccess)
{
  "_Type": "Action.Type.OfflineOData.Upload", "_Name": "UploadOfflineOData",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "sync" },
  "ShowActivityIndicator": true, "ActivityIndicatorText": "{i18n>Syncing_Message}",
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/SyncFailed.action"
}
```

## Anti-Patterns

```
❌ Missing ActionResult._Name → can't reference error in OnFailure
❌ OnFailure without {{#ActionResults:name/#Property:error}} → blank error message
❌ DeleteEntity without ConfirmDelete dialog → destructive with no warning
❌ ListPicker binding: "#Control:Name/#Value" → returns array, not string; use /#SelectedValue
❌ Navigation to Create without ModalPage:true → breaks back-navigation stack
❌ UpdateEntity Target missing ReadLink → wrong entity gets updated
```
