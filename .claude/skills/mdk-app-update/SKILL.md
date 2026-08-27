---
name: mdk-app-update
version: 0.4.0
description: >
  Use when building MDK app update logic, handling version upgrades on devices,
  implementing OnWillUpdate and OnDidUpdate hooks, managing offline store
  migration across versions, controlling forced updates via Mobile Services,
  setting ApplicationVersion in .project.json, or handling the scenario where
  a new OData service schema breaks an existing app on device. Trigger on:
  "app update", "OnWillUpdate", "OnDidUpdate", "force update", "ApplicationVersion",
  "new version on device", "update not appearing on device", "deploy but app not
  updating", "offline store after update", "schema changed update", "how do devices
  get new version", "rollback update", "update cycle", "version check", "app
  bundle update", "metadata update", "how often does MDK check for updates",
  "update pending", "user must update", "block old version", "X-APP-VERSION",
  "versioning MDK", "AndroidVersionCode", "app version cockpit".
source: SAP Mobile Services documentation — App Update + Application Versioning
---

# MDK App Update Strategy

How MDK apps update on devices, how to control it, and how to handle
breaking changes safely — particularly when the OData service schema changes.

---

## How MDK App Updates Work

MDK updates are **metadata-only** — the bundle.js (compiled metadata) is
deployed to Mobile Services and downloaded to devices. No app store submission
needed for metadata changes.

### The update cycle (automatic)

<cite>The Mobile Development Kit Client triggers the app update process in
three conditions: after launch when the user enters their passcode, after
resuming from background when the user enters their passcode, and while
running in the foreground every 20-25 minutes.</cite>

```
Device launched / resumed / 20-25 min foreground
         ↓
Client checks Mobile Services for latest bundle version
         ↓
Same or older → no action
         ↓
Newer found → download new bundle
         ↓
Trigger OnWillUpdate (your code runs here)
  ├── OnWillUpdate resolved → apply new bundle
  └── OnWillUpdate rejected → skip this cycle, try again next trigger
         ↓
New bundle applied
         ↓
Trigger OnDidUpdate (your code runs here)
  ├── OnDidUpdate resolved → update complete ✅
  └── OnDidUpdate rejected → rollback to previous bundle ↩️
```

### What gets updated

| Component | Updated via MDK deploy | Requires new native client build |
|---|---|---|
| Pages / Actions / Rules / i18n | ✅ MDK deploy only | ❌ No |
| OData service definition | ✅ `.service.metadata` change + deploy | ❌ No |
| Schema version upgrade | ✅ Migrate + deploy | ❌ No |
| NativeScript plugins | ❌ | ✅ New branded client required |
| App icon / splash screen | ❌ | ✅ New branded client required |
| MDK Client SDK version | ❌ | ✅ App Store / MDM update |

---

## Setting the App Version

### In `.project.json`

```json
{
  "ApplicationName": "FieldServiceApp",
  "ApplicationVersion": "2.1.0",
  "SchemaVersion": "26.6",
  "Offline": true
}
```

`ApplicationVersion` must follow semver format: `MAJOR.MINOR.PATCH`.
Increment it on every deploy — Mobile Services compares this to the device's
current version to decide whether to push an update.

### AndroidVersionCode (branded client only)

<cite>You can set `AndroidVersionCode` in `MDKProject.json` to control the
Google Play Store version code. Set to `"Auto"` to auto-generate from
`AppVersion`, or set a specific integer.</cite>

```json
{
  "AndroidVersionCode": "Auto"
}
```

---

## Implementing OnWillUpdate

Wire this in `Application.app` to control what happens before the new bundle loads.

### Application.app

```json
{
  "_Type": "Application",
  "_Name": "FieldServiceApp",
  "OnWillUpdate": "/FieldServiceApp/Rules/AppUpdate/OnWillUpdate.js",
  "OnDidUpdate": "/FieldServiceApp/Rules/AppUpdate/OnDidUpdate.js"
}
```

### OnWillUpdate.js — Basic (auto-apply)

If no `OnWillUpdate` is set, updates apply automatically without prompting.
For silent auto-update, return a resolved promise:

```javascript
export default function OnWillUpdate(clientAPI) {
  // Log the update for analytics
  console.log('[AppUpdate] New version available — applying automatically');
  return Promise.resolve(); // resolved = apply the update
}
```

### OnWillUpdate.js — Prompt user

