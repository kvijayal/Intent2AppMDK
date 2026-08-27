---
name: mdk-bundler-settings
version: 0.4.0
description: >
  Use when checking or fixing mdk.bundlerExternals in .vscode/settings.json before
  MDK deploy. Missing bundler externals cause deploy failures or device crashes.
  Trigger on: "bundlerExternals", "mdk.bundlerExternals", "bundler externals missing",
  "deploy fails bundler", "settings.json MDK", "NativeScript packages bundler",
  "external packages MDK", "before deploy check settings", "bundler external packages",
  "@nativescript/geolocation", "extension-LocationService", "extension-GenericWebView".
source: Intent2App — moved from mdk_check_settings MCP tool
---

# MDK Bundler Externals — Check and Fix

`mdk.bundlerExternals` lists NativeScript packages excluded from the MDK bundle
and loaded at runtime. The real `@sap/mdk-mcp-server` reads this from
`.vscode/settings.json` automatically during deploy and passes them as
`--externals` to `mdkcli deploy`. Missing entries cause bundle errors or device crashes.

---

## Check current settings

```bash
cat .vscode/settings.json 2>/dev/null || echo "No .vscode/settings.json found"
```

Or read and parse directly:
```bash
python3 -c "
import json, sys
try:
    s = json.load(open('.vscode/settings.json'))
    ext = s.get('mdk.bundlerExternals', [])
    print(f'mdk.bundlerExternals: {len(ext)} packages')
    for e in ext: print(f'  - {e}')
    if not ext: print('  ⚠️ EMPTY — update before deploy')
except: print('❌ .vscode/settings.json missing or invalid')
"
```

---

## Status and action

| Status | What it means | Action |
|---|---|---|
| File missing | Never configured | Create with recommended list below |
| `mdk.bundlerExternals` empty | Configured but no packages | Add recommended list |
| Partial list | Some packages missing | Add missing ones |
| Full list | ✅ Ready to deploy | No action needed |

---

## Write recommended settings

Create or update `.vscode/settings.json`:

```json
{
  "mdk.bundlerExternals": [
    "nativescript-speech-recognition",
    "@nativescript/geolocation",
    "extension-LocationService",
    "extension-GenericWebView",
    "extension-SAMFoundation",
    "extension-MapAuthenticator",
    "extension-SAPScannerFramework",
    "uuid",
    "@nstudio/nativescript-dynatrace",
    "@nativescript/core/accessibility",
    "xml-js",
    "stream",
    "buffer",
    "emitter",
    "nativescript-qr-generator",
    "@nativescript/core/timer"
  ]
}
```

**Minimal set** (for apps not using advanced NativeScript features):
```json
{
  "mdk.bundlerExternals": [
    "@nativescript/geolocation",
    "extension-LocationService",
    "extension-GenericWebView",
    "uuid",
    "stream",
    "buffer"
  ]
}
```

---

## Rules

1. Always check before deploy — missing entries cause silent failures on device
2. If the project uses barcode scanner → add `@nativescript/core/accessibility`
3. If the project uses location → add `@nativescript/geolocation` + `extension-LocationService`
4. If the project uses SAP Asset Manager extensions → add all `extension-SAM*` entries
5. The `@sap/mdk-mcp-server` reads this file automatically — keep it accurate
