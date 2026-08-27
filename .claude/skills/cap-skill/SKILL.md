---
name: cap-skill
description: >
  Master CAP skill index for Intent2App — entry point that links to all individual CAP reference
  files: cap-handlers, cap-integration, cap-modeling, cap-schema, cap-service, cap-security.
  Load when you need to locate the right CAP reference file for a task. Keywords: CAP, CDS,
  entity, handler, service, authorization, integration, schema, modeling, XSUAA.
---

# CAP Skill Index

All CAP-specific reference files live in `references/`. Load the one that matches your task:

| Reference File | When to use |
| --- | --- |
| [`references/cap-handlers.md`](references/cap-handlers.md) | Writing `srv/*.js` handlers — before/on/after, req.error, cds.ql, logging |
| [`references/cap-modeling.md`](references/cap-modeling.md) | CDS patterns, OData V4, drafts, computed fields, pitfalls, bound-action checklist |
| [`references/cap-schema.md`](references/cap-schema.md) | `db/schema.cds` — entities, keys, associations, compositions, CSV seed data |
| [`references/cap-service.md`](references/cap-service.md) | `srv/*.cds` — exposing entities, actions, functions, draft, access control |
| [`references/cap-security.md`](references/cap-security.md) | `@requires`, `@restrict`, XSUAA roles/scopes, `xs-security.json`, mock users |
| [`references/srv-structure.md`](references/srv-structure.md) | `srv/` folder layout — boilerplate for `service.js` hub, `operations/`, `validators/`, `auth/`, `util/` (constants, logger, errors, formatter) |
| [`references/cap-handler-quality.md`](references/cap-handler-quality.md) | Handler *architectural quality* — phase compliance, function vs action, size thresholds, extraction to `srv/lib/`, code smell catalogue |
| [`references/cap-async.md`](references/cap-async.md) | Async/await correctness — missing `await`, mixing `.then()` + `async/await`, parallel reads with `Promise.all`, swallowed errors |
| [`references/cap-remote.md`](references/cap-remote.md) | Remote services and transactions — `cds.transaction(req)`, `cds.connect.to()` singleton, `.tx(req)` propagation, null-check on remote results |
| [`references/cap-review-checks.md`](references/cap-review-checks.md) | Condensed review checklist for Cat 1 (projections, etag, computed fields, bound-action completeness) and Cat 2 (auth completeness, sensitive field stripping, xs-security.json consistency) — load during `/review` when `CAP_PRESENT` |
| [`references/review-grep-inventory.md`](references/review-grep-inventory.md) | 7 structural grep commands — dead handler files, duplicate service definitions, fragment location, duplicate UI control IDs, deprecated API inventory, `package.json` cleanliness, bootstrap config consistency |

> **Integration is kept separate** — for EDMX, mock server, proxy, BAS destinations, and MTA deploy patterns use the standalone `cap-integration` skill.
