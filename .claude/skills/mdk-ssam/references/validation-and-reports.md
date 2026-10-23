# Validation Checks and Report Templates

## Part A — Post-Patch Validation (Phase 9)

Eight checks run after apply. Each returns `{ check, severity:'ERROR'|'WARNING', file, message, fix }`.

### Runner

```javascript
function runAllChecks({ cim, SAP_DIR, CUSTOM_DIR, updatedFiles, preApplyState, patchDeletedFiles }) {
  return [
    ...checkCimIntegrity(cim, SAP_DIR, CUSTOM_DIR),
    ...checkJsonValidity(updatedFiles, CUSTOM_DIR),
    ...checkI18nCoverage(updatedFiles, CUSTOM_DIR, SAP_DIR),
    ...checkRulePaths(updatedFiles, CUSTOM_DIR, SAP_DIR),
    ...checkAppDefinition(SAP_DIR, CUSTOM_DIR, preApplyState),
    ...checkDuplicateObjects(CUSTOM_DIR, updatedFiles),
    ...checkXmlWellFormedness(updatedFiles, CUSTOM_DIR),
    ...checkBrokenDependencies(cim, CUSTOM_DIR, SAP_DIR, patchDeletedFiles),
  ];
}
```

### Check 1 — CIM Reference Integrity

```javascript
function checkCimIntegrity(cim, SAP_DIR, CUSTOM_DIR) {
  const errors=[], seen=new Set();
  for (const ip of cim.IntegrationPoints) {
    const sapRel=ip.Target.replace(/^\/[^/]+\//,''), zRel=ip.Source.replace(/^\/[^/]+\//,'');
    if (!fs.existsSync(path.join(SAP_DIR,   sapRel)))
      errors.push({check:'CIM_TARGET_MISSING',severity:'ERROR',file:ip.Target,
        message:`CIM Target not on disk: ${ip.Target}`,
        fix:'Patch deleted/renamed this file. Update CIM Target or remove entry.'});
    if (!fs.existsSync(path.join(CUSTOM_DIR, zRel)))
      errors.push({check:'CIM_SOURCE_MISSING',severity:'ERROR',file:ip.Source,
        message:`CIM Source not on disk: ${ip.Source}`,
        fix:'Recreate Z project file or remove CIM entry.'});
    if (seen.has(ip.Target))
      errors.push({check:'CIM_DUPLICATE_TARGET',severity:'WARNING',file:ip.Target,
        message:`Duplicate CIM Target: ${ip.Target}`,fix:'Remove duplicate entry.'});
    seen.add(ip.Target);
  }
  return errors;
}
```

### Check 2 — JSON Validity

```javascript
const JSON_EXTS=new Set(['.json','.page','.action','.rule','.service','.app',
  '.appconfig','.designtime','.metadata','.style','.globaldef']);

function checkJsonValidity(updatedFiles, CUSTOM_DIR) {
  const errors=[];
  for (const f of updatedFiles) {
    if (!JSON_EXTS.has(path.extname(f).toLowerCase())) continue;
    const abs=path.join(CUSTOM_DIR,f);
    if (!fs.existsSync(abs)) continue;
    try { JSON.parse(fs.readFileSync(abs,'utf8')); }
    catch(e) {
      errors.push({check:'INVALID_JSON',severity:'ERROR',file:f,
        message:`Invalid JSON: ${e.message}`,fix:`Fix JSON syntax in ${f}.`});
    }
  }
  return errors;
}
```

### Check 3 — i18n Key Coverage

