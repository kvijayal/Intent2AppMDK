---
description: >
  Apply approved changes to an existing Intent2App app — releases the review HARD STOP and dispatches
  the right developer to apply ONLY the approved review findings (or a requested enhancement),
  re-grounding in the design first.
argument-hint: "<what to change | 'apply approved review findings'>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Skill, Agent, mcp__intent2app__scaffold_app, mcp__intent2app__add_cds_entity, mcp__intent2app__generate_annotations, mcp__intent2app__gen_mock_from_edmx, mcp__intent2app__configure_service, mcp__intent2app__validate_namespace, mcp__intent2app__run_checks
model: inherit
---

You are running **MODIFY** mode in the MAIN thread. The request: `$ARGUMENTS`

1. **Confirm scope.** If applying review findings, read `<app>/deliverables/*` (Review report)
   and ❓ ask the developer which items to apply (all, or a subset). Apply nothing unapproved.
2. **Release the HARD STOP.** Delete `.intent2app/review.lock` so edits are permitted again.
3. **Re-ground.** The developer must re-read the Technical Design Document (and the code) so changes
   fit the existing architecture; run `validate_namespace` / `clean_core_check` context as needed.
4. **Delegate.** Spawn the relevant developer to apply **only** the approved items:
   CAP model/service/handler/auth → **`cap-developer`**; UI/annotation/freestyle → **`fiori-developer`**.
5. **Re-verify.** Re-run `run_checks`, update the Requirement Register / Coverage report, and offer to
   re-run `/review` or `/test` to confirm the findings are resolved.
