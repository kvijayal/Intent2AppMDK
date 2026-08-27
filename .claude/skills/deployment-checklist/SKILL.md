---
name: deployment-checklist
description: >
  Deployment readiness checks for Intent2App — mta.yaml required module and resource bindings
  (XSUAA, Destination, Connectivity, HTML5 repo), xs-app.json CORS policy and route completeness,
  npm dependency audit, CF health-check endpoint, xs-security.json field-by-field audit
  (xsappname, scope completeness, scope-cumulation pattern), and Fiori app build script readiness
  (ui5.yaml name match, build script, ABAP ui5-deploy.yaml). Load when reviewing or preparing a
  CAP + Fiori app for Cloud Foundry or ABAP Frontend deployment. Keywords: mta.yaml, xs-app.json,
  xs-security.json, xsappname, scopes, role-templates, XSUAA, destination service, html5-apps-repo,
  CORS, allowedOrigins, csrfProtection, npm audit, health-check, approuter, mbt build, cf deploy,
  ui5-deploy.yaml, ABAP deploy, ui5.yaml, build script, sap.app.id.
---

# Deployment Checklist

> Complements `cap-integration` (deploy-approuter-mta.md). Use this skill to *audit* existing
> deployment artifacts for correctness and security before running `mbt build` / `cf deploy`.
> `cap-integration` is the *build reference* (how to write the files from scratch).
> The sanity check (STEP 8.2) only verifies build and lint — it does not touch deployment config.

## The 5 checks

### Check 1 — `mta.yaml` required service bindings

Every CAP + Fiori MTA must bind the correct BTP managed services. Missing bindings cause
runtime auth failures or 502 errors that only appear post-deploy.

**Required resources:**

| Service | Plan | Bound to | Missing if… |
|---|---|---|---|
| `xsuaa` | `application` | CAP srv module + approuter | 401 on every OData call after deploy |
| `destination` | `lite` | Approuter | Destination name can't be resolved → 502 |
| `html5-apps-repo` host | `app-host` | App-content deployer | UI never pushed to repo → 404 |
| `html5-apps-repo` runtime | `app-runtime` | Approuter | Approuter can't serve the UI → 404 |
| `connectivity` | `lite` | Approuter | Only needed when backend is on-premise via Cloud Connector |

**Detect missing xsuaa binding:**
```bash
grep -A5 "name: .*-srv"      mta.yaml | grep -c "auth"        # should be ≥ 1
grep -A5 "name: .*-approuter" mta.yaml | grep -c "auth"       # should be ≥ 1
grep -A5 "name: .*-approuter" mta.yaml | grep -c "destination" # should be ≥ 1
```

See [`references/mta-structure.md`](references/mta-structure.md) for a fully annotated
`mta.yaml` with all modules and resources, common omissions, and consume-only (no CAP) variant.

---

### Check 2 — `xs-app.json` CORS policy

The approuter `xs-app.json` must never use open CORS (`allowedOrigins: ["*"]`). This allows
any website to make authenticated requests through the approuter using the user's session.

**Check for open CORS:**
```bash
grep -n "allowedOrigin" approuter/xs-app.json
```

`"*"` in `allowedOrigins` = CRITICAL security finding. Restrict to the exact application domain:
```json
{ "allowedOrigins": ["https://your-app.cfapps.eu10.hana.ondemand.com"] }
```

**Also check every OData route has `csrfProtection: true` and `authenticationType: "xsuaa"`:**
```bash
grep -c "csrfProtection" approuter/xs-app.json   # should equal number of OData routes
grep -c "xsuaa"          approuter/xs-app.json   # should be on every non-public route
```

See [`references/xs-app-security.md`](references/xs-app-security.md) for a fully annotated
`xs-app.json`, route ordering rules, and the catch-all pattern for HTML5 repo serving.

---

### Check 3 — OData route completeness in `xs-app.json`

Every OData service the Fiori app calls must have a matching route in `xs-app.json`. A missing
route means the approuter passes the request to the HTML5 repo catch-all, which returns a 404.

