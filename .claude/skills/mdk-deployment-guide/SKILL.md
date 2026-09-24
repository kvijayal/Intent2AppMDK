---
name: mdk-deployment-guide
version: 1.0.0
description: >
  Use for all MDK deployment and device update tasks — CF login, Mobile Services
  setup, multi-environment deployment (DEV/QA/PROD), QR code onboarding, CI/CD,
  app version management, and device update lifecycle (OnWillUpdate/OnDidUpdate).
  Trigger on: "deploy MDK", "CF login", "Mobile Services", "QR code", "onboarding",
  "DEV QA PROD", "ApplicationVersion", "OnWillUpdate", "OnDidUpdate", "forced update",
  "app update", "version mismatch", "promote to QA", "promote to PROD", "CI/CD MDK",
  "GitHub Actions MDK", "create Mobile Services app", "destination", "BTP region".
source: Intent2App — merged from mdk-deployment-guide + mdk-deployment-guide + mdk-deployment-guide
---

# MDK Deployment Guide

Covers the full journey from CF login through to device update handling.

---

## Part 1 — CF and Mobile Services Setup

# CF Login & Mobile Services Setup for MDK

The SAP MDK MCP server requires CF CLI authentication and a configured Mobile Services
application. This skill covers everything the SAP server assumes is already done.

---

## Step 1 — CF Login (terminal only)

CF login **cannot happen inside Claude Code chat** — it opens a browser URL for the passcode.
The developer must run this in a separate terminal:

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com --sso
```

### Region selection

| BTP Region | CF API endpoint |
|---|---|
| EU Frankfurt (eu10) | `https://api.cf.eu10.hana.ondemand.com` |
| EU Frankfurt (eu20) | `https://api.cf.eu20.hana.ondemand.com` |
| US East (us10) | `https://api.cf.us10.hana.ondemand.com` |
| US West (us20) | `https://api.cf.us20.hana.ondemand.com` |
| AP Tokyo (jp10) | `https://api.cf.jp10.hana.ondemand.com` |
| AP Singapore (ap10) | `https://api.cf.ap10.hana.ondemand.com` |
| AP Sydney (ap20) | `https://api.cf.ap20.hana.ondemand.com` |
| Trial | `https://api.cf.eu10.hana.ondemand.com` |

**Detect current region:**
```bash
cf target
# Shows: api endpoint, org, space
# api endpoint tells you the region (eu10, us10, etc.)
```

**Verify login:**
```bash
cf target | grep "org:\|space:\|api"
# If this shows org and space → logged in ✅
# If it shows "Not logged in" → run cf login --sso
```

---

## Step 2 — Mobile Services entitlement check

Before creating a Mobile Services app, verify the entitlement exists:

```
BTP Cockpit → your subaccount → Entitlements → Service Assignments
→ Search: "Mobile Services"
→ Must show: SAP Mobile Services (Application Plans: standard or free tier)
```

If missing:
```
BTP Cockpit → subaccount → Entitlements → Configure Entitlements
→ Add Service Plans → Mobile Services → standard → Save
```

---

## Step 3 — Mobile Services app creation

### Option A — VS Code (recommended, visual)
```
Cmd+Shift+P → "MDK: Open Mobile App Editor"
→ Click "+" to create a new app
→ Fill: Application Name, Application ID (e.g. myapp.mdk.demo)
→ Check "Add Mobile Sample OData ESPM" for dev/testing
→ Wait 2-3 minutes for "Started" state
→ Select destination → "Add App to Project"
→ .service.metadata saved automatically
```

### Option B — MCP tool (programmatic)
```
mcp__intent2app__mdk_mobile_services {
  "operation":     "create-app",
  "appName":       "My MDK App",
  "appId":         "com.company.myapp",
  "addEspmSample": true
}
```

