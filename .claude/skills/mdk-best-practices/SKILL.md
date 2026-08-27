---
name: mdk-best-practices
version: 0.4.0
description: >
  Use when asking about MDK development best practices, code quality, architecture
  patterns, performance, security, or common mistakes to avoid. Trigger on: "MDK
  best practices", "how should I structure my MDK app", "is this the right way to",
  "what's the recommended approach for", "MDK anti-patterns", "MDK performance",
  "MDK security", "MDK code review", "MDK architecture", "should I use offline or
  online", "MDK naming conventions", "MDK project structure guidelines".
source: SAP/mdk-mcp-server (Apache-2.0) — res/schemas/, res/templates/
---

# MDK Best Practices

Comprehensive best practices for SAP MDK development — architecture, metadata
authoring, rules, offline, i18n, performance, and security.

---

## 1. Project Structure

### ✅ DO: Use consistent folder structure per entity

Every entity should own its files in named subfolders:

```
Pages/
  Products/
    Products_List.page
    Products_Detail.page
    Products_Create.page
    Products_Edit.page
Actions/
  Products/
    Products_CreateEntity.action
    Products_UpdateEntity.action
    Products_DeleteEntity.action
    Products_CreateSuccess.action
    Products_CreateFailed.action
    ConfirmDelete.action
    NavToProducts_Detail.action
    NavToProducts_Create.action
    NavToProducts_Edit.action
Rules/
  Products/
    Products_StatusColor.js
    Products_IsEditVisible.js
    Products_GetCategoryItems.js
```

### ❌ DON'T: Dump all files in the root folder

```
Pages/
  List.page         ← ambiguous — which entity?
  Detail.page
  Create.page
Actions/
  Create.action     ← conflicts with other entities
```

### ✅ DO: Match `_Name` to filename exactly

```json
{ "_Name": "Products_List" }  → file: Products_List.page  ✅
{ "_Name": "ProductList" }    → file: Products_List.page  ❌ mismatch
```

A `_Name` mismatch breaks every cross-reference to that file silently.

---

## 2. i18n (Internationalization)

### ✅ DO: Use i18n for every user-visible string

```json
"Caption": "{i18n>Products_List_Caption}"      ✅
"Caption": "Products"                           ❌ hardcoded
```

### ✅ DO: Follow consistent key naming

```properties
# Page captions
EntityName_PageType_Caption=...
# Field labels
EntityName_PropertyName_Label=...
# Buttons
Save_Button=Save
Cancel_Button=Cancel
# Messages
EntityName_CreateSuccess_Message=...
# Section headers
EntityName_SectionName_Header=...
# Confirmations
EntityName_Delete_Title=Confirm Delete
EntityName_Delete_Confirmation=Are you sure?
```

### ❌ DON'T: Duplicate keys or create per-action key variants

```properties
Products_Delete_OK=Delete         ✅ shared
Orders_Delete_OK=Delete           ❌ duplicate — reuse Products_Delete_OK
```

### ✅ DO: Use dynamic i18n for parametric messages

```js
// In a rule
clientAPI.localizeText('items_count', [count]);
// In i18n.properties
items_count={0} items found
```

---

## 3. Metadata Authoring

### ✅ DO: Always set `DataSubscriptions` on detail pages

```json
{
  "_Type": "Control.Type.SectionedTable",
  "DataSubscriptions": ["Products", "Categories"]
}
```
Without this, the detail page won't refresh after an edit without a full page reload.

### ✅ DO: Use `Section.Type.ObjectHeader` as the first section on detail pages

```
Detail page structure:
  1. ObjectHeader   ← entity summary (title, subtitle, status, image)
  2. KeyValue       ← read-only key/value properties grouped by theme
  3. ObjectTable    ← related entity navigation properties
```

### ❌ DON'T: Use a flat FormCell section for read-only detail data

```json
// ❌ Wrong — FormCell is for INPUT, not display
{ "_Type": "Section.Type.FormCell", "Controls": [
  { "_Type": "Control.Type.FormCell.SimpleProperty", "IsEditable": false }
]}
// ✅ Correct — KeyValue is for read-only display
{ "_Type": "Section.Type.KeyValue", "KeyAndValues": [...] }
```

