---
name: mdk-offline-resilience
version: 0.4.0
description: >
  Use when building MDK offline apps and need to implement conflict resolution,
  resilient sync action chains, DefiningRequests performance tuning, or graceful
  sync failure handling in code. Trigger on: "how do I handle sync conflicts",
  "write a conflict resolution action", "UndoPendingChanges", "implement retry
  logic", "DefiningRequests best practices", "offline sync performance", "how to
  handle 409 conflict in MDK", "prevent sync collisions", "large DefiningRequests
  timeout", "implement delta sync", "how to show sync progress", "offline queue
  best practices", "build resilient offline MDK app", "handle upload failure",
  "undo pending changes action", "ClearOfflineOData when to use", "exponential
  backoff MDK", "network-aware sync", "split DefiningRequests", "pending changes
  counter", "413 payload too large fix", "Mobile Services timeout configuration".
source: SAP MDK offline OData documentation + SAP Mobile Services best practices
---

# MDK Offline App Resilience — Development Patterns

How to **build** MDK offline apps that handle sync queue collisions and large
payload timeouts gracefully. These are development patterns — action chains,
rules, and DefiningRequest configurations to write into your app.

---

## Part 1 — Sync Queue Collisions

### What Is a Queue Collision (and how to code for it)

A collision occurs when the local offline store has **pending changes that conflict
with the server state** at the time of upload. Build your action chains to handle
all of these cases:

| Cause | Example |
|---|---|
| Two users edit the same record offline | User A and User B both edit WorkOrder W-001 while offline |
| Record deleted on server while user has local edits | Admin deletes a customer, field worker tries to update them |
| ETag mismatch | Server entity was updated between last download and current upload |
| Stale DefiningRequest data | Upload references an entity that no longer matches the filter |
| Network interruption mid-upload | Partial upload leaves queue in inconsistent state |

### Reading Collision Errors in OnFailure Rules

Wire `UploadOfflineOData.OnFailure` to a rule that reads the error code and dispatches
to the right recovery action. Error codes to handle:

| Error | Meaning |
|---|---|
| `HTTP 409 Conflict` | ETag mismatch — entity changed on server since last sync |
| `HTTP 412 Precondition Failed` | Conditional update failed — version conflict |
| `HTTP 404 Not Found` | Entity deleted on server, local pending update/delete references it |
| `SYNC_ERROR` | General sync failure — check `result.error.message` |

Read the error in `OnFailure` rule:
```javascript
export default function SyncFailedDetails(clientAPI) {
  const result = clientAPI.getActionResult('sync');
  if (result && result.error) {
    const code    = result.error.responseCode;
    const body    = result.error.responseBody;
    const message = result.error.message;
    if (code === 409 || code === 412) return `Conflict: ${body}`;
    if (code === 404) return `Record deleted on server: ${message}`;
    return `Sync error (${code}): ${message}`;
  }
  return 'Unknown sync failure';
}
```

### Implementing Collision Resolution — Action Chains to Build

#### Strategy 1 — UndoPendingChanges (discard local, take server)

Use when server wins and local changes should be discarded:

```json
{
  "_Type": "Action.Type.Message",
  "_Name": "SyncConflict_Dialog",
  "Title": "{i18n>SyncConflict_Title}",
  "Message": "{i18n>SyncConflict_Message}",
  "OKCaption": "{i18n>DiscardChanges_Button}",
  "CancelCaption": "{i18n>KeepChanges_Button}",
  "OnOK": "/AppName/Actions/Service/UndoPendingChanges.action"
}
```

```json
{
  "_Type": "Action.Type.OfflineOData.UndoPendingChanges",
  "_Name": "UndoPendingChanges",
  "Service": "/AppName/Services/SampleService.service",
  "OnSuccess": "/AppName/Actions/Service/DownloadOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/UndoFailed.action"
}
```

#### Strategy 2 — Retry after fresh Download (optimistic)

Force a fresh download then retry upload. Works when the conflict is stale data:

