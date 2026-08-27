# MDK Sync Collision Handling — Code Reference

*Part of the mdk-offline-resilience skill. Use to implement conflict resolution action chains in your MDK offline app.*

## Collision Action Templates

### Complete Conflict Handler Chain

```
UploadOfflineOData
  └─ OnFailure → SyncConflict_Rule (detect type)
                    ├─ 409/412 → SyncConflict_Dialog (offer choice)
                    │              ├─ OK → UndoPendingChanges → DownloadOfflineOData
                    │              └─ Cancel → SyncFailed_Banner (keep local, retry later)
                    ├─ 404     → UndoPendingChanges → DownloadOfflineOData
                    └─ other   → SyncFailed_Banner
```

### UndoPendingChanges Action

```json
{
  "_Type": "Action.Type.OfflineOData.UndoPendingChanges",
  "_Name": "UndoPendingChanges",
  "Service": "/AppName/Services/SampleService.service",
  "ActionResult": { "_Name": "undoResult" },
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/UndoFailed.action"
}
```

### ClearOfflineOData (last resort)

```json
{
  "_Type": "Action.Type.OfflineOData.Clear",
  "_Name": "ClearOfflineOData",
  "Service": "/AppName/Services/SampleService.service",
  "OnSuccess": "/AppName/Actions/Service/InitializeOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/ClearFailed.action"
}
```

Always precede with confirmation:
```json
{
  "_Type": "Action.Type.Message",
  "_Name": "ConfirmClear",
  "Title": "{i18n>ClearStore_Title}",
  "Message": "{i18n>ClearStore_Warning}",
  "OKCaption": "{i18n>ClearAndReset_Button}",
  "CancelCaption": "{i18n>Cancel_Button}",
  "OnOK": "/AppName/Actions/Service/ClearOfflineOData.action"
}
```

## i18n Keys for Conflict Handling

```properties
SyncConflict_Title=Sync Conflict
SyncConflict_Message=Your local changes conflict with updates made by another user. Discard your local changes and get the latest data?
DiscardChanges_Button=Discard My Changes
KeepChanges_Button=Keep My Changes
ClearStore_Title=Reset Offline Data
ClearStore_Warning=This will permanently delete all unsynced local changes and reset the offline store. This cannot be undone. Continue?
ClearAndReset_Button=Clear and Reset
SyncFailed_Title=Sync Failed
RetrySync_Button=Retry
```

## Error Code Quick Reference

| HTTP Code | MDK Meaning | Recovery |
|---|---|---|
| 409 Conflict | ETag mismatch — concurrent edit | UndoPendingChanges or retry after download |
| 412 Precondition Failed | Conditional update failed | UndoPendingChanges or retry after download |
| 404 Not Found | Entity deleted on server | UndoPendingChanges for that operation |
| 413 Payload Too Large | Upload batch too large | Chunk uploads, reduce batch size |
| 503 Service Unavailable | Mobile Services overloaded | Retry with exponential backoff |
| NETWORK_TIMEOUT | Request timed out | Retry on better connectivity |
