*Part of the review-quality-checks skill.*

# Security Checks

Inline security risks that apply regardless of project topology. CORS / xs-app.json checks
are in `deployment-checklist → xs-app-security.md`; this file covers source-level risks.

---

## 1. Hardcoded secrets (CRITICAL — always)

Credentials or API keys embedded in source files bypass secret management and leak via git history.

**Grep:**
```bash
grep -rn \
  "password\s*=\|apiKey\s*=\|secret\s*=\|Bearer \|token\s*=\|clientSecret\s*=" \
  srv/ app/ db/ --include="*.js" --include="*.ts" --include="*.cds" \
  2>/dev/null | grep -iv "test\|mock\|sample\|placeholder\|TODO"
```

Also check committed config files:
```bash
test -f .env && echo "CRITICAL: .env is committed"
test -f default-env.json && grep -l "password\|clientsecret\|token" default-env.json 2>/dev/null \
  && echo "CRITICAL: default-env.json with credentials is committed"
```

**Fix:** Move secrets to BTP Credential Store, environment variables, or `cds.env` bound service credentials. Add `.env` and `default-env.json` to `.gitignore`.

---

## 2. OData injection (CRITICAL — CAP_PRESENT)

Concatenating unvalidated `req.query` or `req.data` values directly into a CQL string bypasses
CAP's parameterised query protection and enables data exfiltration or destruction.

**Pattern to flag:**
```javascript
// CRITICAL — string interpolation in CQL
const result = await cds.run(`SELECT * FROM Orders WHERE customer = '${req.data.name}'`);
```

**Grep:**
```bash
grep -rn "cds\.run\s*(\`\|SELECT.*\${" srv/ 2>/dev/null
```

**Fix:** Use structured CQL with object-form predicates:
```javascript
// Correct
const result = await SELECT.from('Orders').where({ customer: req.data.name });
```

---

## 3. Exposed actions without `@restrict` (CRITICAL — CAP_PRESENT)

Bound or unbound actions without an explicit `@restrict` are callable by any authenticated user,
regardless of the entity-level restrictions. Entity `@restrict` does not propagate to actions.

**Grep:**
```bash
grep -n "action\|function" srv/service.cds | grep -v "@restrict\|@readonly\|//"
```

Cross-reference every action/function name against `@restrict` annotations in the same file.
Any action with no `@restrict` and no `@readonly` = CRITICAL.

---

## 4. SSRF — unvalidated outbound URLs (CRITICAL — CAP_PRESENT)

A handler that builds an outbound HTTP URL from `req.data` or `req.query` values allows an
attacker to make the CAP service call arbitrary internal endpoints.

**Pattern to flag:**
```javascript
// CRITICAL — attacker controls the URL
const url = `https://${req.data.host}/api/data`;
const resp = await fetch(url);
```

**Grep:**
```bash
grep -rn "fetch(\|axios\.\|https\?\.get\|https\?\.post" srv/ 2>/dev/null \
  | grep -E "req\.(data|query)"
```

**Fix:** Use only allowlisted destination names from the BTP Destination Service — never construct URLs from request data.

---

## 5. Principal propagation on S/4HANA destinations (CRITICAL — DEPLOYMENT_PRESENT)

BTP destinations used for calls to S/4HANA or on-premise systems must propagate the user's
identity via `OAuth2SAMLBearerAssertion` or `PrincipalPropagation`. Using `BasicAuthentication`
collapses all user calls to a single technical user, breaking per-user authorisation and audit.

**Check:**
- Read `approuter/xs-app.json` or `mta.yaml` destination config.
- Any destination with `Type: HTTP` that proxies to an on-premise or S/4HANA URL and uses
  `Authentication: BasicAuthentication` = CRITICAL if the TDD specifies per-user data isolation.

**Fix:** Change destination `Authentication` to `OAuth2SAMLBearerAssertion` and ensure
`SystemUser` is not set (system user disables principal propagation).
