# Intent2App — Session Update Log

> Records every file changed in the July 2026 engineering session.
> Format: file path → what changed → key line numbers (1-indexed).

---

## 1. Technical Design Document template — replaced

**File:** `.claude/skills/deliverable-templates/references/technical-design-document.md`

The old Intent2App gate-driven TDD format (12 sections) was replaced with a 14-section enterprise format derived from the WorkcenterFD.docx standard.

| Change | Detail |
| --- | --- |
| Header block added | Document ID, GAP ID, TD Title, Implementation Partner, Approval Dates (lines 1–25) |
| Control tables added | Change History, Reviewers, Sign Off (lines 26–55) |
| §1 Business Context | Unchanged concept, new formatting |
| §2 Clean Core Assessment | Kept, renumbered |
| §3 Solution Architecture (NEW) | Lines ~60–90; auto-populated note from `Application-Architecture.md` and `mta.yaml` |
| §4 Data Model | Renumbered from old §3 |
| §5 Integration Design (NEW) | Lines ~130–175; integration flows table + destination configuration table |
| §6 Error Handling (NEW) | Lines ~176–220; split into 6.1 Validation (4xx), 6.2 Authorization (403), 6.3 System (5xx) |
| §7–§13 | Renumbered from prior §4–§10 |
| §14 Data Migration (NEW, Optional) | Lines ~300–340; source-to-target mapping table + migration strategy phases |

---

## 2. Deliverable Templates skill — gate mapping updated

**File:** `.claude/skills/deliverable-templates/SKILL.md`

| Change | Lines |
| --- | --- |
| Removed FD row from deliverables table | ~10–16 |
| Added 4 new gate → TDD section mappings for §3, §5, §6, §14 | ~30–50 |

New mappings:
- `Application-Architecture.md + mta.yaml` → §3 Solution Architecture
- `cds.requires + mta.yaml destinations + Gate G8` → §5 Integration Design
- `srv/*.js scan (req.error/req.reject/req.warn)` → §6 Error Handling
- Explicit migration requirement → §14 Data Migration (Optional)

---

## 3. MTA Reviewer skill — 5 rule patches

**File:** `.claude/skills/mta-reviewer/SKILL.md`

| Rule | Change | Lines |
| --- | --- | --- |
| H1 | `_schema-version` must be **quoted string** `"3.3"` — unquoted `3.3` is a float rejected by MBT | ~25–30 |
| G1 (NEW) | No `approuter.nodejs` module type — superseded by html5-apps-repo pattern | WARN | ~35–50 |
| G2 (NEW) | Every `requires` name must exist as a declared module/resource | FAIL | ~51–55 |
| §3 srv note | HANA rules S7/S8 conditional — skip for SQLite-only apps | ~110–115 |
| §4 db-deployer note | Section is conditional on HANA HDI container being present | ~140–145 |
| DC11 (NEW) | `sap.cloud.service` in destination-content must match `manifest.json` | FAIL | ~195–200 |
| DS_XS1 (NEW) | Destination `Name` in `init_data` must match `destination` in `xs-app.json` route | FAIL | ~215–220 |

---

## 4. starters.js — broken starter mappings fixed (critical bug)

**File:** `mcp-server/lib/starters.js`

All four CAP Fiori starters pointed to `dir: "cap-fiori-elements"` which does not exist.

| Key | Old `dir` | New `dir` |
| --- | --- | --- |
| `cap-fe-lrop` | `cap-fiori-elements` | `cap-fullstack-listreport` |
| `cap-fe-alp` | `cap-fiori-elements` | `cap-fullstack-listreport` |
| `cap-fe-op` | `cap-fiori-elements` | `cap-fullstack-listreport` |
| `cap-fpm` | `cap-fiori-elements` | `cap-fullstack-listreport` |
| `cap-freestyle` (NEW) | — | `cap-fullstack-freestyle` |

Lines changed: entire `STARTERS` export object (~lines 1–20).

---

## 5. deploy-approuter-mta.md — rewritten to html5-apps-repo pattern

**File:** `.claude/skills/cap-integration/references/deploy-approuter-mta.md`

Old file documented the **standalone `approuter.nodejs` module** pattern which conflicts with the
project standard. Rewritten entirely to the **html5-apps-repo pattern** (no approuter module).