### Option C — BTP Cockpit (manual)
```
BTP Cockpit → Mobile Services → Mobile Applications → Native/MDK → New
→ Application Type: Mobile Development Kit Application
→ Fill ID, name → Finish
→ After Started: Features → Mobile Connectivity → New Destination
```

---

## Step 4 — Verify connectivity

```bash
# Confirm CF token works
cf oauth-token

# Check Mobile Services app exists
# (reads ~/.cf/config.json for org/space/token)
# Then run:
mcp__intent2app__mdk_mobile_services { "operation": "list" }
# → should show your app
```

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Not logged in` | CF session expired | `cf login --sso` in terminal |
| `No org targeted` | Wrong API endpoint | `cf login -a https://api.cf.<region>.hana.ondemand.com --sso` |
| `Mobile Services not found` | Wrong space | `cf target -o <org> -s <space>` |
| `401 Unauthorized` from Mobile Services | Token expired | `cf oauth-token` to refresh |
| `App not in list` | Wrong CF space | Switch space: `cf target -s <correct-space>` |
| `ENOTFOUND` on conduit call | Wrong region in admin API URL | Verify `~/.cf/config.json` Target field |
| MDK extension can't connect | CF Tools extension not logged in | VS Code: Cmd+Shift+P → "CF: Login to Cloud Foundry" |

---

## Part 2 — Multi-Environment Deployment

# MDK Multi-Environment Deployment

How to set up dev/QA/prod environments and deploy MDK apps safely across them.

---

## Environment setup — one Mobile Services app per environment

Never share one Mobile Services app across environments. Create separate apps:

```
Mobile Services (CF Space: dev):
  App ID: com.company.myapp.dev     ← developers onboard here
  Destination: WorkOrderService-Dev

Mobile Services (CF Space: qa):
  App ID: com.company.myapp.qa      ← QA testers onboard here
  Destination: WorkOrderService-QA

Mobile Services (CF Space: prod):
  App ID: com.company.myapp         ← field workers onboard here
  Destination: WorkOrderService
```

---

## ApplicationVersion — increment on every deploy

```json
// .project.json
{
  "ApplicationName": "WorkOrderApp",
  "ApplicationVersion": "1.3.0",   ← bump this on every deploy
  "SchemaVersion": "26.6"
}
```

Devices check for updates every 20-25 minutes in foreground.
A higher `ApplicationVersion` triggers automatic bundle download on enrolled devices.

Versioning convention:
```
MAJOR.MINOR.PATCH
  MAJOR → breaking OData schema change (requires OnDidUpdate store reset)
  MINOR → new features / new pages
  PATCH → bug fixes, i18n, style changes
```

---

## Deploy to a specific environment

The bundle (compiled app metadata) is deployed to Mobile Services in SAP BTP.
Each environment is a separate CF space pointing to a separate Mobile Services app.

**Step-by-step for each environment:**

**Step 1 — Bump ApplicationVersion in `.project.json`**
```json
{ "ApplicationVersion": "1.2" }
```
Every deploy must have a higher version than the previous one — devices use this
to know when to download the new bundle.

**Step 2 — Point to the correct environment**

Each environment has its own CF space and its own Mobile Services app ID.
Set the target in `mdk.config.json` (or pass as CLI argument):
```json
{
  "MobileServices": {
    "AppId": "com.company.myapp.dev",
    "ServerUrl": "https://mobile-service.cfapps.<region>.hana.ondemand.com",
    "Passcode": false
  }
}
```

Or switch CF space first:
```bash
cf target -s dev    # switch to Dev space
cf target -s qa     # switch to QA space
cf target -s prod   # switch to Prod space
```

**Step 3 — Build the bundle**
```
mcp__mdk__mdk-manage { "folderRootPath": ".", "operation": "build" }
```
> **Windows note:** If using local MDK CLI directly, always quote the binary path:
> `"C:\path with spaces\mdk-tools.cmd" build --project "."` — unquoted paths fail when the install path contains spaces.
This compiles all metadata (pages, actions, rules) into a `bundle.zip`.

