*Part of the i18n-completeness skill.*

# Manifest Locale Configuration

## Complete `manifest.json` i18n block

Both `sap.app.i18n` (the resource bundle declaration) and `sap.ui5.models` (the runtime
ResourceModel binding) must be correctly configured. A mismatch between them causes labels
to resolve at build time but fail at runtime.

```json
{
  "sap.app": {
    "id": "com.example.myapp",
    "i18n": {
      "bundleName": "com.example.myapp.i18n.i18n",
      "supportedLocales": ["", "de", "fr", "ja"],
      "fallbackLocale": ""
    }
  },

  "sap.ui5": {
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "com.example.myapp.i18n.i18n",
          "supportedLocales": ["", "de", "fr", "ja"],
          "fallbackLocale": ""
        }
      }
    }
  }
}
```

**Rules:**
- `bundleName` in `sap.app.i18n` and `sap.ui5.models.i18n.settings` must be identical.
- `supportedLocales` in both sections must be identical.
- `fallbackLocale` must equal one entry in `supportedLocales` (typically `""`).
- The `bundleName` format: `<namespace>.i18n.i18n` → resolves to `webapp/i18n/i18n.properties`.

---

## Locale file naming

| `supportedLocales` entry | File path |
|---|---|
| `""` | `webapp/i18n/i18n.properties` |
| `"de"` | `webapp/i18n/i18n_de.properties` |
| `"fr"` | `webapp/i18n/i18n_fr.properties` |
| `"zh_CN"` | `webapp/i18n/i18n_zh_CN.properties` |
| `"pt_BR"` | `webapp/i18n/i18n_pt_BR.properties` |

Language subtags use underscore (`_`), not hyphen (`-`), in the file name.

---

## Common mistakes and their runtime symptoms

| Mistake | Symptom | Fix |
|---|---|---|
| `supportedLocales` absent | Browser requests every locale; English always shown | Add `supportedLocales: ["", ...]` |
| `fallbackLocale` absent | Unpredictable fallback behaviour across browser versions | Always set `fallbackLocale: ""` |
| `bundleName` mismatch between `sap.app` and `sap.ui5` | Labels show in developer preview but blank in some environments | Make both `bundleName` values identical |
| Locale file missing for declared locale | Users in that locale see the fallback locale labels (silent) | Create the missing `i18n_<locale>.properties` file |
| Hyphen instead of underscore in file name | File not found → falls back silently | Rename `i18n_zh-CN.properties` → `i18n_zh_CN.properties` |
| Wrong `bundleName` (extra or missing segment) | All labels show as raw key strings | Count segments — must match `webapp/i18n/i18n.properties` path exactly |

---

## Minimum viable root i18n.properties

Every app needs at minimum these keys (referenced by Fiori Elements and the shell):

```properties
# App metadata
appTitle=My Application Title
appDescription=My Application Description

# Entity labels (examples — add one per entity and key field)
orderNo=Order Number
customer=Customer
status=Status
grossAmount=Total Amount

# Action labels
submit=Submit
approve=Approve
reject=Reject

# Validation messages
ORDERNO_REQUIRED=Order number is required
AMOUNT_NEGATIVE=Amount must be greater than zero
```

Keys referenced in `@Common.Label` annotations and XML view bindings (`{i18n>keyName}`) must
exist in `i18n.properties`. A missing key renders as the raw key string enclosed in `{}`.

---

## Locale file content rules

- Each locale file (`i18n_de.properties`) must contain **all the same keys** as `i18n.properties`.
- Comments start with `#`.
- Values support simple HTML entities but not full HTML — use `&amp;`, `&lt;`, `&gt;` only.
- Multi-line values are not supported in `.properties` format — keep values single-line.
- Parameter substitution uses `{0}`, `{1}`: `itemCount=Found {0} items`.