```javascript
function checkI18nCoverage(updatedFiles, CUSTOM_DIR, SAP_DIR) {
  const errors=[], keys=new Set();
  const loadProps=p=>{ if(!fs.existsSync(p))return;
    for (const line of fs.readFileSync(p,'utf8').split('\n'))
      if (!line.startsWith('#')&&line.includes('=')) keys.add(line.slice(0,line.indexOf('=')).trim()); };
  loadProps(path.join(SAP_DIR,'i18n','i18n.properties'));
  loadProps(path.join(CUSTOM_DIR,'i18n','i18n.properties'));
  const re=/\{i18n>([^}]+)\}/g;
  for (const f of updatedFiles) {
    const ext=path.extname(f).toLowerCase();
    if (![...JSON_EXTS,'.js','.ts'].some(e=>ext===e)) continue;
    const abs=path.join(CUSTOM_DIR,f); if(!fs.existsSync(abs)) continue;
    const content=fs.readFileSync(abs,'utf8'); let m;
    while((m=re.exec(content))!==null) {
      if(!keys.has(m[1])) {
        const line=content.slice(0,m.index).split('\n').length;
        errors.push({check:'MISSING_I18N_KEY',severity:'WARNING',file:f,
          message:`Missing i18n key "${m[1]}" at ${f}:${line}`,
          fix:`Add "${m[1]}=<value>" to ${CUSTOM_DIR}/i18n/i18n.properties`});
      }
    }
  }
  return errors;
}
```

### Check 4 — Rule Path Resolution

```javascript
function checkRulePaths(updatedFiles, CUSTOM_DIR, SAP_DIR) {
  const errors=[];
  const appName=detectAppName(SAP_DIR);
  const ruleRe=/['"](\/?[^'"]+\.js)['"]/g;
  for (const f of updatedFiles) {
    if (!JSON_EXTS.has(path.extname(f).toLowerCase())) continue;
    const abs=path.join(CUSTOM_DIR,f); if(!fs.existsSync(abs)) continue;
    const content=fs.readFileSync(abs,'utf8'); let m;
    while((m=ruleRe.exec(content))!==null) {
      const ref=m[1], relRef=ref.replace(new RegExp(`^/${appName}/`),'');
      const cAbs=path.join(CUSTOM_DIR,relRef.replace(/^\//,'')), sAbs=path.join(SAP_DIR,relRef.replace(/^\//,''));
      if(!fs.existsSync(cAbs)&&!fs.existsSync(sAbs)) {
        const line=content.slice(0,m.index).split('\n').length;
        errors.push({check:'UNRESOLVED_RULE_PATH',severity:'ERROR',file:f,
          message:`Unresolved rule: "${ref}" at ${f}:${line}`,
          fix:'Update reference or restore rule file.'});
      }
    }
  }
  return errors;
}

function detectAppName(SAP_DIR) {
  try { return JSON.parse(fs.readFileSync(path.join(SAP_DIR,'Application.app'),'utf8'))._Name||'SAPAssetManager'; }
  catch(_) { return 'SAPAssetManager'; }
}
```

### Check 5 — Application Definition Consistency

```javascript
function checkAppDefinition(SAP_DIR, CUSTOM_DIR, pre) {
  const errors=[];
  const ap=path.join(SAP_DIR,'Application.app');
  if (!fs.existsSync(ap)) {
    errors.push({check:'MISSING_APP_DEF',severity:'ERROR',file:'Application.app',
      message:'Application.app missing after patch',fix:'Restore from backup.'}); return errors; }
  let app; try { app=JSON.parse(fs.readFileSync(ap,'utf8')); }
  catch(e) { errors.push({check:'INVALID_APP_JSON',severity:'ERROR',file:'Application.app',message:e.message}); return errors; }
  if (pre._Name&&app._Name!==pre._Name)
    errors.push({check:'APP_NAME_CHANGED',severity:'ERROR',file:'Application.app',
      message:`_Name: "${pre._Name}" → "${app._Name}"`,fix:'Restore original _Name.'});
  if (pre._SchemaVersion&&app._SchemaVersion!==pre._SchemaVersion)
    errors.push({check:'SCHEMA_VERSION_BUMP',severity:'WARNING',file:'Application.app',
      message:`Schema: "${pre._SchemaVersion}" → "${app._SchemaVersion}"`,fix:'Run mdk-migration skill.'});
  const zAp=path.join(CUSTOM_DIR,'Application.app');
  if (fs.existsSync(zAp)) {
    try { const z=JSON.parse(fs.readFileSync(zAp,'utf8'));
      if (z._SchemaVersion!==app._SchemaVersion)
        errors.push({check:'Z_SCHEMA_MISMATCH',severity:'WARNING',file:'Z/Application.app',
          message:`Z schema ${z._SchemaVersion} ≠ SAP ${app._SchemaVersion}`,
          fix:'Update Z Application.app _SchemaVersion to match.'}); }
    catch(_) {}
  }
  return errors;
}
```

