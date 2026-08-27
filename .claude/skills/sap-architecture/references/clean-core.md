*Part of the sap-architecture skill.*

# Clean Core — depth

Clean Core means keeping the **digital core unmodified** so upgrades stay cheap, predictable, and low-risk. Every Intent2App decision is filtered through this lens. This file expands §1 of the skill: the extensibility tiers, released/public-API discipline, on-stack vs side-by-side, and an upgrade-stability checklist.

The one-line test: *"If SAP ships an upgrade tomorrow, does my extension keep working without rework?"* If not, it isn't Clean Core.

---

## 1. The extensibility tiers (in order of preference)

Always work down this list and stop at the first tier that satisfies the requirement.

### Tier 1 — Standard configuration (no code)
Customizing delivered apps/services through provided configuration: SSCUI/IMG settings, app personalization, fixed value lists. **Always check first** — zero upgrade cost.
- *Choose when:* a setting already exists for the need.
- *Local-run:* n/a (config in the system).

### Tier 2 — Key-user / in-app extensibility (on-stack, upgrade-safe)
In-app tools: custom fields & logic, adapt-UI, custom CDS views, simple business logic — all stored in upgrade-safe layers and applied over the standard objects.
- *Choose when:* you need a custom field, a small rule, or a delivered-app UI tweak. Maps to **Adaptation Project** for Fiori app deltas.
- *Local-run:* ⚠ generally needs the system/base app (not fully offline).

### Tier 3 — Developer extensibility (the two clean developer models)
When key-user tools aren't enough, write code — but in a clean, separately deployable way:
- **On-stack: RAP / ABAP Cloud** — develop in the ABAP Cloud environment using **released APIs only**; the standard core is untouched. Use when logic must sit *beside* the business object.
- **Side-by-side: BTP / CAP (or Freestyle UI5)** — a separate app/service on BTP consuming released S/4 APIs/events via destinations. Use for cross-system logic, modern stack, or independent release cadence.

Both are equally clean. **Choose by landscape, not preference** (see §3). Intent2App's default build target is side-by-side CAP.

### Tier 4 — Classic in-stack modification (avoid)
Modifying SAP repository objects, implementing non-released enhancements, or appending to SAP tables in ways that break on upgrade. **Avoid.** If a requirement seems to need it, flag it as a **Clean Core risk** and require the developer's explicit confirmation before proceeding (a HARD CONSTRAINT).

| Tier | Mechanism | Upgrade-safe? | Default stance |
|---|---|---|---|
| 1 Standard config | Provided settings | ✅ | Always check first |
| 2 Key-user/in-app | Custom fields, adapt-UI, Adaptation Project | ✅ | Preferred for small deltas |
| 3 Developer (RAP) | ABAP Cloud, released APIs | ✅ | On-stack logic |
| 3 Developer (CAP) | BTP side-by-side, released APIs | ✅ | Intent2App default |
| 4 Classic modification | Modify SAP objects | ❌ | **Avoid; flag & confirm** |

---

## 2. Released / public-API discipline

The non-negotiable rules that make every tier clean:

- **Released/public APIs only.** Consume only objects SAP has released for cloud use (e.g. C1-released CDS views, released OData/RAP business objects, public events). Never depend on internal/unreleased objects — they can change or vanish on upgrade.
- **OData V4 only** (HARD CONSTRAINT). Never generate or consume V2.
- **No core modification.** Extensions never alter delivered objects; they add alongside.
- **Separately deployable.** Extensions live in their own deployable unit (RAP package / BTP MTA), versioned and released independently.
- **No hardcoded URLs or secrets.** Backend endpoints come from **destinations / env vars**, never literals in the repo — so the same code moves across landscapes untouched.
- **Stay on documented extension points.** For Fiori Elements, use official FE extension points (FPM building blocks, `controllerExtension`, custom sections) — not FE internals.

How to verify a service is released before consuming it: check the SAP API Business Hub / system's released-API catalogue, confirm it's OData **V4**, and capture the EDMX offline (see `backend-cap-vs-rap.md`). If you can't confirm it's released, treat consumption as a risk and surface it.

---

## 3. On-stack (RAP) vs side-by-side (CAP) — comparison

Both are Clean Core. Pick by where the logic *belongs* and the landscape, not by taste.

| Dimension | On-stack — RAP / ABAP Cloud | Side-by-side — BTP / CAP |
|---|---|---|
| Runs where | Inside the S/4 (ABAP Cloud) stack | Separate BTP runtime (Cloud Foundry/Kyma) |
| Best for | Logic tightly coupled to a business object; transactional consistency with core data | New/cross-system capability; modern Node.js/UI5; independent release cadence |
| Data access | Direct to released CDS/BO in-stack | Released S/4 APIs/events via **destinations** |
| Language | ABAP (RAP) | Node.js (CAP) / TypeScript (UI5) |
| Clean Core | On-stack clean model | BTP clean model |
| Release cadence | With the stack | Independent of S/4 |
| Local-run | ⚠ needs the system | ✅ `cds watch` / EDMX mock offline |
| Intent2App role | Advisory (often needs live system) | **Default build target** |

Rule of thumb: **data-adjacent transactional logic → RAP; cross-system / net-new / independent app → side-by-side CAP.** They compose: RAP can own the on-stack BO while a CAP/UI5 app consumes it side-by-side.

---

## 4. Upgrade-stability checklist

Run this before signing off any architecture (feeds TDD §2 and `mcp__intent2app__clean_core_check`):

- [ ] **No SAP object is modified** — every change is additive and in its own layer/package.
- [ ] **Only released/public APIs** are consumed (verified in the API catalogue), and they are **OData V4**.
- [ ] **The extension is separately deployable** and independently versioned (RAP package or BTP MTA).
- [ ] **Backend endpoints come from destinations/env vars** — no hardcoded URLs or secrets in the repo.
- [ ] **The right tier is used** — config/key-user before custom code; classic modification avoided (or explicitly confirmed as an accepted risk).
- [ ] **On-stack vs side-by-side** matches where the logic belongs, not convenience.
- [ ] **Auth via standard mechanisms** — XSUAA/IAS, `@requires`/`@restrict`; no bypass.
- [ ] **Fiori extensions stay on documented extension points** (FPM/`controllerExtension`), not framework internals.
- [ ] **Annotation strategy for consumed services** prefers a backend metadata-extension for reusable semantics; local `annotation.xml` only for app-specific UI (see `backend-cap-vs-rap.md`).
- [ ] **Any deviation is recorded** as a Clean Core risk in TDD §9 with explicit developer confirmation.

If every box is ticked, the extension survives the next upgrade with no rework — which is the entire point.
