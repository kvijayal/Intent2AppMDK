# MDK Offline OData Patterns

*Part of the mdk-patterns skill.*

## Rules

1. Decide online vs offline upfront — never mix them in the same app
2. Use offline only when user explicitly requests it (field workers, poor connectivity)
3. Offline sync order is strict: Initialize → Download → Upload → Download
4. Always set `ShowActivityIndicator: true` on Initialize, Upload, Download — app appears frozen without it
5. Always filter `DefiningRequests` — never sync full unfiltered entity sets in production
6. Always chain `DownloadOfflineOData` after every `UploadOfflineOData` OnSuccess
7. Wire `UploadOfflineOData` before every Create, Update, Delete action (in CheckRequiredFields OnSuccess and ConfirmDelete OnOK)
8. Provide `UndoPendingChanges` action to let users discard conflicting local changes

## Sync Lifecycle

```
App launch:
  InitializeOfflineOData
    ├── OnSuccess → DownloadOfflineOData
    └── OnFailure → InitializeFailed (BannerMessage)

App resume / manual refresh:
  DownloadOfflineOData
    ├── OnSuccess → SyncSuccess (ToastMessage)
    └── OnFailure → SyncFailed (BannerMessage)

Before Create / Update / Delete:
  UploadOfflineOData
    ├── OnSuccess → DownloadOfflineOData → then CRUD action
    └── OnFailure → SyncFailed (BannerMessage)
```

## InitializeOfflineOData Action

```json
{
  "_Type": "Action.Type.OfflineOData.Initialize",
  "_Name": "InitializeOfflineOData",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "_ODataInit" },
  "ShowActivityIndicator": true,
  "ActivityIndicatorText": "{i18n>Initializing_Message}",
  "DefiningRequests": [
    { "Name": "Products",   "Query": "Products?$filter=Active eq true" },
    { "Name": "Categories", "Query": "Categories" },
    { "Name": "OpenOrders", "Query": "Orders?$filter=Status eq 'Open'" }
  ],
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/InitializeFailed.action"
}
```

## DefiningRequests Best Practices

| Pattern | Query | Why |
|---|---|---|
| Filter by active flag | `Products?$filter=Active eq true` | Reduce sync payload |
| Filter by status | `Orders?$filter=Status eq 'Open'` | Only sync relevant records |
| Limit result set | `Customers?$top=500` | Prevent quota exhaustion |
| Navigation property | `Orders?$expand=Items` | Pre-fetch related data |
| Full set (small) | `Categories` | Only for reference/lookup data |

## Application.app Offline Configuration

```json
{
  "_Type": "Application",
  "_Name": "AppName",
  "MainPage": "/AppName/Pages/Main.page",
  "OnLaunched": "/AppName/Actions/Service/InitializeOfflineOData.action"
}
```

## Wiring UploadOfflineOData Before CRUD

In CheckRequiredFields (Create/Update):
```json
{
  "_Type": "Action.Type.CheckRequiredFields",
  "_Name": "Products_CheckRequired",
  "PageToCheck": "#Page:Products_Create",
  "OnSuccess": "/AppName/Actions/Service/UploadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Products/Products_ValidationFailed.action"
}
```

UploadOfflineOData OnSuccess chains to Download, which then chains to the actual CRUD:
```json
{
  "_Type": "Action.Type.OfflineOData.Upload", "_Name": "UploadOfflineOData",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "sync" },
  "ShowActivityIndicator": true,
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/SyncFailed.action"
}
```

Then DownloadOfflineOData OnSuccess chains to the actual CreateEntity/UpdateEntity/DeleteEntity.

## Anti-Patterns

```
❌ ShowActivityIndicator missing on sync actions → app appears frozen on slow networks
❌ DefiningRequests without filters → syncs entire entity set, hits quota limits
❌ UploadOfflineOData not wired before Create/Update/Delete → local store goes stale
❌ No DownloadOfflineOData after Upload → user sees stale data after their own edit
❌ Mixing online OData reads with offline writes → conflict resolution nightmare
```
