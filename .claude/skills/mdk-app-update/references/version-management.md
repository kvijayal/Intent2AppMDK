# MDK Version Management Reference

*Part of the mdk-app-update skill.*

## Version Number Locations

| File | Property | Purpose |
|---|---|---|
| `.project.json` | `ApplicationVersion` | Controls MDK update cycle — Mobile Services compares this to device version |
| `MDKProject.json` | `AndroidVersionCode` | Google Play Store version code (branded client only) |
| Mobile Services cockpit | Application Versioning | Minimum required version — blocks older clients with 403 |

## Version Increment Rules

```
MAJOR.MINOR.PATCH

MAJOR (1.x.x → 2.x.x):
  - Breaking OData schema change (entity removed, property type changed)
  - Requires offline store clear + re-initialize in OnDidUpdate
  - Consider forced update via Mobile Services versioning

MINOR (x.1.x → x.2.x):
  - New entity sets, new pages, new features
  - Offline store compatible — no clear needed
  - OnDidUpdate can just re-open store

PATCH (x.x.1 → x.x.2):
  - Bug fixes, i18n changes, style updates
  - No store changes needed
  - OnDidUpdate can be minimal
```

## Update Check Timing

```
App launch + passcode entered      → immediate check
App resume + passcode entered      → immediate check
App in foreground                  → check every 20-25 minutes
App in background                  → NO check
```

## Deployment Commands

```bash
# Validate first
npx @sap/mdk-tools validate --project .

# Build
npx @sap/mdk-tools build --target zip --project .

# Deploy (triggers update on all enrolled devices within 20-25 min)
npx @sap/mdk-tools deploy --target mobile --showqr --project .
```

After deploy, enrolled devices check in on their next update cycle trigger
and download the new bundle automatically.

## Application.app — All Update Hooks

```json
{
  "_Type": "Application",
  "_Name": "YourApp",
  "MainPage": "/YourApp/Pages/Main.page",
  "OnLaunched":    "/YourApp/Actions/AppOnLaunched.action",
  "OnWillUpdate":  "/YourApp/Rules/AppUpdate/OnWillUpdate.js",
  "OnDidUpdate":   "/YourApp/Rules/AppUpdate/OnDidUpdate.js",
  "OnResume":      "/YourApp/Rules/AppUpdate/OnResume.js"
}
```

`OnResume` is useful to trigger a manual sync after the app returns from
background — pairs well with the update check that happens on resume.

## Rollback Behavior

MDK client auto-rolls back when:
- `OnDidUpdate` rejects or throws
- The new bundle fails to load

On rollback:
1. Previous bundle is restored
2. `OnDidUpdate` fires again for the **old** bundle
3. Your `OnDidUpdate` for the old bundle should re-open whatever it closed

Design `OnDidUpdate` to be safe for both the new version and a rolled-back state.
