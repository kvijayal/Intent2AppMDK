---
description: >
  Read-only deployment readiness audit for a CAP + Fiori app — checks mta.yaml (full compatibility
  audit via the mta-reviewer skill: forwardAuthToken propagation, build commands, module/resource
  naming, destination wiring, security), xs-app.json, xs-security.json, and Fiori app build scripts
  for correctness before the developer runs mbt build or cf deploy. Produces a severity-ranked
  findings report with exact fix snippets. Also handles ABAP Frontend Server readiness via
  ui5-deploy.yaml for pro-code apps.
argument-hint: "<app-folder | path to <app>/>"
allowed-tools: Read, Glob, Grep, Bash, Skill, Agent, mcp__intent2app__validate_namespace, mcp__intent2app__run_checks
model: inherit
---

You are running **DEPLOY** mode in the MAIN thread on: `$ARGUMENTS` (default: the current project).

This is a **read-only** audit. No files are created or modified — findings are surfaced for the
developer to resolve via `/modify` or manually before running `mbt build` / `cf deploy`.

1. **Verify a deployable project exists.** Check for `srv/service.cds` or `app/*/webapp/manifest.json`
   or `ui5-deploy.yaml`. If none exist, tell the developer what is missing and stop.

2. **Spawn the `deployer` sub-agent.** Pass the app folder path (from `$ARGUMENTS`) and ask it to:
   - Detect topology and determine the deployment path (A / B / C / D)
   - Audit all deployment artifacts for presence and correctness
   - Run the `deployment-validation` skill for comprehensive per-file and cross-file consistency checks (package.json name/auth, xs-app.json routing, ui5.yaml/ui5-deploy.yaml/manifest consistency, archiveName-to-zip match, sap.cloud.service match)
   - Run the `mta-reviewer` skill against `mta.yaml` for full MTA compatibility audit (forwardAuthToken propagation, before-all build commands, module paths and builders, destination wiring, naming consistency, security rules)
   - Run `validate_namespace` and `run_checks` (if CAP present)
   - Return the verdict line, severity-ranked findings table, checklist status, and deploy commands

3. **Surface the results.** Present:
   - The verdict line (`N CRITICAL, N WARNING, N INFO`)
   - The full findings table (most severe first, with exact fix snippets)
   - The deployment checklist status table
   - The `mbt build` / `cf deploy` commands to run once all CRITICALs are resolved

4. **Never execute build or deploy commands.** The developer runs those after resolving all findings.