```json
{
  "_Type": "Action.Type.OfflineOData.Download",
  "_Name": "ForceRefresh",
  "Service": "/AppName/Services/SampleService.service",
  "ShowActivityIndicator": true,
  "ActivityIndicatorText": "{i18n>Refreshing_Message}",
  "OnSuccess": "/AppName/Actions/Service/RetryUpload.action",
  "OnFailure": "/AppName/Actions/Service/SyncFailed.action"
}
```

#### Strategy 3 — ClearOfflineOData (nuclear option — last resort)

Clears the entire local store and re-initialises. Use only when the store is
corrupted or all other recovery paths fail:

```json
{
  "_Type": "Action.Type.OfflineOData.Clear",
  "_Name": "ClearOfflineOData",
  "Service": "/AppName/Services/SampleService.service",
  "OnSuccess": "/AppName/Actions/Service/InitializeOfflineOData.action",
  "OnFailure": "/AppName/Actions/Service/ClearFailed.action"
}
```

⚠️ This destroys ALL pending local changes. Always show a confirmation dialog
with explicit warning before calling this.

#### Strategy 4 — Selective conflict detection rule

Detect conflict type before deciding strategy:

```javascript
export default function HandleSyncConflict(clientAPI) {
  const result = clientAPI.getActionResult('sync');
  if (!result || !result.error) return Promise.resolve();

  const code = result.error.responseCode;

  if (code === 409 || code === 412) {
    // ETag conflict — offer user choice: discard or keep
    return clientAPI.executeAction('/AppName/Actions/Service/SyncConflict_Dialog.action');
  }
  if (code === 404) {
    // Entity gone from server — safe to undo that specific change
    return clientAPI.executeAction('/AppName/Actions/Service/UndoPendingChanges.action');
  }
  // Unknown error — show details, let user decide
  return clientAPI.executeAction('/AppName/Actions/Service/SyncFailed_Banner.action');
}
```

### Preventing Collisions

**Rule 1: Always Upload before Download before CRUD**
```
User action → UploadOfflineOData → DownloadOfflineOData → CreateEntity/UpdateEntity/DeleteEntity
```
Never skip Upload before a write — stale local data against a changed server guarantees conflicts.

**Rule 2: Filter DefiningRequests tightly**
```json
"DefiningRequests": [
  { "Name": "MyWorkOrders", "Query": "WorkOrders?$filter=AssignedTo eq '${currentUser}' and Status ne 'Closed'" }
]
```
Syncing only the records a specific user owns dramatically reduces collision surface.

**Rule 3: Use ETags**
Ensure your OData service returns `@odata.etag` on entities. MDK uses ETags
automatically for conditional updates. Without ETags, the server cannot detect
concurrent edits.

**Rule 4: Lock records on open (if business process allows)**
Use an `UpdateEntity` action to set a "locked by" field when the user opens an
edit form, and release it on cancel/save. Prevents concurrent edits at the
application layer.

**Rule 5: Short offline windows**
The longer users work offline, the higher the collision risk. Show `SyncRequired`
banners when connectivity is restored to encourage frequent sync:
```javascript
export default function CheckConnectivity(clientAPI) {
  const net = clientAPI.nativescript.connectivityModule;
  return net.getConnectionType() !== 0; // 0 = offline
}
```

---

## Part 2 — Large Payload Timeouts

### Root Causes to Design Against

Understand these before writing your DefiningRequests:

| Cause | Threshold (typical) |
|---|---|
| DefiningRequests syncing too many records | > 10,000 rows |
| No `$top` filter on DefiningRequests | Unbounded entity sets |
| Binary/attachment data in sync | Images, PDFs in OData stream |
| Slow Mobile Services conduit | > 30s response on weak networks |
| Too many entity sets in one Initialize | > 5-6 large entity sets |
| Upload of large ChangeSet | Batch of 500+ pending operations |

### How timeouts manifest at runtime (design your error handling for these)