```javascript
export default function OnWillUpdate(clientAPI) {
  return clientAPI.executeAction({
    "_Type": "Action.Type.Message",
    "Title": clientAPI.localizeText('Update_Title'),
    "Message": clientAPI.localizeText('Update_Message'),
    "OKCaption": clientAPI.localizeText('Update_Now_Button'),
    "CancelCaption": clientAPI.localizeText('Update_Later_Button')
  }).then(result => {
    if (result && result.data === false) {
      // User chose "Later" — reject to postpone this cycle
      return Promise.reject('User postponed update');
    }
    // User chose "Update Now" — resolve to apply
    return Promise.resolve();
  });
}
```

### OnWillUpdate.js — Upload pending changes before update (offline apps)

Critical for offline apps — ensure all local changes are pushed before
the new bundle loads, especially if the OData schema changed:

```javascript
export default function OnWillUpdate(clientAPI) {
  const svc = '/FieldServiceApp/Services/FieldService.service';

  // Check for pending offline operations first
  return clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Upload",
    "Service": svc,
    "ShowActivityIndicator": true,
    "ActivityIndicatorText": clientAPI.localizeText('Syncing_Before_Update')
  }).then(() => {
    // Upload succeeded — safe to apply the update
    console.log('[AppUpdate] Pending changes synced, applying update');
    return Promise.resolve();
  }).catch(err => {
    // Upload failed — warn user, but let them decide
    console.error('[AppUpdate] Sync before update failed:', err);
    return clientAPI.executeAction({
      "_Type": "Action.Type.Message",
      "Title": clientAPI.localizeText('SyncFailed_Title'),
      "Message": clientAPI.localizeText('SyncFailed_Before_Update_Message'),
      "OKCaption": clientAPI.localizeText('Update_Anyway_Button'),
      "CancelCaption": clientAPI.localizeText('Update_Later_Button')
    }).then(result => {
      return result?.data === false
        ? Promise.reject('User postponed after sync failure')
        : Promise.resolve();
    });
  });
}
```

### OnWillUpdate.js — Close offline store before schema migration

<cite>When you heavily change the OData service schema, the current
offline database may be incompatible with the new one. Use `OnWillUpdate`
to close the store, and `OnDidUpdate` to clear and re-initialize it.</cite>

```javascript
export default function OnWillUpdate(clientAPI) {
  const svc = '/FieldServiceApp/Services/FieldService.service';
  // Upload all pending changes before closing store
  return clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Upload",
    "Service": svc,
    "ShowActivityIndicator": true
  }).then(() => clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Close",
    "Service": svc
  })).then(() => {
    console.log('[AppUpdate] Offline store closed, ready for schema update');
    return Promise.resolve();
  });
}
```

---

## Implementing OnDidUpdate

Runs after the new bundle is applied. Use to re-initialize anything that
the old bundle's teardown closed.

### OnDidUpdate.js — Re-initialize offline store after schema change

```javascript
export default function OnDidUpdate(clientAPI) {
  const svc = '/FieldServiceApp/Services/FieldService.service';

  // Read new app version to decide if store reset is needed
  const appSettings = clientAPI.nativescript.appSettingsModule;
  const previousVersion = appSettings.getString('lastAppVersion', '0.0.0');
  const currentVersion  = '2.1.0'; // must match ApplicationVersion in .project.json

  const majorChanged = previousVersion.split('.')[0] !== currentVersion.split('.')[0];

  if (majorChanged) {
    // Major version = schema breaking change — clear and re-initialize store
    console.log('[AppUpdate] Major version change — clearing offline store');
    return clientAPI.executeAction({
      "_Type": "Action.Type.OfflineOData.Clear",
      "Service": svc
    }).then(() => clientAPI.executeAction({
      "_Type": "Action.Type.OfflineOData.Initialize",
      "Service": svc,
      "ShowActivityIndicator": true,
      "ActivityIndicatorText": clientAPI.localizeText('Reinitializing_Store')
    })).then(() => {
      appSettings.setString('lastAppVersion', currentVersion);
      return Promise.resolve();
    });
  }

  // Minor/patch update — just re-open the store, no data wipe needed
  appSettings.setString('lastAppVersion', currentVersion);
  return clientAPI.executeAction({
    "_Type": "Action.Type.OfflineOData.Initialize",
    "Service": svc,
    "ShowActivityIndicator": true
  });
}
```