**Cross-check manifest dataSources against xs-app.json routes:**
```bash
# Service paths declared in manifest
grep -o '"uri"[[:space:]]*:[[:space:]]*"[^"]*"' webapp/manifest.json | grep -o '"[^"]*"$'

# Routes declared in xs-app.json
grep '"source"' approuter/xs-app.json
```

Every `uri` from the manifest must match the `source` regex of a route. The destination name
in that route must match the BTP subaccount destination name exactly (case-sensitive).

---

### Check 4 — npm dependency audit

Run `npm audit` to detect known vulnerabilities in production dependencies before deploy.

```bash
npm audit --omit=dev --audit-level=high
```

- `--omit=dev` — only production dependencies matter for deployment.
- `--audit-level=high` — exits non-zero for HIGH and CRITICAL vulnerabilities.

**Findings to act on:**

| Level | Action |
|---|---|
| CRITICAL | Block deploy — fix or update the package |
| HIGH | Block deploy — fix before shipping |
| MODERATE | Flag as WARNING — remediate in next sprint |
| LOW | Log — acceptable to defer |

Also check for `--legacy-peer-deps` in any install script in `package.json` or `mta.yaml` build
commands — it hides peer-dependency conflicts that can cause runtime incompatibilities.

---

### Check 5 — CF health-check endpoint

Cloud Foundry requires a reachable health-check endpoint for zero-downtime rolling deploys.
Without it, CF marks the app instance as crashed during restage and rolls back.

For the **CAP service module**, the default `cds serve` exposes `GET /health` automatically.
Verify it is not overridden:
```bash
grep -r "health" srv/ app/  # confirm no route hijacks /health
```

For the **approuter module**, verify `mta.yaml` module parameters set the health check:
```yaml
parameters:
  health-check-type: port
  health-check-http-endpoint: /
```

---

---

## Reference files

| Reference file | When to load |
|---|---|
| [`references/mta-structure.md`](references/mta-structure.md) | Full annotated `mta.yaml` template — use as a fix-snippet base when `mta.yaml` is absent or a module is missing |
| [`references/xs-app-security.md`](references/xs-app-security.md) | Full annotated `xs-app.json`, route ordering rules, CORS policy, CSRF protection |
| [`references/xs-security-audit.md`](references/xs-security-audit.md) | Field-by-field audit rules for an existing `xs-security.json` — xsappname match, scope completeness, role-template completeness, scope-cumulation pattern |
| [`references/app-build-readiness.md`](references/app-build-readiness.md) | Fiori app build script checks (CAP-embedded + standalone UI5) and ABAP Frontend `ui5-deploy.yaml` completeness |
| [`../mta-reviewer/SKILL.md`](../mta-reviewer/SKILL.md) | Deep rule-by-rule `mta.yaml` audit — 13 categories, 80+ graded rules (FAIL/WARN/INFO), Pattern A/B destination detection, structured report output |
| [`../launchpad-workzone/SKILL.md`](../launchpad-workzone/SKILL.md) | Tile config, `crossNavigation.inbounds`, `sap.cloud.service` wiring, Workzone site registration, cross-app navigation, post-deploy Launchpad checklist |

---

## Deployment Checklist

- [ ] `mta.yaml` has `xsuaa` resource bound to both `*-srv` and `*-approuter` modules
- [ ] `mta.yaml` has `destination` resource bound to `*-approuter`
- [ ] `mta.yaml` has `html5-apps-repo` host + runtime resources
- [ ] `mta.yaml` has `connectivity` resource if on-premise backend via Cloud Connector
- [ ] `xs-app.json` has no `allowedOrigins: ["*"]`
- [ ] All OData routes in `xs-app.json` have `csrfProtection: true`
- [ ] All OData routes in `xs-app.json` have `authenticationType: "xsuaa"`
- [ ] Every manifest `dataSources.uri` has a matching `source` regex in `xs-app.json`
- [ ] Destination names are identical in `xs-app.json` and the BTP subaccount (case-sensitive)
- [ ] `npm audit --omit=dev --audit-level=high` exits 0
- [ ] No `--legacy-peer-deps` in install/build scripts
- [ ] CAP service exposes `/health` and it is not overridden
- [ ] Approuter module has `health-check-type` configured in MTA parameters
