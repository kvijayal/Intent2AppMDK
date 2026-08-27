# MDK Schema Change Update Reference

*Part of the mdk-app-update skill. Use when the OData service schema changes
and existing devices have an offline store built on the old schema.*

## The Problem

When you add/remove entity sets, change property types, or restructure
navigation properties in your OData service, the offline SQLite store on
devices still has the old schema. The new MDK bundle that references new
entity properties will fail against the stale store.

## Decision Matrix

| Change type | Offline store impact | Required action in OnDidUpdate |
|---|---|---|
| New optional property added | Compatible | Re-open store (no clear needed) |
| Property renamed | Breaking | Clear + re-initialize |
| Property type changed | Breaking | Clear + re-initialize |
| Entity set added | Compatible | Add to DefiningRequests + re-open |
| Entity set removed | Breaking | Clear + re-initialize |
| Navigation property changed | Usually breaking | Clear + re-initialize |
| i18n keys changed | None | Nothing |
| Page/action changes only | None | Nothing |

## Safe Update Pattern (no schema change)

```javascript
// OnWillUpdate.js
export default function OnWillUpdate(clientAPI) {
  // No special handling needed for compatible updates
  return Promise.resolve();
}

// OnDidUpdate.js
export default function OnDidUpdate(clientAPI) {
  return clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Initialize",
    "Service": "/YourApp/Services/YourService.service",
    "ShowActivityIndicator": true
  });
}
```

## Breaking Schema Change Pattern

```javascript
// OnWillUpdate.js — Step 1: sync + close store
export default function OnWillUpdate(clientAPI) {
  const svc = '/YourApp/Services/YourService.service';
  return clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Upload",
    "Service": svc,
    "ShowActivityIndicator": true,
    "ActivityIndicatorText": "Syncing before update..."
  })
  .then(() => clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Close",
    "Service": svc
  }))
  .catch(() => {
    // Upload failed but store closed — warn user, proceed anyway
    console.warn('[AppUpdate] Could not sync all pending changes before schema update');
    return Promise.resolve();
  });
}

// OnDidUpdate.js — Step 2: clear old store + re-initialize with new schema
export default function OnDidUpdate(clientAPI) {
  const svc = '/YourApp/Services/YourService.service';
  return clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Clear",
    "Service": svc
  })
  .then(() => clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Initialize",
    "Service": svc,
    "ShowActivityIndicator": true,
    "ActivityIndicatorText": "Setting up updated offline storage...",
    "DefiningRequests": [
      { "Name": "WorkOrders", "Query": "WorkOrders?$top=100&$filter=Status ne 'Closed'" }
    ]
  }))
  .then(() => clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Download",
    "Service": svc,
    "ShowActivityIndicator": true
  }));
}
```

## Gradual Rollout Strategy

When a schema change is too risky to push to all users at once:

1. Deploy new OData service version but keep old version running in parallel
2. Deploy new MDK bundle pointing to new service
3. Test with pilot group (10% of users) enrolled on a QA Mobile Services app
4. After validation, deploy to PROD Mobile Services app
5. Decommission old service version after all devices have updated

## Communicating Schema Updates to Users

Always warn users before a breaking update wipes their local store:

```javascript
export default function OnWillUpdate(clientAPI) {
  return clientAPI.executeAction({
    "_Type": "Action.Type.Message",
    "Title": "Important Update",
    "Message": "This update includes significant data model changes. Your offline data will be refreshed from the server. Please ensure you have a network connection.",
    "OKCaption": "Continue",
    "CancelCaption": "Later"
  }).then(result => {
    if (result?.data === false) return Promise.reject('Postponed');
    // Proceed with sync + close
    return clientAPI.executeAction({
      "_Type": "Action.Type.OfflineOData.Upload",
      "Service": "/YourApp/Services/YourService.service",
      "ShowActivityIndicator": true
    });
  });
}
```