### ✅ DO: Set `AccessoryType: "DisclosureIndicator"` on list rows that navigate

```json
"ObjectCell": {
  "AccessoryType": "DisclosureIndicator",  ✅
  "OnPress": "/App/Actions/NavToDetail.action"
}
```

### ✅ DO: Enable `Search` on all list pages

```json
"Search": {
  "Enabled": true,
  "Delay": 500,
  "MinimumCharacterThreshold": 3,
  "Placeholder": "{i18n>Search_Placeholder}",
  "BarcodeScanner": false
}
```

### ✅ DO: Use `EmptySection` on every ObjectTable

```json
"EmptySection": { "Caption": "{i18n>NoItems}" }
```
Without it, an empty list shows a blank screen with no feedback.

### ✅ DO: Use `$top` and `$orderby` in `QueryOptions`

```json
"QueryOptions": "$top=20&$orderby=Name asc"
```
Never load unbounded entity sets — always paginate with `$top`.

---

## 4. Action Chains

### ✅ DO: Always provide `OnSuccess` and `OnFailure`

```json
{
  "_Type": "Action.Type.ODataService.CreateEntity",
  "OnSuccess": "/App/Actions/Products/CreateSuccess.action",
  "OnFailure": "/App/Actions/Products/CreateFailed.action"  ✅
}
```

### ✅ DO: Show the backend error message on failure

```json
{
  "_Type": "Action.Type.ToastMessage",
  "Message": "{{#ActionResults:CreateEntity/#Property:error}}"  ✅
}
```

### ✅ DO: Chain `CheckRequiredFields` before every Create/Update save

```json
{
  "_Type": "Action.Type.CheckRequiredFields",
  "PageToCheck": "#Page:Products_Create",
  "OnSuccess": "/App/Actions/Products/CreateEntity.action",
  "OnFailure": "/App/Actions/ValidationFailed.action"
}
```

### ✅ DO: Confirm destructive operations with a `Message` dialog

```json
{
  "_Type": "Action.Type.Message",
  "Title": "{i18n>Products_Delete_Title}",
  "Message": "{i18n>Products_Delete_Confirmation}",
  "OKCaption": "{i18n>Delete_Button}",
  "CancelCaption": "{i18n>Cancel_Button}",
  "OnOK": "/App/Actions/Products/DeleteEntity.action"
}
```

### ✅ DO: Open create/edit pages as fullscreen modals

```json
{
  "_Type": "Action.Type.Navigation",
  "PageToOpen": "/App/Pages/Products/Products_Create.page",
  "ModalPage": true,
  "ModalPageFullscreen": true
}
```
Opening create/edit as a push navigation breaks the back-navigation stack.

### ✅ DO: Use `ActionResult._Name` on every OData action

```json
{
  "ActionResult": { "_Name": "createProduct" },
  "OnSuccess": "/App/Actions/Products/NavAfterCreate.action"
}
```
Without `_Name`, you cannot reference the result in rules or target paths.

### ❌ DON'T: Nest deep action chains inline — use named action files

```
// ❌ Avoid: all logic in one action file via long OnSuccess chains
// ✅ Better: separate files for each step
CreateEntity.action → CreateSuccess.action → NavToDetail.action
```

---

## 5. Rules

### ✅ DO: Keep rules focused — one concern per rule file

```
Products_StatusColor.js    ← returns color only
Products_IsEditVisible.js  ← returns boolean only
Products_CountItems.js     ← returns count only
```

### ✅ DO: Always return a value

```js
// ❌ void rule — causes silent errors
export default function MyRule(clientAPI) {
  clientAPI.getPageProxy().setCaption('New Caption');
  // missing return
}
// ✅ always return
export default function MyRule(clientAPI) {
  clientAPI.getPageProxy().setCaption('New Caption');
  return Promise.resolve();
}
```

### ✅ DO: Use `.then().catch()` for async — never `async/await`

```js
// ❌ async/await not supported in MDK NativeScript runtime
export default async function GetData(clientAPI) { ... }

// ✅ Promise chain
export default function GetData(clientAPI) {
  return clientAPI.read(service, entitySet, [], queryOptions)
    .then(result => result.getItem(0).Name)
    .catch(() => '');
}
```

### ✅ DO: Log errors — never let catch blocks swallow silently

