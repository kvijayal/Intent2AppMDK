*Part of the sap-architecture skill.*

# Backend: build CAP vs consume RAP / existing OData

This expands Gate **G2**. It answers two questions: (1) when to **BUILD** a CAP service vs **CONSUME** an existing RAP/OData service, and (2) **how** to consume cleanly — the EDMX offline-first flow and the annotation strategy. For the mechanics of mock/proxy/destination wiring, hand off to the `cap-integration` skill.

---

## 1. Build vs consume — the decision

The Clean Core principle of **single source of truth** dominates: if a released service already exposes the data, consume it; don't rebuild it.

| Signal | BUILD a CAP service | CONSUME RAP / existing OData |
|---|---|---|
| Does a released service expose this data? | No | **Yes** |
| Who owns the domain data? | You (new on BTP) | The system of record (S/4 / RAP) |
| Need custom logic/computed fields/actions/events? | Yes, and it's *your* data | Logic belongs on-stack → RAP owns it |
| Persistence | You persist on BTP | Source system persists |
| Risk if you choose wrong | Building when a service exists = duplicate truth, drift, wasted maintenance | Rebuilding a released BO instead of reusing it = Clean Core violation |

**Decision rule.**
- A **released RAP/S/4/3rd-party OData V4** service exists for the data → **CONSUME** it (offline-first via EDMX).
- The domain is **new to BTP** and you own it → **BUILD** a CAP service (`cap-skill`).
- Mixed (own data that *references* released master data) → **BUILD CAP for your data**, **CONSUME the released service** for the reference data via destination.
- No backend at all (UX prototype) → UI-only + mock.

Never duplicate a released service into CAP just to "have it locally" — instead capture its **EDMX** and mock that (offline-first), then proxy to the real one.

---

## 2. The EDMX offline-first flow (for any *consume* answer)

The goal: develop fully offline against the service contract, then flip to the real backend with one script — without ever blocking on system access.

```
 Developer supplies $metadata / EDMX  ──▶  place at webapp/localService/<service>/metadata.xml
            │
            ├──▶  MOCK  (offline)   sap-fe-mockserver + generated sample data  →  npm run start:mock
            │
            └──▶  PROXY (real)      fiori-tools-proxy backend (url | destination) →  npm run start:proxy
                                     manifest dataSources.<service>.settings.localUri → the EDMX
```

Steps:

1. **Acquire the contract.** Ask the developer for the service's `$metadata` (EDMX) file. (From a browser: `<service-url>/$metadata`; from BAS: the service catalog; from a colleague: the saved `.xml`/`.edmx`.) This is the **offline-first** anchor — no system access needed afterwards to build the UI.
2. **Place it** at `webapp/localService/<service>/metadata.xml` and point `manifest.json` → `dataSources.<service>.settings.localUri` at it.
3. **Generate the mock** with `mcp__intent2app__gen_mock_from_edmx` (or by hand): it copies the EDMX, generates sample data per entity set under `…/data/`, and writes `ui5-mock.yaml` with `sap-fe-mockserver`. Run `npm run start:mock`.
4. **Configure the proxy** for the real service: `fiori-tools-proxy` `backend` block — `url` in VS Code, `destination` in BAS (no URL/secret in the repo). Run `npm run start:proxy`. (This is exactly how the freestyle `project1` proxies `/V4`.)
5. **Always generate both** mock and proxy config; flip with the `start:mock` / `start:proxy` scripts.

> CAP is different: there is no external EDMX to fetch — the contract **is** your local model. `cds watch --in-memory` serves service + UI same-origin at `http://localhost:4004`, so **no proxy and no mock server** are needed. Use `cds compile '*' --to serviceinfo` to get the service URL/entity sets.

---

## 3. Annotation strategy for consumed services

When you consume a service you still need Fiori UI annotations (LineItem, HeaderInfo, SelectionFields, etc.). There are two clean places to put them — choose by **reusability and ownership**, and keep Clean Core in mind.

| Aspect | Backend CDS **metadata-extension** | Local **`annotation.xml`** |
|---|---|---|
| Where it lives | On-stack, alongside the released CDS/RAP service (a metadata extension / `annotate` on the projection) | In the Fiori app: `webapp/annotations/annotation.xml`, referenced from `manifest.json` `dataSources` |
| Best for | **Reusable** UI semantics every consumer should share (labels, value lists, criticality) | **App-specific** UI only relevant to this one app |
| Clean Core | **Preferred** — semantics stay with the service, upgrade-safe, no app duplication; still additive (never modifies the core object) | Clean for app-local UI; avoid putting reusable semantics here (they drift across apps) |
| Upgrade impact | Travels with the service; one place to maintain | App owns it; re-do per app |
| Caveat | Requires on-stack/RAP authoring rights | None beyond the app |

**Recommended default:** put reusable, service-level semantics in a **backend metadata-extension** (Clean Core preferred), and keep only genuinely app-specific layout in a **local `annotation.xml`**. A **mix** is normal and is what Gate G2's follow-up offers. Either way, **never modify the core service** — both options are additive.

For CAP backends you build, annotations live in `srv/annotations.cds` (see `cap-skill`/`fiori-elements`) — the same metadata-extension idea, but it's your own service so there's no "core" to protect.

Authoring the actual annotation content (per floorplan) is the `fiori-elements` skill's job; this section only decides **where** they go.

---

## 4. Pointers

- Mock generation, `ui5-mock.yaml`, `localUri` wiring → `cap-integration/references/edmx-and-mock.md`.
- Proxy `backend` block, VS Code vs BAS, `start:mock`/`start:proxy` → `cap-integration/references/local-proxy.md`.
- BAS destination setup + auth (OAuth2SAMLBearerAssertion / PrincipalPropagation) → `cap-integration/references/bas-destinations.md`.
- Deploy (approuter `xs-app.json`, `mta.yaml`) → `cap-integration/references/deploy-approuter-mta.md`.
- Building the CAP service itself → `cap-skill` (`cds-modeling.md`, `service-layer.md`, `authorization.md`).
- Clean Core tiers / released-API discipline → `clean-core.md`.
