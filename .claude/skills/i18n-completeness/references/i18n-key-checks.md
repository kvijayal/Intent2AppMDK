*Part of the i18n-completeness skill.*

# i18n Key Checks

Patterns for detecting duplicate keys, dead keys, and missing referenced keys across all
i18n files and the UI source that references them.

---

## 1. Duplicate key detection

Duplicate keys in a `.properties` file cause silent incorrect rendering — the parser uses
the last value, but the first value may be the intended one. There is no runtime warning.

```bash
# Check root file
grep -v "^#" webapp/i18n/i18n.properties | grep "=" | cut -d'=' -f1 | sort | uniq -d

# Check all locale files at once
for f in webapp/i18n/i18n*.properties; do
  dups=$(grep -v "^#" "$f" | grep "=" | cut -d'=' -f1 | sort | uniq -d)
  [ -n "$dups" ] && echo "=== Duplicates in $f ===" && echo "$dups"
done
```

**Pass:** no output. Every printed key is a duplicate — remove the redundant entry.

---

## 2. Missing referenced keys (CRITICAL)

Keys used in annotations or XML views but absent from `i18n.properties` render as raw strings
(`{myMissingKey}`) with no error. This is a CRITICAL finding — user-visible broken labels.

```bash
# Step 1: collect all referenced i18n keys from views, fragments, and annotations
grep -roh "{i18n>[^}]*}" \
  webapp/view/ webapp/fragment/ webapp/ext/ srv/annotations.cds \
  2>/dev/null \
  | sed "s/{i18n>//;s/}//" \
  | sort -u > /tmp/i18n_referenced.txt

# Step 2: collect all defined keys
grep -v "^#" webapp/i18n/i18n.properties \
  | grep "=" | cut -d'=' -f1 | sort -u > /tmp/i18n_defined.txt

# Step 3: referenced but not defined = CRITICAL missing keys
echo "=== CRITICAL: referenced but missing from i18n.properties ==="
comm -23 /tmp/i18n_referenced.txt /tmp/i18n_defined.txt
```

Any key printed = a label that renders broken in the UI. Add it to `i18n.properties` and all
locale files.

---

## 3. Dead key detection (WARNING)

Keys defined in `i18n.properties` but never referenced anywhere in the app are dead entries.
They don't break anything but indicate drift — often caused by deleting an annotation or view
element without cleaning up the i18n file.

```bash
# Reuse /tmp/i18n_defined.txt and /tmp/i18n_referenced.txt from check 2 above
echo "=== WARNING: defined but never referenced (dead keys) ==="
comm -23 /tmp/i18n_defined.txt /tmp/i18n_referenced.txt
```

Dead keys are safe to remove. Flag as WARNING; do not block build.

---

## 4. Locale completeness — missing translations

For each locale file, check that every key from `i18n.properties` is also present:

```bash
# Defined keys in root file
grep -v "^#" webapp/i18n/i18n.properties | grep "=" | cut -d'=' -f1 | sort > /tmp/root_keys.txt

# For each locale file, report keys missing from the translation
for f in webapp/i18n/i18n_*.properties; do
  locale=$(basename "$f" .properties | sed 's/i18n_//')
  locale_keys=$(grep -v "^#" "$f" | grep "=" | cut -d'=' -f1 | sort)
  missing=$(comm -23 /tmp/root_keys.txt <(echo "$locale_keys"))
  [ -n "$missing" ] && echo "=== Missing in $locale ===" && echo "$missing"
done
```

Missing keys in a locale file silently fall back to `fallbackLocale` — acceptable only if
that locale is a partial translation (must be documented).

---

## 5. Annotation-specific key patterns

CAP annotations reference i18n keys in multiple syntax forms — make sure the grep in check 2
covers all of them:

```cds
// Direct i18n reference in CDS annotation
orderNo @(Common.Label: '{i18n>orderNo}');
```

```xml
<!-- XML view binding -->
<Label text="{i18n>customerLabel}" />
<Button text="{i18n>submitAction}" />
<Title text="{i18n>sectionTitle}" />
```

The grep pattern `{i18n>[^}]*}` catches all these forms.

---

## 6. Key naming conventions

- Use camelCase: `orderNumber`, `customerName`, `submitAction`
- Suffix action labels with `Action`: `submitAction`, `approveAction`
- Suffix validation messages with the field name: `ORDERNO_REQUIRED`, `AMOUNT_NEGATIVE`
- Never use dots in keys — `.properties` parsers treat them inconsistently across environments

Bad: `order.number.label` → Good: `orderNumberLabel`
