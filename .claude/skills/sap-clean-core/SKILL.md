---
name: sap-clean-core
description: >
  SAP Clean Core rules for Intent2App and how to use the clean_core_check tool. Load at Gate A
  (Clean Core delivery) and whenever a request might touch the digital core. Keywords: clean core,
  extensibility, side-by-side, key-user, developer extensibility, released API, RAP, modification,
  clean_core_check.
---

# SAP Clean Core

**Extend, never modify the digital core.** Use released/public APIs only. This is a binding
constraint — flag any classic in-stack modification as a risk and require explicit confirmation.

## Delivery model (Gate A)

Intent2App builds the **Side-by-side BTP/CAP** path only — a new app on BTP consuming released OData APIs, with zero on-stack modification. If the requirement cannot be satisfied without on-stack RAP/ABAP Cloud or classic modification, it is out of scope for this release.

## Tooling
Run `mcp__intent2app__clean_core_check` on the design/requirement to classify the approach and
surface risks. If the MCP server is unavailable, apply this skill by hand: check for any core
object modification, unreleased API usage, or in-stack changes, and raise them as a gate decision.

## Reference
- Full clean-core decision detail → [`references/clean-core.md`](references/clean-core.md)
