*Part of the deployment-checklist skill.*

# xs-app.json — Security and Route Configuration

The approuter `xs-app.json` is the security perimeter for the deployed app. Misconfiguration
here is the most common source of post-deploy security vulnerabilities and routing 404s.

---

## Complete annotated `xs-app.json`

```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",

  "websockets": { "enabled": false },

  "allowedOrigins": [
    "https://myapp-approuter.cfapps.eu10.hana.ondemand.com"
  ],

  "routes": [

    // ── OData route for CAP service ──────────────────────────────────────────
    {
      "source": "^/odata/v4/myservice(.*)$",
      "target": "$1",
      "destination": "myapp-srv",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },

    // ── OData route for RAP / external S/4 service ───────────────────────────
    {
      "source": "^/sap/opu/odata4/sap/myservice/(.*)$",
      "target": "/sap/opu/odata4/sap/myservice/$1",
      "destination": "S4HANA_PROD",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },

    // ── Static assets (no auth) ──────────────────────────────────────────────
    {
      "source": "^/resources/(.*)$",
      "target": "/resources/$1",
      "authenticationType": "none",
      "cacheControl": "no-cache, no-store, must-revalidate"
    },

    // ── Catch-all: serve UI from HTML5 repo ─────────────────────────────────
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

---

## Security rules — each is a potential finding

### `allowedOrigins` — NEVER use `"*"`

```json
// CRITICAL security violation
{ "allowedOrigins": ["*"] }

// Correct — restrict to the exact deployed domain
{ "allowedOrigins": ["https://myapp-approuter.cfapps.eu10.hana.ondemand.com"] }
```

`"*"` allows any website to make cross-origin authenticated requests through the approuter
using the user's active session. If the app is accessed from multiple origins (custom domain +
CF default domain), list all of them explicitly.

---

### `csrfProtection` — required on all write-capable routes

```json
// Missing — CSRF attacks can modify data via cross-site requests
{ "source": "^/odata/v4/myservice(.*)$", "destination": "..." }

// Correct
{ "source": "^/odata/v4/myservice(.*)$", "destination": "...",
  "csrfProtection": true }
```

`csrfProtection: true` makes the approuter require a CSRF token header on non-safe HTTP methods
(POST, PUT, PATCH, DELETE). Fiori Elements and the OData V4 model request and send this token
automatically. Set `csrfProtection: false` only on truly read-only routes.

---

### `authenticationType` — every route must declare it

```json
// Missing — defaults vary by approuter version; always set explicitly
{ "source": "^/odata/v4/myservice(.*)$", "destination": "..." }

// Options:
// "xsuaa"  — user must be logged in (most routes)
// "none"   — public (only for static resources, health endpoints)
```

A route without `authenticationType: "xsuaa"` may bypass login in some approuter versions.

---

### Route ordering — most specific first

The approuter matches routes top-to-bottom and stops at the first match:

1. Specific API routes (OData paths) first.
2. Static resource routes before the catch-all.
3. The HTML5 repo catch-all (`^(.*)$`) must always be **last**.

```json
// WRONG — catch-all before API route swallows all OData calls
{ "source": "^(.*)$", "service": "html5-apps-repo-rt" },
{ "source": "^/odata/v4/myservice(.*)$", "destination": "..." }

// CORRECT
{ "source": "^/odata/v4/myservice(.*)$", "destination": "..." },
{ "source": "^(.*)$", "service": "html5-apps-repo-rt" }
```

---

### Destination name consistency

The `destination` value in each route must exactly match the BTP subaccount destination name —
it is case-sensitive and must match in `xs-app.json`, `ui5.yaml` proxy config, and the subaccount.
A mismatch causes 502 Bad Gateway after deploy with no clear error in the Fiori UI.

---

## Route cross-check against manifest dataSources

Every `dataSources` entry in `manifest.json` must have a matching route:

```json
// manifest.json
"dataSources": {
  "mainService": {
    "uri": "/odata/v4/myservice/",
    "type": "OData",
    "settings": { "odataVersion": "4.0" }
  }
}
```

```json
// xs-app.json — source regex must cover the manifest uri
{ "source": "^/odata/v4/myservice(.*)$", ... }
```

---

## Troubleshooting post-deploy

| Symptom | Most likely cause |
|---|---|
| 401 on all OData calls | XSUAA not bound to CAP srv module in mta.yaml |
| 502 Bad Gateway on OData | Destination not found — name mismatch or destination service not bound |
| 404 on all app routes | HTML5 repo runtime not bound, or app-content deployer failed |
| CSRF token mismatch error | `csrfProtection: false` on a write route |
| Login loop after deploy | XSUAA not bound to approuter, or `xs-security.json` scope mismatch |
| CORS error in browser console | `allowedOrigins` missing the origin the browser is calling from |