```js
.catch(err => {
  console.error('MyRule error:', err);  ✅
  return '';
})
```

### ❌ DON'T: Put business logic in metadata — use rules

```json
// ❌ Hardcoded filter in metadata
"QueryOptions": "$filter=Status eq 'Open'"

// ✅ Dynamic filter from a rule (when the value is user-controlled)
"QueryOptions": "/App/Rules/Products/GetActiveFilter.js"
```

### ✅ DO: Use `evaluateTargetPath` to read cross-page control values

```js
const value = clientAPI.evaluateTargetPath(
  '#Page:FilterPage/#Control:StatusPicker/#Value'
);
```

---

## 6. Offline Architecture

### ✅ DO: Decide online vs offline upfront — never mix

Mixing online reads with offline writes in the same app creates conflict resolution
complexity that is very hard to debug. Pick one architecture per app.

### ✅ DO: Follow the strict offline sync order

```
App launch     → InitializeOfflineOData  (once, on first launch)
App resume     → DownloadOfflineOData    (on every open)
Before write   → UploadOfflineOData
After upload   → DownloadOfflineOData    (refresh after push)
```

### ✅ DO: Add `ShowActivityIndicator: true` to sync actions

```json
{
  "_Type": "Action.Type.OfflineOData.Download",
  "ShowActivityIndicator": true,
  "ActivityIndicatorText": "{i18n>Syncing_Message}"
}
```
Without this, the app appears frozen during a slow sync.

### ✅ DO: Use `DefiningRequests` with filters to limit sync scope

```json
"DefiningRequests": [
  { "Name": "ActiveProducts",  "Query": "Products?$filter=Active eq true" },
  { "Name": "OpenOrders",      "Query": "Orders?$filter=Status eq 'Open'" }
]
```
Never sync entire entity sets without filters in production — it will hit quota and performance limits on large datasets.

### ✅ DO: Handle `UndoPendingChanges` on conflict

```json
{
  "_Type": "Action.Type.OfflineOData.UndoPendingChanges",
  "Service": "/App/Services/MyService.service"
}
```
Give users a way to discard conflicting local changes.

### ❌ DON'T: Call CreateEntity/UpdateEntity/DeleteEntity without UploadOfflineOData first

```
// ❌ Wrong — write to local store without syncing pending changes first
Action: DeleteEntity → DownloadOfflineOData

// ✅ Correct
Action: UploadOfflineOData → OnSuccess: DownloadOfflineOData
                                         ↳ Then: DeleteEntity
```

---

## 7. FormCell (Create/Edit Pages)

### ✅ DO: Map OData Edm types to correct FormCell controls

| OData Type | Correct Control | Wrong Control |
|---|---|---|
| `Edm.String` | `FormCell.SimpleProperty` | — |
| `Edm.Boolean` | `FormCell.Switch` | `FormCell.SimpleProperty` ❌ |
| `Edm.DateTime` | `FormCell.DatePicker` | `FormCell.SimpleProperty` ❌ |
| `Edm.Decimal` | `FormCell.SimpleProperty` + `KeyboardType: "Number"` | `FormCell.Switch` ❌ |
| Enum / fixed list | `FormCell.ListPicker` | `FormCell.SimpleProperty` ❌ |
| Long text | `FormCell.Note` | `FormCell.SimpleProperty` ❌ |

### ✅ DO: Mark required fields with `IsRequired: true`

```json
{
  "_Name": "ProductName",
  "_Type": "Control.Type.FormCell.SimpleProperty",
  "IsRequired": true
}
```
Pair with `CheckRequiredFields` action — `IsRequired` alone doesn't block save.

### ❌ DON'T: Make primary key fields editable on create pages

```json
// ❌ Never include primary key as editable FormCell
{ "_Name": "ProductId", "IsEditable": true }

// ✅ Either omit it entirely, or show read-only
{ "_Name": "ProductId", "IsEditable": false }
```

### ✅ DO: Use `#Control:Name/#SelectedValue` for ListPicker in Properties

```json
// ❌ Wrong — #Value on ListPicker returns array, not string
"Properties": { "Category": "#Control:CategoryPicker/#Value" }

// ✅ Correct
"Properties": { "Category": "#Control:CategoryPicker/#SelectedValue" }
```

---

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