### Check 6 — Duplicate Object Detection

```javascript
function checkDuplicateObjects(CUSTOM_DIR, updatedFiles) {
  const errors=[], byDir={};
  for (const f of updatedFiles) { const d=path.dirname(f); (byDir[d]=byDir[d]||[]).push(f); }
  for (const [dir,files] of Object.entries(byDir)) {
    const seen={};
    for (const f of files) {
      const abs=path.join(CUSTOM_DIR,f); if(!fs.existsSync(abs)) continue;
      try { const obj=JSON.parse(fs.readFileSync(abs,'utf8')), n=obj._Name; if(!n) continue;
        if (seen[n]) errors.push({check:'DUPLICATE_OBJECT_NAME',severity:'WARNING',file:f,
          message:`Duplicate _Name "${n}" in ${dir}/; also in ${seen[n]}`,fix:'Rename or remove duplicate.'});
        else seen[n]=f; }
      catch(_) {}
    }
  }
  return errors;
}
```

### Check 7 — XML Well-Formedness

```javascript
function checkXmlWellFormedness(updatedFiles, CUSTOM_DIR) {
  const errors=[];
  for (const f of updatedFiles) {
    if (path.extname(f).toLowerCase()!=='.xml') continue;
    const abs=path.join(CUSTOM_DIR,f); if(!fs.existsSync(abs)) continue;
    const content=fs.readFileSync(abs,'utf8'), stack=[];
    const re=/<\/?([A-Za-z][A-Za-z0-9_:.-]*)(?:\s[^>]*)?\s*\/?>/g; let m;
    while((m=re.exec(content))!==null) {
      const full=m[0], tag=m[1];
      if (full.startsWith('</')) {
        if (!stack.length||stack[stack.length-1]!==tag) {
          const line=content.slice(0,m.index).split('\n').length;
          errors.push({check:'MALFORMED_XML',severity:'ERROR',file:f,
            message:`Unexpected closing tag </${tag}> at ${f}:${line}`,fix:'Fix tag mismatch.'});
        } else stack.pop();
      } else if (!full.endsWith('/>')) stack.push(tag);
    }
    if (stack.length) errors.push({check:'UNCLOSED_XML',severity:'ERROR',file:f,
      message:`Unclosed tags: ${stack.join(', ')}`,fix:'Add missing closing tags.'});
  }
  return errors;
}
```

### Check 8 — Broken Dependency Detection

```javascript
function checkBrokenDependencies(cim, CUSTOM_DIR, SAP_DIR, patchDeletedFiles) {
  const errors=[];
  const appName=detectAppName(SAP_DIR);
  for (const ip of cim.IntegrationPoints) {
    const sapRel=ip.Target.replace(/^\/[^/]+\//,'');
    if (patchDeletedFiles.has(sapRel))
      errors.push({check:'CIM_TARGET_DELETED_BY_PATCH',severity:'ERROR',file:ip.Target,
        message:`Patch deleted a CIM-referenced file: ${ip.Target}`,
        fix:'Remove CIM entry or port customization to the replacement file.'});
  }
  const allZ=walkDir(CUSTOM_DIR).filter(f=>JSON_EXTS.has(path.extname(f).toLowerCase()));
  for (const f of allZ) {
    const abs=path.join(CUSTOM_DIR,f); if(!fs.existsSync(abs)) continue;
    const content=fs.readFileSync(abs,'utf8');
    for (const deleted of patchDeletedFiles) {
      if (content.includes(`/${appName}/${deleted}`)) {
        const line=content.split(`/${appName}/${deleted}`)[0].split('\n').length;
        errors.push({check:'BROKEN_REFERENCE',severity:'ERROR',file:f,
          message:`Z project references deleted SAP file "${deleted}" at ${f}:${line}`,
          fix:'Update reference to the replacement file or remove it.'});
      }
    }
  }
  return errors;
}
```

