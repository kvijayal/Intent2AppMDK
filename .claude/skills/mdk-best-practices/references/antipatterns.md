# MDK Anti-Patterns

*Part of the mdk-best-practices skill.*

These are the most common mistakes in MDK projects. Each entry shows the wrong
pattern, the right pattern, and why it matters.

## 1. Hardcoded strings in metadata

```json
// ❌ Wrong
"Caption": "Products List"

// ✅ Correct
"Caption": "{i18n>Products_List_Caption}"
```
Why: Hardcoded strings break localization and fail the validator's i18n check.

## 2. Missing OnFailure on OData actions

```json
// ❌ Wrong — no error handling
{ "_Type": "Action.Type.ODataService.CreateEntity",
  "OnSuccess": "/AppName/Actions/CreateSuccess.action" }

// ✅ Correct
{ "_Type": "Action.Type.ODataService.CreateEntity",
  "ActionResult": { "_Name": "createProduct" },
  "OnSuccess": "/AppName/Actions/Products/CreateSuccess.action",
  "OnFailure": "/AppName/Actions/Products/CreateFailed.action" }
```
Why: Silent failures confuse users; backend errors are never shown.

## 3. OnFailure without error binding

```json
// ❌ Wrong — generic message, no backend error shown
{ "_Type": "Action.Type.ToastMessage",
  "Message": "{i18n>Error_Message}" }

// ✅ Correct
{ "_Type": "Action.Type.ToastMessage",
  "Message": "{{#ActionResults:createProduct/#Property:error}}" }
```
Why: Users and developers need the actual backend error message to diagnose issues.

## 4. ListPicker binding with /#Value instead of /#SelectedValue

```json
// ❌ Wrong — returns array ["Open"], not string "Open"
"Status": "#Control:StatusPicker/#Value"

// ✅ Correct
"Status": "#Control:StatusPicker/#SelectedValue"
```
Why: `/#Value` on a ListPicker returns an array. OData expects a scalar string.

## 5. Delete without confirmation dialog

```json
// ❌ Wrong — destructive action with no warning
"OnPress": "/AppName/Actions/Products/DeleteEntity.action"

// ✅ Correct
"OnPress": "/AppName/Actions/Products/ConfirmDelete.action"
// ConfirmDelete is a Message action that chains to DeleteEntity on OK
```
Why: Accidental deletes with no undo path destroy user data.

## 6. Create/Edit navigation without ModalPage

```json
// ❌ Wrong — breaks back-navigation stack
{ "_Type": "Action.Type.Navigation",
  "PageToOpen": "/AppName/Pages/Products/Products_Create.page" }

// ✅ Correct
{ "_Type": "Action.Type.Navigation",
  "PageToOpen": "/AppName/Pages/Products/Products_Create.page",
  "ModalPage": true, "ModalPageFullscreen": true }
```
Why: Without ModalPage, the back button on a create page navigates to the previous
page instead of cancelling — confusing and unintended.

## 7. OData reads per-row in ObjectCell bindings

```json
// ❌ Wrong — fires one read per visible row = O(n) network calls
"ObjectCell": {
  "StatusText": "/AppName/Rules/GetStatusFromOData.js"
}

// ✅ Correct — bind directly to OData property
"ObjectCell": {
  "StatusText": "{Status}"
}
```
Why: Rules in ObjectCell bindings run once per visible row. An OData read per row
makes a list of 20 items fire 20 network calls.

## 8. _Name mismatch

```json
// ❌ Wrong — _Name doesn't match filename
// File: Products_List.page
{ "_Name": "ProductList" }

// ✅ Correct
{ "_Name": "Products_List" }
```
Why: Every cross-reference (NavTo, OnPress, PageToCheck) uses the filename.
A mismatch silently breaks all references.

## 9. async/await in rules

```javascript
// ❌ Wrong — not supported in MDK NativeScript runtime
export default async function GetData(clientAPI) {
  const result = await clientAPI.read(svc, 'Products', [], '');
  return result;
}

// ✅ Correct
export default function GetData(clientAPI) {
  return clientAPI.read(svc, 'Products', [], '').then(result => result);
}
```
Why: The NativeScript runtime used by MDK does not support async/await in user
rules. Use Promise chains.

## 10. Offline sync without UploadOfflineOData before CRUD

```json
// ❌ Wrong — writes directly without pushing pending changes first
"OnOK": "/AppName/Actions/Products/DeleteEntity.action"

// ✅ Correct
"OnOK": "/AppName/Actions/Service/UploadOfflineOData.action"
// UploadOfflineOData OnSuccess → DownloadOfflineOData → then DeleteEntity
```
Why: Without Upload before Delete, the server may have conflicts with unresynced
local changes, causing the delete to fail or create data inconsistency.
