---
name: mdk-quality-checklist
version: 2.0.0
description: >
  Apply automatically during ANY MDK development task — creating a new app,
  modifying an existing project, SSAM customization, or SSAM upgrade.
  Contains non-negotiable rules for project structure, i18n, rules, offline,
  performance, security, and code review. NOT just for when someone asks about
  best practices — load this alongside mdk-app-builder, mdk-ssam-guide, and
  mdk-ssam-upgrade whenever writing or modifying MDK files.
  Trigger on: any MDK create, generate, modify, enhance, customize, or upgrade task.
source: Intent2App — MDK quality standards
---

# MDK Quality Checklist

These rules apply to ALL MDK development — standalone apps, SSAM customizations,
and SSAM upgrades. Check every generated or modified file against this list.

---

## Project structure rules

- One folder per entity: `Pages/WorkOrders/`, `Rules/WorkOrders/`, `Actions/WorkOrders/`
- Filename must match `_Name` property exactly: `WorkOrders_List.page` → `"_Name": "WorkOrders_List"`
- Never put all pages/rules in the root folder — always use entity subfolders
- Never hardcode strings — every user-visible string goes in `i18n/i18n.properties`

---

## i18n rules

- Every label, caption, title, placeholder, and message → `$(L,keyName)`
- Key format: `EntityName_fieldDescription` e.g. `WorkOrders_StatusLabel`
- Never use `$(L,key)` in rule files — only in metadata `.page`/`.action` files
- Add key to ALL `i18n_*.properties` files when adding to `i18n.properties`

---

## Rule file rules

- Always `export default function FunctionName(clientAPI)` — named export, named function
- Never use `console.log` in production rules — use `Logger` if available
- Always handle Promise rejections — every `.then()` needs a `.catch()`
- Never access `clientAPI.binding` without null check when binding may be absent
- Import paths: use relative paths from the rule file location to SAPAssetManager

```javascript
// Correct
export default function WorkOrders_IsVisible(clientAPI) {
  const binding = clientAPI.binding;
  if (!binding) return false;
  return binding.Status !== 'CLSD';
}
```

---

## Offline rules

- Never call OData directly in a rule if the app is offline-capable — use `clientAPI.read()`
- Always use `DefiningRequests` for data the offline store needs
- Test sync with poor connectivity — not just happy path
- Never assume data is fresh — check `clientAPI.binding` for stale state

---

## Performance rules

- Avoid `evaluateTargetPath` in loops — cache the result
- Never fetch large entity sets without `$top` / `$filter` limits
- Use `$expand` to fetch related data in one call instead of multiple reads
- Minimize rules on `OnLoaded` — defer heavy work to user action

---

## Security rules

- Never hardcode credentials, tokens, or URLs in rule files
- Always use Mobile Services destinations — never hardcode backend URLs
- Validate input in rules before sending to OData — never trust UI values blindly

---

## Code review checklist — before every commit

- [ ] Every new file has correct `_Name` matching filename
- [ ] No hardcoded strings — all user-visible text in i18n
- [ ] All rule files export default named function
- [ ] All Promises have `.catch()` handlers
- [ ] No files written to `SAPAssetManager/` (SSAM projects)
- [ ] Every new SSAM rule has a CIM entry (SSAM projects)
- [ ] `mdk-manage validate` → 0 errors
- [ ] Tested on both iOS and Android targets