**Step 4 — Deploy to Mobile Services**
```
mcp__mdk__mdk-manage { "folderRootPath": ".", "operation": "deploy" }
```
This uploads the bundle to the Mobile Services app in the current CF space.
The app ID in `mdk.config.json` determines which Mobile Services app receives it.

**Step 5 — Verify deployment**
```
mcp__mdk__mdk-manage { "folderRootPath": ".", "operation": "showqr" }
```
Generates a QR code for the current environment. Scan it on a test device
to confirm the new version downloaded correctly.

**The full promotion sequence:**
```
1. cf target -s dev  → build → deploy → test on Dev devices
2. cf target -s qa   → deploy (same bundle, no rebuild needed) → UAT testing
3. cf target -s prod → deploy (same bundle) → users get update automatically
```

No rebuild needed between environments — the same bundle.zip promotes through.
Only the CF space (and therefore the Mobile Services app) changes.

**How devices receive the update:**
The MDK client on each device checks Mobile Services every 20-25 minutes.
When it sees a higher `ApplicationVersion`, it downloads the new bundle
and triggers `OnWillUpdate` → applies update → triggers `OnDidUpdate`.

---

## Device onboarding via QR code

After successful deploy, `.build/qrcode.png` is generated.

**In VS Code:**
1. Open VS Code Explorer → `.build/qrcode.png`
2. Click the file — it previews in VS Code
3. Scan with SAP Mobile Services Client on the device

**Onboarding steps on device:**
1. Install **SAP Mobile Services Client** from App Store / Google Play
2. Open the app → tap "Scan QR Code"
3. Scan `.build/qrcode.png`
4. Log in with SAP BTP credentials (XSUAA SSO)
5. The MDK app downloads and launches automatically

**Show QR code path:**
```
mcp__mdk__mdk-manage {
  "folderRootPath": ".",
  "operation": "show-qrcode"
}
```

---

## CI/CD pipeline (GitHub Actions example)

```yaml
name: mdk-deployment-guide

on:
  push:
    branches: [qa]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install MDK tools
        run: npm install -g @sap/mdk-tools

      - name: CF Login
        run: |
          cf login \
            -a ${{ secrets.CF_API }} \
            -u ${{ secrets.CF_USER }} \
            -p ${{ secrets.CF_PASSWORD }} \
            -o ${{ secrets.CF_ORG }} \
            -s qa

      - name: Validate
        run: npx @sap/mdk-tools validate --project .

      - name: Deploy to QA
        run: npx @sap/mdk-tools deploy --target mobile --project .
```

---

## Promotion flow (dev → QA → prod)

```
1. Develop on local MDK project
2. Deploy to DEV Mobile Services app (cf target -s dev)
   → Developers test on their devices

3. Bump ApplicationVersion (e.g. 1.3.0-rc)
4. Deploy to QA Mobile Services app (cf target -s qa)
   → QA team tests using QR code

5. Bump ApplicationVersion (e.g. 1.3.0)
6. Deploy to PROD Mobile Services app (cf target -s prod)
   → Field workers receive update automatically within 20-25 min
```

---

## Force update — block old versions

In SAP BTP Cockpit → Mobile Services → your app → Application Versioning:
- Enable "Only allow active versions"
- Set minimum required version: `1.3.0`
- Old clients get 403 → prompted to update

Handle 403 in your MDK app:
```javascript
// OnFailure rule for any service action
export default function HandleVersionError(clientAPI) {
  const code = clientAPI.getActionResult('sync')?.error?.responseCode;
  if (code === 403) {
    return clientAPI.executeAction({
      "_Type": "Action.Type.Message",
      "Title": "Update Required",
      "Message": "Please update the app to continue.",
      "OKCaption": "OK"
    });
  }
}
```

---

## Part 3 — Device Update Lifecycle

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
