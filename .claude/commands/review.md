---
description: >
  Read-only quality + security gate for an existing SAP CAP + UI app. Engages a HARD STOP (no edits),
  scans the architecture, and produces a severity-ranked findings report to triage. Fixes are applied
  separately via /modify.
argument-hint: "<app-folder | path to <app>/>"
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion, Skill, Agent, mcp__intent2app__run_checks, mcp__intent2app__validate_namespace, mcp__intent2app__clean_core_check
model: inherit
---

You are running **REVIEW** mode in the MAIN thread on: `$ARGUMENTS` (default: the current project).

1. **Engage the HARD STOP.** Create `.intent2app/` if missing and write the lock file
   `.intent2app/review.lock` (any content). While it exists, a PreToolUse hook denies every
   `Write`/`Edit` — the review physically cannot modify code.
2. **Scan.** Spawn the **`architect-scan`** sub-agent (read-only) to map the stack, model, auth,
   floorplan, and clean-core posture, and return architecture insights.
3. **Review.** Spawn the **`reviewer`** sub-agent with those insights on the app folder. It runs the
   full best-practices + security audit and returns a severity-ranked table (`file:line` +
   recommended fix), CRITICAL first.
4. **Surface, don't apply.** Present the findings and stop. Tell the developer: *"These are
   recommendations only — run `/modify` to approve and apply."* Do not edit anything (the lock
   blocks it regardless).