### OnDidUpdate.js — Minimal (online apps)

```javascript
export default function OnDidUpdate(clientAPI) {
  console.log('[AppUpdate] New version applied successfully');
  // Navigate to main page to refresh UI state
  return clientAPI.executeAction({
    "_Type": "Action.Type.Navigation",
    "PageToOpen": "/FieldServiceApp/Pages/Main.page"
  });
}
```

---

## Forced Update — Block Old Versions

<cite>The Application Versioning module in Mobile Services controls which
versions are allowed. When enabled, it only allows currently active
application versions to run and forces end-users to update. Any request
without the `X-APP-VERSION` header or with an inactive version is rejected
with a 403 status code.</cite>

### How to configure in Mobile Services cockpit

```
BTP Cockpit → Mobile Services → your app
→ Mobile Applications → Features → Application Versioning
→ Enable "Only allow active versions"
→ Set "Minimum Required Version": 2.0.0
→ Save
```

### What happens on device when blocked

Old clients receive `HTTP 403` on every Mobile Services request. The MDK
client shows the user a prompt to update. Handle this gracefully:

```javascript
// In your error handling rule — check for 403 version rejection
export default function HandleServiceError(clientAPI) {
  const result = clientAPI.getActionResult('sync');
  if (result?.error?.responseCode === 403) {
    return clientAPI.executeAction({
      "_Type": "Action.Type.Message",
      "Title": clientAPI.localizeText('AppOutdated_Title'),
      "Message": clientAPI.localizeText('AppOutdated_Message'),
      "OKCaption": clientAPI.localizeText('OK_Button')
      // No OnOK — user must update via app store or MDM
    });
  }
  return Promise.resolve();
}
```

```properties
# i18n.properties
AppOutdated_Title=Update Required
AppOutdated_Message=This version of the app is no longer supported. Please update to continue.
```

---

## Multi-Environment Strategy (Dev / QA / Prod)

Use separate Mobile Services apps per environment — not separate CF spaces
for the same app:

```
Mobile Services: FieldServiceApp-DEV   (appId: com.company.fieldservice.dev)
Mobile Services: FieldServiceApp-QA    (appId: com.company.fieldservice.qa)
Mobile Services: FieldServiceApp-PROD  (appId: com.company.fieldservice.prod)
```

Each has its own `.service.metadata` — developers onboard to DEV app,
testers to QA, field workers to PROD.

Version progression:

```
Deploy to DEV   (ApplicationVersion: 2.1.0-dev)
     ↓ QA testing passes
Deploy to QA    (ApplicationVersion: 2.1.0-rc)
     ↓ UAT passes
Deploy to PROD  (ApplicationVersion: 2.1.0)
```

---

## Version Mismatch Diagnosis

Common symptoms and causes:

| Symptom | Cause | Fix |
|---|---|---|
| Deployed but device not updating | `ApplicationVersion` not incremented | Bump version in `.project.json` and redeploy |
| Update check not happening | App in background >25 min but no passcode | Bring app to foreground or resume from lock screen |
| `OnWillUpdate` never fires | `OnWillUpdate` not wired in `Application.app` | Add `OnWillUpdate` property to `Application.app` |
| Device stuck on old version | `OnWillUpdate` always rejecting | Check rule logic — rejection postpones, never blocks permanently |
| Offline store broken after update | Schema changed without `OnDidUpdate` store reset | Implement `OnDidUpdate` to clear and re-initialize |
| 403 errors after deploy | App version blocked in Mobile Services versioning | Check Application Versioning settings in cockpit |
| BAS deploy fails, VS Code works | Node version mismatch (BAS on Node 22, app built for 20) | Turn off `Mdk: Validate Before Bundle` in VS Code settings or align Node versions |

---

## i18n Keys for Update Flow

```properties
# App Update
Update_Title=App Update Available
Update_Message=A new version of this application is available. Update now for the latest features and improvements.
Update_Now_Button=Update Now
Update_Later_Button=Later
Update_Anyway_Button=Update Anyway
Syncing_Before_Update=Syncing your data before update...
SyncFailed_Title=Sync Failed
SyncFailed_Before_Update_Message=Could not sync pending changes before update. Update anyway or try again later?
Reinitializing_Store=Setting up offline storage...
AppOutdated_Title=Update Required
AppOutdated_Message=This version is no longer supported. Please update to continue.
```