- `InitializeOfflineOData` times out on first launch
- `DownloadOfflineOData` times out on slow networks
- App shows spinner indefinitely then `OnFailure`
- `NETWORK_TIMEOUT` or `REQUEST_TIMEOUT` in error body
- Upload of many records fails with `413 Payload Too Large`

### Fix 1 — Add `$top` to all DefiningRequests

```json
"DefiningRequests": [
  { "Name": "RecentOrders",   "Query": "WorkOrders?$top=200&$filter=Status ne 'Closed'&$orderby=DueDate desc" },
  { "Name": "ActiveCustomers","Query": "Customers?$top=500&$filter=Active eq true" },
  { "Name": "Categories",     "Query": "Categories?$top=100" }
]
```

**Rule:** Every DefiningRequest must have `$top`. No exceptions in production.

### Fix 2 — Split large Initialize into chunks with RemoveDefiningRequest

Download critical data first, then add secondary data sets progressively:

```json
{
  "_Type": "Action.Type.OfflineOData.Initialize",
  "_Name": "InitializeCritical",
  "DefiningRequests": [
    { "Name": "MyWorkOrders", "Query": "WorkOrders?$top=50&$filter=AssignedTo eq '${me}' and Status eq 'Open'" }
  ],
  "OnSuccess": "/AppName/Actions/Service/DownloadCritical.action"
}
```

Then add secondary entity sets after the app is usable:
```json
{
  "_Type": "Action.Type.OfflineOData.AddDefiningRequest",
  "_Name": "AddSecondaryData",
  "Service": "/AppName/Services/SampleService.service",
  "DefiningRequests": [
    { "Name": "Equipment", "Query": "Equipment?$top=200" }
  ],
  "OnSuccess": "/AppName/Actions/Service/DownloadSecondary.action"
}
```

### Fix 3 — Delta sync (incremental download)

Instead of re-syncing all records, sync only what changed since last download.
Requires the OData service to support delta tokens (`$deltatoken`):

```json
{ "Name": "WorkOrdersDelta", "Query": "WorkOrders?$deltatoken=lastSync" }
```

Or use a `ModifiedAt` filter:
```json
{ "Name": "RecentChanges", "Query": "WorkOrders?$filter=ModifiedAt gt ${lastSyncTime}" }
```

Store `lastSyncTime` in app settings:
```javascript
// After successful download:
export default function SaveLastSyncTime(clientAPI) {
  const appSettings = clientAPI.nativescript.appSettingsModule;
  appSettings.setString('lastSyncTime', new Date().toISOString());
  return Promise.resolve();
}

// In DefiningRequest query:
export default function GetDeltaQuery(clientAPI) {
  const appSettings = clientAPI.nativescript.appSettingsModule;
  const lastSync = appSettings.getString('lastSyncTime', '2020-01-01T00:00:00Z');
  return `WorkOrders?$filter=ModifiedAt gt ${lastSync}&$top=500`;
}
```

### Fix 4 — ShowActivityIndicator with progress messages (26.6+)

Prevent perceived timeout by showing progress during long sync operations.
Available from schema version 26.6:

```json
{
  "_Type": "Action.Type.OfflineOData.Initialize",
  "_Name": "InitializeOfflineOData",
  "ShowActivityIndicator": true,
  "ActivityIndicatorText": "{i18n>Initializing_Message}",
  "ProgressMessages": {
    "BuildingEntityStore":    "{i18n>Building_Store_Progress}",
    "DownloadingEntityStore": "{i18n>Downloading_Progress}",
    "LoadingMetadata":        "{i18n>Loading_Metadata_Progress}"
  }
}
```

```properties
# i18n.properties
Initializing_Message=Setting up offline storage...
Building_Store_Progress=Building local data store ({0}/{1} steps)...
Downloading_Progress=Downloading records ({0} of {1})...
Loading_Metadata_Progress=Loading service metadata ({0}/{1})...
```

Placeholders: `{0}` = current step, `{1}` = total steps.

### Fix 5 — Upload chunking for large pending queues

