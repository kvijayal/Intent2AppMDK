---
name: i18n-completeness
description: >
  i18n completeness checks for Intent2App — manifest locale configuration (supportedLocales,
  fallbackLocale), i18n file existence per declared locale, duplicate key detection, and dead
  key detection. Load when reviewing or building any Fiori Elements or Freestyle UI5 app, or
  when blank labels appear in non-English browsers. Keywords: i18n, supportedLocales,
  fallbackLocale, locale, translation, i18n.properties, duplicate keys, dead keys, manifest
  localization, ResourceModel, bundleName.
---

# i18n Completeness

> Complements `fiori-bootstrap` (manifest structure) and `fiori-elements` (annotation labels).
> A missing `fallbackLocale` or undeclared `supportedLocales` is the most common i18n failure
> in generated apps — labels render as raw key strings (`{appTitle}`) in non-English browsers
> with no runtime error.

## The 4 checks (run in order)

### Check 1 — Manifest locale configuration

`manifest.json` `sap.app.i18n` must declare both `supportedLocales` and `fallbackLocale`:

```json
"sap.app": {
  "i18n": {
    "bundleName": "<namespace>.i18n.i18n",
    "supportedLocales": ["", "de", "fr"],
    "fallbackLocale": ""
  }
}
```

Rules:
- `""` (empty string) = the root `i18n.properties` file (no locale suffix). Must always be in the array.
- `fallbackLocale` must equal one value already in `supportedLocales`.
- Without `supportedLocales`, the browser fires a request per possible locale and silently falls back — no error shown, but users see English regardless of browser language.

**Detect missing config:**
```bash
node -e "const m=require('./webapp/manifest.json'); const i=m['sap.app']?.i18n;
  if(!i?.supportedLocales) console.log('MISSING: supportedLocales');
  if(!i?.fallbackLocale && i?.fallbackLocale !== '') console.log('MISSING: fallbackLocale');"
```

See [`references/manifest-locale-config.md`](references/manifest-locale-config.md) for the
full manifest block, sap.ui5 ResourceModel registration, and common mistakes.

---

### Check 2 — i18n file existence per declared locale

Every locale in `supportedLocales` must have a corresponding file:

| `supportedLocales` entry | Required file |
|---|---|
| `""` | `webapp/i18n/i18n.properties` |
| `"de"` | `webapp/i18n/i18n_de.properties` |
| `"fr"` | `webapp/i18n/i18n_fr.properties` |

**Check (list what exists vs what is declared):**
```bash
ls webapp/i18n/i18n*.properties
```

If a declared locale file is missing, labels fall back to `fallbackLocale`. If `fallbackLocale`
itself has no file, every label renders as its raw key string.

---

### Check 3 — Duplicate keys

Duplicate keys in an i18n file cause silent incorrect rendering — the last definition wins.

```bash
grep -v "^#" webapp/i18n/i18n.properties | grep "=" | cut -d'=' -f1 | sort | uniq -d
```

**Pass:** no output. Any key printed is a duplicate — remove or rename.

Run the same command for each locale file (`i18n_de.properties`, etc.).

---

### Check 4 — Dead keys (unreferenced i18n entries)

Keys defined in i18n but never referenced in annotations, XML views, or manifest are dead entries.
More importantly, dead keys can indicate that an annotation is referencing a *wrong* key name.

```bash
# All defined keys
grep -v "^#" webapp/i18n/i18n.properties | grep "=" | cut -d'=' -f1 | sort > /tmp/i18n_defined.txt

# All referenced keys ({i18n>keyName} syntax across views, fragments, annotations)
grep -roh "{i18n>[^}]*}" webapp/view/ webapp/fragment/ webapp/ext/ srv/annotations.cds 2>/dev/null \
  | sed "s/{i18n>//;s/}//" | sort -u > /tmp/i18n_referenced.txt

# Keys defined but never referenced
comm -23 /tmp/i18n_defined.txt /tmp/i18n_referenced.txt
```

Dead keys = WARNING (flag, don't block). Missing referenced keys = CRITICAL (labels break).

See [`references/i18n-key-checks.md`](references/i18n-key-checks.md) for locale file naming
rules, the full key-check patterns, and how to audit locale-specific files for missing translations.

---

## Checklist

- [ ] `manifest.json` `sap.app.i18n` has `supportedLocales` with `""` as one entry
- [ ] `manifest.json` `sap.app.i18n` has `fallbackLocale` set (typically `""`)
- [ ] `webapp/i18n/i18n.properties` exists
- [ ] For every non-empty `supportedLocales` entry, `i18n_<locale>.properties` exists
- [ ] No duplicate keys in any i18n file
- [ ] No referenced i18n keys that are missing from `i18n.properties` (CRITICAL)
- [ ] No dead (unreferenced) i18n keys (WARNING)