---

## Part B — Report Templates

### Template 1 — Report Header (Phase 7 opening)

```
══════════════════════════════════════════════════════════════════════
SSAM PATCH UPDATE — PRE-APPLY REPORT
══════════════════════════════════════════════════════════════════════
Project root  : <PROJECT_DIR>
Standard SAP  : <SAP_DIR>
Z project     : <CUSTOM_DIR | (none — standard-only mode)>
CIM file      : <CIM_FILE   | (none — standard-only mode)>
Patch package : <PATCH_PKG>
App name      : <PRE_APP._Name>
Schema version: <PRE_APP._SchemaVersion>
Generated     : <ISO 8601 timestamp>
Backup        : <backupPath>  ← SAP standard files only; ZSAPAssetManager not backed up
──────────────────────────────────────────────────────────────────────
Partial patch : <Yes — N files in patch / No — full package>
Files examined: <N total>   CIM IntegrationPoints: <N>
──────────────────────────────────────────────────────────────────────

=== BEFORE STATE — Customization Snapshot ===
  [MODIFIED ]  Rules/WorkOrders/Caption.js           sha:<short-hash>
  [UNMODIFIED] Pages/WorkOrders/WorkOrdersList.page  sha:<short-hash>  (= SAP base)
  ...

──────────────────────────────────────────────────────────────────────
CLASSIFICATION SUMMARY
  BLOCKING     Unresolvable: <N>   CONFLICT  Both changed (merge proposed): <N>
  SAFE         Auto-apply:   <N>   PATCH     Auto-apply (base matched):    <N>
  MERGE        Auto-merged:  <N>   ADDED     New SAP files:                <N>
  DELETED      SAP-removed:  <N>   CUST      Customer-only:                <N>
  CUSTOM-ADDED Customer-added: <N> RENAMED   Path moved:                   <N>
  UNCHANGED    No change:    <N>
══════════════════════════════════════════════════════════════════════
```

### Template 2 — Per-File Detail Block

```
──────────────────────────────────────────────────────────────────────
[<CLASS>] <relative/path/file.ext>    Severity rank: <N>
──────────────────────────────────────────────────────────────────────
CIM reference:
  Source → <ip.Source>
  Target → <ip.Target>

BEFORE (customer version vs SAP base):
<unified diff base→custom ≤20 lines>

Standard change (base → patch):
<unified diff base→patch ≤20 lines>

Customer customization (base → custom):
<unified diff base→custom ≤20 lines>

Conflict type: <name>
Why auto-merge is unsafe: <one or two sentences>

Proposed merged result:
<merged content or "Cannot compute — structural conflict">

Recommended: <one sentence>

Resolution options:
  [A] Keep customer version — apply SAP change manually on top
  [B] Take patch version    — reapply customer customization on top
  [C] Keep customer version — discard this SAP change
  [D] Take patch version    — discard customer customization
  [E] Manual merge          — edit Z project file directly
──────────────────────────────────────────────────────────────────────
```

### Template 3 — BLOCKING Message

```
BLOCKING: <relative/path/file.ext>
════════════════════════════════════════════════════════════════════════
Conflicting file: <relative path>
CIM reference:
  Source → <ip.Source>
  Target → <ip.Target>

Standard change (base → patch):
<unified diff ≤30 lines>

Customer customization (base → custom):
<unified diff ≤30 lines>

Conflict type: <name>  (severity rank <N>)
Why auto-merge is unsafe:
  <specific technical reason>

Proposed merged result:
  <merged content, or "Cannot compute — structural conflict">

Resolution options:
  [A] Keep customer version — apply SAP change manually on top
  [B] Take patch version    — reapply customer customization on top
  [C] Keep customer version — discard this SAP change
  [D] Take patch version    — discard customer customization
  [E] Manual merge          — edit Z project file directly

Re-run: /ssam-patch-update --resolve "<relative/path/file.ext>=<A|B|C|D|E>"
════════════════════════════════════════════════════════════════════════
```