If users accumulate hundreds of pending changes, batch them:

```javascript
export default function GetUploadBatchSize(clientAPI) {
  // Limit upload to 50 operations per sync cycle
  // Chain multiple uploads until queue is empty
  const pending = clientAPI.getBindingObject();
  return pending && pending.length > 0;
}
```

Wire `UploadOfflineOData` with a loop action that checks remaining operations:
```json
{
  "_Type": "Action.Type.OfflineOData.Upload",
  "_Name": "UploadOfflineOData",
  "Service": "/AppName/Services/SampleService.service",
  "OnSuccess": "/AppName/Actions/Service/CheckRemainingOperations.action"
}
```

```json
{
  "_Type": "Action.Type.Condition",
  "_Name": "CheckRemainingOperations",
  "Condition": "/AppName/Rules/Service/HasPendingOperations.js",
  "OnTrue": "/AppName/Actions/Service/UploadOfflineOData.action",
  "OnFalse": "/AppName/Actions/Service/DownloadOfflineOData.action"
}
```

### Fix 6 — Mobile Services timeout configuration

If the server-side timeout is too short, configure it in Mobile Services:

1. BTP Cockpit → Mobile Services → your app → Mobile Connectivity
2. Select the destination → Edit
3. Set **Connection Timeout** and **Read Timeout** to appropriate values
   (recommend: Connection = 60s, Read = 120s for large payloads)

For `413 Payload Too Large` — contact your OData service admin to increase
the server's maximum request body size.

---

## Part 3 — Resilience Patterns

### Exponential Backoff Retry Rule

```javascript
export default function SyncWithRetry(clientAPI) {
  const appSettings = clientAPI.nativescript.appSettingsModule;
  let retries = parseInt(appSettings.getString('syncRetries', '0'), 10);

  if (retries >= 3) {
    appSettings.setString('syncRetries', '0');
    return clientAPI.executeAction('/AppName/Actions/Service/SyncFailed_Final.action');
  }

  appSettings.setString('syncRetries', String(retries + 1));
  const delay = Math.pow(2, retries) * 1000; // 1s, 2s, 4s

  return new Promise(resolve => setTimeout(resolve, delay))
    .then(() => clientAPI.executeAction('/AppName/Actions/Service/UploadOfflineOData.action'));
}
```

### Network-Aware Sync Rule

Only upload when connected — avoid queuing upload actions on offline network:

```javascript
export default function SyncIfOnline(clientAPI) {
  const net = clientAPI.nativescript.connectivityModule;
  const type = net.getConnectionType();
  if (type === 0) {
    // Offline — show toast, do not attempt upload
    return clientAPI.executeAction('/AppName/Actions/Service/OfflineNotice.action');
  }
  return clientAPI.executeAction('/AppName/Actions/Service/UploadOfflineOData.action');
}
```

### Pending Operations Counter (list footer badge)

Show users how many unsynced changes they have:

```javascript
export default function PendingCount(controlProxy) {
  const svc = '/AppName/Services/SampleService.service';
  return controlProxy.count(svc, 'WorkOrders', '$filter=__pending__ eq true')
    .then(n => n > 0 ? `${n} unsynced changes` : 'All synced')
    .catch(() => '');
}
```

---

## Development Checklist — Before Releasing an Offline MDK App

- [ ] All DefiningRequests have `$top` limits
- [ ] `UploadOfflineOData` called before every Create, Update, Delete
- [ ] `OnFailure` on `UploadOfflineOData` calls a conflict-detection rule
- [ ] `UndoPendingChanges` available to users as a recovery action
- [ ] Confirmation dialog shown before `UndoPendingChanges` and `ClearOfflineOData`
- [ ] `ShowActivityIndicator: true` on Initialize, Upload, Download
- [ ] ProgressMessages configured (schema 26.6+)
- [ ] Delta sync or `ModifiedAt` filter used where backend supports it
- [ ] Network connectivity checked before initiating upload
- [ ] Mobile Services timeout values appropriate for payload sizes
