*Part of the destinations-and-services skill.*

# BAS destinations

Configuring a destination in SAP Business Application Studio / the BTP subaccount, the auth types you'll actually use (`OAuth2SAMLBearerAssertion`, `PrincipalPropagation`), referencing it by name from the proxy, and the no-secrets-in-the-repo rule.

A **destination** is a named, centrally-managed connection (URL + auth) defined in the BTP subaccount. The app refers to it **by name** only — so the URL and credentials live in BTP, never in the code. This is a HARD CONSTRAINT: no hardcoded URLs or secrets.

---

## 1. Configure a destination (subaccount)

In the BTP cockpit → your **subaccount** → **Connectivity → Destinations → New Destination** (BAS reads subaccount destinations directly):

| Field | Value (example) | Notes |
|---|---|---|
| **Name** | `S4_SALES` | The name the proxy/approuter references |
| **Type** | `HTTP` | OData over HTTP |
| **URL** | `https://my-s4-system:443` | The released-service host (no path here; the app adds `/sap/opu/odata4/...`) |
| **Proxy Type** | `Internet` or `OnPremise` | `OnPremise` routes via the Cloud Connector |
| **Authentication** | see §2 | How the user is authenticated to the backend |

Common **Additional Properties** for Fiori/HTML5 consumption:

```
HTML5.DynamicDestination = true        # allow runtime use by the app
WebIDEEnabled            = true        # show it in BAS service center
WebIDEUsage             = odata_gen    # generic OData (or odata_abap for S/4)
sap-client              = 100          # backend client, if required
```

After saving, use **Check Connection** in the cockpit/BAS to verify reachability and auth before wiring the app.

---

## 2. Auth types you'll use

Pick the auth type by how identity should flow from the user to the backend. For Clean Core, the backend must be a **released** service.

- **`OAuth2SAMLBearerAssertion`** — the logged-in user's identity is forwarded as a SAML bearer assertion exchanged for an OAuth token at the backend. Use for **principal propagation to cloud/OAuth-protected** S/4 services. Requires trust + a configured OAuth client on the backend.
- **`PrincipalPropagation`** — forwards the authenticated user's identity through the **Cloud Connector** to an **on-premise** backend (typically with `Proxy Type: OnPremise`). Use for on-prem S/4 where the backend should act as the real user.
- **`NoAuthentication`** — only for truly public/anonymous services (rare; never for business data).
- **`BasicAuthentication`** — technical user + password stored on the destination. Acceptable for dev/test against a sandbox; avoid for production user-context scenarios (it's a shared technical identity, not the real user).

Recommended default for S/4 consumption with real user context: **`PrincipalPropagation`** (on-prem via Cloud Connector) or **`OAuth2SAMLBearerAssertion`** (cloud) — both carry the *user's* identity so backend `@restrict`/authorizations apply to the actual person.

---

## 3. Reference it by name

In the local proxy (`ui5.yaml` on BAS), name the destination instead of a URL:

```yaml
server:
  customMiddleware:
    - name: fiori-tools-proxy
      afterMiddleware: compression
      configuration:
        backend:
          - path: /sap/opu/odata4/sap/<service>/srvd/...   # the service path the app calls
            destination: S4_SALES                          # ← the subaccount destination name
```

At **deploy** time the same destination name is referenced from the approuter `xs-app.json` route and declared in `mta.yaml` (see `deploy-approuter-mta.md`). The name is the single contract that ties local dev, BAS, and deployment together — only the destination's *definition* differs per landscape.

---

## 4. No secrets in the repo

- The repo contains **only the destination name** (`destination: S4_SALES`) — never a URL, user, password, client secret, or token.
- VS Code (no subaccount destinations) uses a plain `url:` in the proxy **for local dev only**; switch to `destination:` for BAS/deploy. Keep the URL out of committed config where possible (or treat it as a dev-only convenience pointing at a public sandbox like `services.odata.org`).
- Backend endpoints and credentials are managed centrally in BTP; rotating them never touches the app code.
- This satisfies the Clean Core rule: the destination must point at a **released/public** service, and connection details are externalised.

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `destination not found` | Name typo or destination in the wrong subaccount | Match `destination:` to the exact subaccount destination name |
| 401/403 only on the real backend | Auth type / trust misconfigured | Verify `OAuth2SAMLBearerAssertion` trust or `PrincipalPropagation` + Cloud Connector mapping; re-run Check Connection |
| Works in BAS, fails after deploy | Destination not declared in `mta.yaml` / not bound to approuter | Add the destination resource and bind it (see `deploy-approuter-mta.md`) |
| On-prem service unreachable | Cloud Connector down or path not exposed | Confirm the Cloud Connector mapping exposes the service path; `Proxy Type: OnPremise` |