### Template 4 — BLOCKING Summary

```
══════════════════════════════════════════════════════════════════════
BLOCKING CONFLICTS — Developer decision required before finalizing
══════════════════════════════════════════════════════════════════════
<N> file(s) require manual resolution:

  1. Rules/WorkOrders/WorkOrderListViewCaption.js
     Type: both-modified-function | Rank: 8
     Recommended: [A] keep customer, apply SAP change manually

  2. Pages/WorkOrders/WorkOrdersListPage.page
     Type: deleted-customized | Rank: 1
     Recommended: [A] retain Z page (SAP removed it; verify navigation)

  3. i18n/i18n.properties  (key: WorkOrders_Caption)
     Type: deleted-customized-key | Rank: 2
     Referenced in: Rules/WorkOrders/WorkOrdersHeader.js:12
     Recommended: [A] keep our key

Backup: <backupPath>   No changes made yet.
══════════════════════════════════════════════════════════════════════
```

### Template 5 — Approval Gate Prompt

```
──────────────────────────────────────────────────────────────────────
READY TO APPLY — CONFIRM
──────────────────────────────────────────────────────────────────────
Will apply automatically:
  ✓ <N> SAFE files       ✓ <N> PATCH files   ✓ <N> MERGE files
  ✓ <N> ADDED files      ✓ <N> DELETED files

Will NOT be touched:
  ✗ <N> BLOCKING conflicts (resolve first)
  ✗ <N> CONFLICT files (proposed merge available; confirm each)
  → <N> CUST/CUSTOM-ADDED (carry forward unchanged)

Backup: <backupPath>

Type 'apply' to proceed, or 'stop' to exit without changes.
──────────────────────────────────────────────────────────────────────
```

### Template 6 — Apply Progress Lines

```
[UPDATED]  ✓ Rules/WorkOrders/DateFormatter.js
[UPDATED]  ✓ Pages/WorkOrders/WorkOrdersList.page
[MERGED]   ✓ i18n/i18n.properties            (+3 keys)
[ADDED]    ✓ Rules/AI/GenerateWorkOrder.js
[DELETED]  ✓ Pages/Deprecated/OldPage.page
[SKIPPED]  ✗ Rules/WorkOrders/Caption.js      (BLOCKING)
[RETAINED] → Rules/Custom/MyBusinessRule.js   (customer-only)
[RENAMED]  ↷ Actions/OldName.action → Actions/NewName.action
```

### Template 7 — Final Summary (Phase 10, after-state)