Key additions:
- Title changed to "Deploy: xs-app.json & MTA (html5-apps-repo pattern)"
- Warning block: no standalone approuter (line ~5)
- `deploy_mode: html5-repo` at `mta.yaml` top level
- `before-all` hook: `npm ci` + `npx cds build --production`
- `srv` module: `builder: npm-ci`, `forwardAuthToken: true` in `provides` block
- `destination` resource with `HTML5Runtime_enabled: true` + `init_data` for `*-srv-api` + `ui5`
- Note cross-referencing DS_XS1 (`destination` in `xs-app.json` must match `Name` in `init_data`)

---

## 6. ui5-opa5.md — dead citation removed

**File:** `.claude/skills/sap-unit-testing/references/ui5-opa5.md`

| Change | Lines |
| --- | --- |
| Removed reference to non-existent `ui5-best-practices-opa5` skill | ~1–5, ~200 |
| New intro: "This file is the complete OPA5 + QUnit reference for Intent2App" | Line 3 |
| MD041 fix: heading moved to line 1 | Line 1 |
| MD040 fix: `text` language specifier on folder layout code block | ~20 |
| MD032 fix: blank line before Notes list after journey example | ~180 |

---

## 7. fpm-annotations.md — new reference file

**File:** `.claude/skills/fiori-elements/references/fpm-annotations.md` *(NEW)*

Created to cover FPM annotation patterns missing from `fiori-elements/SKILL.md`.

| Section | Content |
| --- | --- |
| §1 FilterBar | `UI.SelectionFields` with qualifier, `metaPath` format `...#FPMFilter` |
| §2 Table | `UI.LineItem` + criticality DataPoint, `filterBar` id linking rule |
| §3 Chart | `UI.Chart` with `UI.DataPoint`, `sap.chart`/`sap.viz` libs requirement |
| §4 Custom section | manifest `content.body.sections` block, `position.anchor` must match `UI.Facets` ID |
| §5 Side effects | `@Common.SideEffects` on bound actions, `TargetEntities` for compositions |
| §6 Required manifest flags | `flexEnabled`, `sap.fe.core`, `sap.fe.macros`, routing `name: sap.fe.core.fpm` |
| SDK Reference (NEW) | 5 URLs: FPM overview, `sap.fe.macros` API, Building Blocks, Custom Page Controller, SideEffects CAP docs |

SDK Reference added at lines ~218–228.

---

## 8. fiori-elements/SKILL.md — FPM section and keywords updated

**File:** `.claude/skills/fiori-elements/SKILL.md`

| Change | Lines |
| --- | --- |
| Added FPM keywords to frontmatter: `FPM, sap.fe.macros, macros:FilterBar, macros:Table, macros:Chart, custom section, side effects` | ~8–10 |
| FPM section split: annotations → `fpm-annotations.md`, bootstrapping → `fiori-bootstrap/fpm.md` | ~88–91 |

---

## 9. launchpad-workzone skill — new skill

**File:** `.claude/skills/launchpad-workzone/SKILL.md` *(NEW)*

No prior skill covered Launchpad tile registration — a required post-deploy step for every app.

| Section | Content |
| --- | --- |
| §1 Navigation intent | `#SemanticObject-Action` concept, PascalCase noun + camelCase verb rules |
| §2 `manifest.json` crossNavigation | Full `inbounds` example, `sap.cloud.service` match requirement |
| §3 `xs-app.json` scopes | `scopes` block, catch-all route with `html5-apps-repo-rt` |
| §4 SAP Build Workzone steps | Option A (Workzone Standard), Option B (Launchpad Service), Role Collections |
| §5 Cross-app navigation | `CrossApplicationNavigation` service with `sap.ushell?.Container` guard; `UI.DataFieldForIntentBasedNavigation` for Fiori Elements |
| §6 Troubleshooting | 7-row table: tile missing, app not found, 404, 403, `sap.cloud.service` error, cross-app nav |
| §7 Checklist | 6 items |

---

## 10. deployment-checklist/SKILL.md — launchpad-workzone reference added

**File:** `.claude/skills/deployment-checklist/SKILL.md`

Added `../launchpad-workzone/SKILL.md` row to the reference files table at line ~152.

---

## 11. CLAUDE.md — new root engineering standards file

**File:** `CLAUDE.md` *(NEW — project root)*

