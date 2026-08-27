---
description: >
  Generate deliverables for an app on demand — Technical Design Document (TDD), Unit Testing
  Document (UTD), or both. Asks the developer which to produce before doing any work.
argument-hint: "<app-folder | path to <app>/>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Agent, AskUserQuestion, mcp__intent2app__run_checks
model: inherit
---

# Document

You are running **DOCUMENT** mode in the MAIN thread on: `$ARGUMENTS` (default: the current project).

**❓ First, ask the developer which document(s) to generate:**

Use `AskUserQuestion` with these options (multi-select):

- **Technical Design Document (TDD)** — architecture decisions, data model, service design, auth matrix, requirement traceability. Generated from the Application Architecture file + gate decisions.
- **Unit Testing Document (UTD)** — CAP Jest test cases, UI5 QUnit + OPA5 journeys, test-case table, coverage targets, and how to run. Generated from the build artifacts.
- **Both**

Then spawn the **`documenter`** sub-agent for each selected document, passing the app path and selected scope. The documenter uses the `deliverable-templates` skill.

**TDD output:** `<app>/deliverables/Technical-Design-Document.md`
— every `REQ-NNN` in the Requirement Register must map to a TDD section; flag any that don't as a coverage gap; document build-vs-design deviations.

**UTD output:** `<app>/deliverables/Unit-Testing-Document.md`
— CAP + UI5 test cases, the test-case table, coverage targets, and how to run.

When the documenter returns, show the path(s) written and any coverage gaps flagged.