```
══════════════════════════════════════════════════════════════════════
SSAM PATCH UPDATE — FINAL SUMMARY
══════════════════════════════════════════════════════════════════════
Project: <PROJECT_DIR>   Patch: <PATCH_PKG>
CIM:     <CIM_FILE>      App:   <cim.ProjectName>
Completed: <ISO 8601 timestamp>   Backup: <backupPath>
──────────────────────────────────────────────────────────────────────

=== AFTER STATE ===

UPDATED (<N> files)
  Rules/WorkOrders/DateFormatter.js   sha:<new> (was <old>)
  Pages/WorkOrders/WorkOrdersList.page sha:<new> (was <old>)

MERGED (<N> files)
  i18n/i18n.properties  strategy:i18n-key-merge  (+3 keys)
    + WorkOrders_Caption_Plural=Work Orders — {0} items
    + ProgressMessages_Sync=Syncing...
  Application.app       strategy:json-deep-merge  (ProgressMessages block added)

RETAINED (<N> files — customer customizations preserved)
  Rules/WorkOrders/WorkOrderListViewCaption.js  (customer-only)
  Rules/Custom/MyBusinessRule.js               (customer-added)

ADDED (<N> files)
  Rules/AI/GenerateWorkOrder.js
  Actions/AI/AICompletions.action

DELETED (<N> files)
  Pages/Deprecated/OldPage.page

RENAMED (<N> files)
  Actions/OldName.action → Actions/NewName.action
  ⚠ Update CIM Target if this file was customized.

SKIPPED — Awaiting resolution (<N> files)
  ✗ Rules/WorkOrders/WorkOrderListViewCaption.js  [BLOCKING: both-modified-function]
  ✗ Pages/WorkOrders/WorkOrdersListPage.page      [BLOCKING: deleted-customized]

──────────────────────────────────────────────────────────────────────
POST-PATCH VALIDATION
  CIM references:     ✓ All valid     JSON validity:    ✓ All valid
  i18n coverage:      ⚠ 1 missing key Rule paths:       ✓ All resolved
  App definition:     ⚠ Schema bumped Duplicate objects: ✓ None
  XML well-formed:    ✓ All valid     Broken deps:      ✓ None

──────────────────────────────────────────────────────────────────────
NEXT STEPS
  1. ⛔ Resolve BLOCKING conflicts:
       /ssam-patch-update --resolve "Rules/WorkOrders/Caption.js=A"
       /ssam-patch-update --resolve "Pages/WorkOrders/WorkOrdersListPage.page=A"
  2. ⚠ Fix warnings:
       - Add i18n key: WorkOrders_Caption_Plural
       - Run mdk-migration skill (schema bump detected)
  3. Test on device/emulator after all conflicts resolved.
  4. Delete backup when patch confirmed stable: <backupPath>
══════════════════════════════════════════════════════════════════════
```

### Template 8 — Rollback Report

```
══════════════════════════════════════════════════════════════════════
ROLLBACK COMPLETE
══════════════════════════════════════════════════════════════════════
Reason:   <why rollback was triggered>
Restored: <SAP_DIR> — patch-affected SAP standard files reverted from backup
Backup:   Retained at <backupPath>
Note:     ZSAPAssetManager was not modified and was not rolled back.
State:    SAP standard folder is in its pre-patch state. No changes retained.
Retry:    /ssam-patch-update "<original invocation>"
══════════════════════════════════════════════════════════════════════
```

---

## Part C — Worked BLOCKING Examples

### Example A — JS Default Export Conflict

```
BLOCKING: Rules/WorkOrders/WorkOrderListViewCaption.js
════════════════════════════════════════════════════════════════════════
CIM reference:
  Source → /ZSAPAssetManager/Rules/WorkOrders/WorkOrderListViewCaption.js
  Target → /SAPAssetManager/Rules/WorkOrders/WorkOrderListViewCaption.js

Standard change (base → patch):
  @@ -3,5 +3,5 @@
   export default function WorkOrderListViewCaption(controlProxy) {
  -  return 'Work Orders (' + count + ')';
  +  return `Work Orders — ${count} item${count !== 1 ? 's' : ''}`;
   }

Customer customization (base → custom):
  @@ -3,5 +3,5 @@
   export default function WorkOrderListViewCaption(controlProxy) {
  -  return 'Work Orders (' + count + ')';
  +  return 'My Company Work Orders (' + count + ')';
   }

Conflict type: both-modified-function  (severity rank 8)
Why auto-merge is unsafe:
  Both sides replaced the same return statement. LCS hunk overlap on base
  line 3 — merging produces overlapping edits with no safe winner.

Proposed merged result:
  export default function WorkOrderListViewCaption(controlProxy) {
    return `My Company Work Orders — ${count} item${count !== 1 ? 's' : ''}`;
  }
  (Proposed — incorporates both company prefix and SAP pluralization)

Recommended: [A] — keep customer version, apply SAP pluralization by hand.
Re-run: /ssam-patch-update --resolve "Rules/WorkOrders/WorkOrderListViewCaption.js=A"
════════════════════════════════════════════════════════════════════════
```