Consolidated engineering conventions previously scattered across 3+ skills.

| Section | Lines |
| --- | --- |
| Stack defaults table | ~10–22 |
| 4 hard rules (namespace, no approuter, forwardAuthToken×2, no console.log) | ~26–46 |
| Skill map (18 task → skill rows) | ~50–74 |
| 11 key prohibitions | ~78–90 |
| CAP authorization pattern snippet | ~94–104 |
| MTA deployment pattern overview | ~109–119 |
| Launchpad tile registration note | ~123–125 |
| Scope boundary (✅ / 🚫) | ~129–139 |

---

## 12. fiori-developer.md agent — FPM and launchpad-workzone references added

**File:** `.claude/agents/fiori-developer.md`

| Change | Lines |
| --- | --- |
| Line 20: FPM reference split — annotations → `fpm-annotations.md`, bootstrapping → `fpm.md` | Lines 20–22 |
| Line 23 (NEW): `launchpad-workzone` skill added to "Read first" section | Line 23 |

Old (line 20):
```
for an FPM page built with `sap.fe.macros` building blocks, consult `references/fpm.md` in the `fiori-bootstrap` skill
```

New (lines 20–23):
```
For FPM pages: annotations → fiori-elements/fpm-annotations.md; bootstrapping → fiori-bootstrap/fpm.md
For Launchpad: load launchpad-workzone skill — every deployed app needs a tile config
```

---

---

## 13. intent.md — Application-Architecture.md auto-opens in VS Code

**File:** `.claude/commands/intent.md` (line 126)

Previously STEP 7 just said "tell the developer the file has been written and ask them to open and review it" — the user had to manually find and open the file.

Now, after writing `Application-Architecture.md`, the `/intent` flow:

1. Runs `code "<app-name>/deliverables/Application-Architecture.md"` via Bash — opens the file in VS Code automatically.
2. Outputs a clickable markdown link to the file.
3. Prints the message: **"Press `Ctrl+Shift+V` (or the preview icon) to see it rendered."**

Lines changed: 126–132 (added 3-step "After writing the file" block after the write instruction).

---

---

## 14. srv-structure.md — CDS-native mandates block added

**File:** `.claude/skills/cap-skill/references/srv-structure.md`

A new **"CDS-native mandates"** section was prepended to the file (before the existing boilerplate examples). It was added after the cap-developer agent violated both rules in the Mass GRGI build (2026-07-27): the agent generated a monolithic `service.js` using `cds.on('bootstrap', app => app.post(...))` and Express `res.json()` — both banned patterns that bypass CAP's auth middleware and request lifecycle.

| Subsection | Content |
| --- | --- |
| §1 No direct Express | Table of 6 banned patterns → CDS-native replacements |
| §2 File upload pattern | CDS `action` with `fileContent: LargeString` (base64); `Buffer.from(fileContent, 'base64')` in handler |
| §3 File download pattern | CDS `function` returning `LargeString` (base64); UI5 decodes + triggers `<a download>` |
| §4 Error handling | `req.error()` / `req.reject()` — never `res.status().json()` or `throw new Error()` |
| §5 Role check | `requireRole(req)` accepts only `req`, never Express `res` |
| §6 Post-build grep gate | 4 grep commands that must pass before every delivery |

---

## 15. cap-developer.md agent — CDS-native coding rules block added

**File:** `.claude/agents/cap-developer.md`

A new **"CDS-native coding rules"** section was appended after the existing "Hard constraints" block. It enforces the same rules as §14 directly in the agent definition so that every future cap-developer spawn reads them before writing a single file — without needing the developer to flag violations manually.

| Rule added | Detail |
| --- | --- |
| No direct Express | `bootstrap`, `app.post`, `res.json`, `multer` all banned; reason given |
| File upload pattern | `LargeString` action + `Buffer.from(base64)` decode snippet |
| File download pattern | `function` returning `LargeString`; UI5 decodes client-side |
| Error handling | `req.error` / `req.reject` with code examples |
| Role check | `requireRole(req)` — no `res` parameter |
| Post-build grep gate | 4 mandatory greps listed inline so the agent runs them automatically |
| srv/ monolith ban | Explicit statement: single `service.js` = build failure; reference to `srv-structure.md` |

*Session date: 2026-07-27*
