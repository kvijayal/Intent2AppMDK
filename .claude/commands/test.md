---
description: >
  Standalone unit-testing for an existing app — scaffolds and runs CAP cds.test/Jest and UI5
  QUnit/OPA5 suites and writes a test report with coverage.
argument-hint: "<app-folder | path to <app>/>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Skill, Agent, mcp__intent2app__run_checks
model: inherit
---

You are running **TEST** mode in the MAIN thread on: `$ARGUMENTS` (default: the current project).

1. ❓ Ask which framework(s) to enable if unclear: CAP `cds.test`+Jest, UI5 QUnit, OPA5.
2. Spawn the **`tester`** sub-agent to scaffold any missing tests (following the `sap-unit-testing`
   skill and the reference apps), run the suites, and write
   `<app>/deliverables/Test-Report.md`.
3. Present the results (pass/fail, coverage, failures with `file:line`). For real failures, suggest
   `/modify` to fix — do not alter application logic just to make tests pass.