### Example B — SAP Deleted a Customized File

```
BLOCKING: Pages/WorkOrders/WorkOrdersListPage.page
════════════════════════════════════════════════════════════════════════
CIM reference:
  Source → /ZSAPAssetManager/Pages/WorkOrders/WorkOrdersListPage.page
  Target → /SAPAssetManager/Pages/WorkOrders/WorkOrdersListPage.page

Standard change (base → patch):
  File deleted by SAP patch.
  Possible replacement detected: WorkOrdersList.page (similar hash prefix)

Customer customization (base → custom):
  Caption changed, toolbar button added, empty-message text customized.
  Z file exists on disk.

Conflict type: deleted-customized  (severity rank 1)
Why auto-merge is unsafe:
  SAP removed the file. Accepting the deletion would break any navigation
  action routing to this page.

Proposed merged result:
  Cannot compute — SAP deleted the file; no patch target to merge into.

Recommended: [A] — retain Z page; verify navigation actions still work.
Re-run: /ssam-patch-update --resolve "Pages/WorkOrders/WorkOrdersListPage.page=A"
════════════════════════════════════════════════════════════════════════
```

### Example C — i18n Key Deletion Blocker

```
BLOCKING: i18n/i18n.properties  (key: WorkOrders_Caption)
════════════════════════════════════════════════════════════════════════
CIM reference:
  Source → /ZSAPAssetManager/i18n/i18n.properties
  Target → /SAPAssetManager/i18n/i18n.properties

Standard change (base → patch):
  - WorkOrders_Caption=Work Orders
  (Deleted — SAP introduced WorkOrdersList_Title as replacement)

Customer customization (base → custom):
  Z i18n: WorkOrders_Caption=My Company Work Orders

Conflict type: deleted-customized-key  (severity rank 2)
Why auto-merge is unsafe:
  "WorkOrders_Caption" is referenced in Rules/WorkOrders/WorkOrdersHeader.js:12.
  Removing it would display a bare {i18n>WorkOrders_Caption} at runtime.

Proposed merged result:
  Retain: WorkOrders_Caption=My Company Work Orders
  Add:    WorkOrdersList_Title=My Company Work Orders

Recommended: [A] — keep our key; also add SAP's new key alongside it.
Re-run: /ssam-patch-update --resolve "i18n/i18n.properties:WorkOrders_Caption=A"
════════════════════════════════════════════════════════════════════════
```

### Example D — _Type Change on Customized Control

```
BLOCKING: Pages/WorkOrders/WorkOrderCreate.page
════════════════════════════════════════════════════════════════════════
CIM reference:
  Source → /ZSAPAssetManager/Pages/WorkOrders/WorkOrderCreate.page
  Target → /SAPAssetManager/Pages/WorkOrders/WorkOrderCreate.page

Standard change (base → patch):
  Controls[2]._Type: "Control.Type.FormCell.Date"
                   → "Control.Type.FormCell.DatePicker"

Customer customization (base → custom):
  Controls[2].Caption:    "Due Date" → "Required Completion Date"
  Controls[2].IsRequired: (absent)   → true

Conflict type: _Type change on customized control  (severity rank 5)
Why auto-merge is unsafe:
  FormCell.Date and FormCell.DatePicker have different property schemas.
  Caption and IsRequired must be validated against DatePicker before applying.

Proposed merged result:
  { "_Type": "Control.Type.FormCell.DatePicker",
    "Caption": "{i18n>RequiredCompletionDate}", "IsRequired": true }
  (Both properties are valid on DatePicker — safe to use)

Recommended: [B] — take SAP's new _Type; reapply Caption and IsRequired.
Re-run: /ssam-patch-update --resolve "Pages/WorkOrders/WorkOrderCreate.page=B"
════════════════════════════════════════════════════════════════════════
```
