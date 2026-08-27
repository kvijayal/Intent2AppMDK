---
name: mdk-cf-mobile-services
version: 0.4.0
description: >
  Use when setting up CF login for MDK development, detecting the correct BTP region,
  configuring Mobile Services for the first time, or troubleshooting connection issues
  between the MDK project and SAP Mobile Services. Trigger on: "cf login", "CF region",
  "which region", "Mobile Services setup", "BTP cockpit MDK", "create Mobile Services app",
  "Mobile Services not reachable", "CF target", "cf oauth-token", "org and space",
  "landscape", "eu10 us10 jp10 ap10", "sso login", "CF CLI", "cf login --sso",
  "Mobile Services cockpit", "trial account MDK", "subaccount MDK", "entitlement MDK".
source: Intent2App — not covered by @sap/mdk-mcp-server
---

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
