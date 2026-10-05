# Conflict Detection — Per File Type

Conflict rules and detection code used in Phase 6 (`attemptStructuredMerge`).
Each section covers one file category.

---

## Conflict Severity Ranking (sort order for conflict report)

| Rank | Conflict pattern | Runtime impact |
|---|---|---|
| 1 | DELETED-CONFLICT — SAP deleted a file we customized | Feature lost |
| 2 | SAP deleted i18n key we reference in Z rules/pages | Bare `{i18n>Key}` shown |
| 3 | SAP deleted/renamed a JS function we call elsewhere | Runtime error |
| 4 | SAP deleted/renamed an object `_Name` we reference | Broken navigation |
| 5 | `_Type` change on a control we customized | Structural breakage |
| 6 | `OnPress`/`OnSuccess`/`OnFailure` action chain conflict | Navigation broken |
| 7 | `Target.EntitySet` or `Target.Service` binding conflict | Wrong data displayed |
| 8 | JS/TS default export function body conflict | Business logic lost |
| 9 | Style class property conflict | Visual regression |
| 10 | JSON value conflict (non-structural property) | Configuration wrong |
| 11 | i18n key value conflict (both sides changed same key) | Wrong label shown |
| 12 | RENAMED — CIM Target path stale | CIM entry broken |
| 13 | Binary file changed on both sides | Unknown impact |

---

## 1 — MDK JSON Metadata

Extensions: `.page`, `.action`, `.rule`, `.service`, `.app`, `.appconfig`,
`.designtime`, `.metadata`, `.style`, `.globaldef`, `.json`

### Auto-merge safe patterns

| Pattern | Merge action |
|---|---|
| SAP added new top-level property we don't have | `deepMerge` adds it |
| SAP changed a property value we never customized | Take SAP value |
| SAP added new control to a section we didn't touch | Append to our version |
| SAP added `OnSuccess`/`OnFailure` we don't define | Add to our version |
| `_SchemaVersion` bumped | Take SAP value; flag → run `mdk-migration` |
| SAP added `ProgressMessages` block (schema 26.6+) | Add to our version |

### BLOCKING patterns

| Pattern | Rank |
|---|---|
| `_Type` changed on control we customized | 5 |
| `_Name` changed on object we reference in navigation | 4 |
| SAP deleted a JSON property our Z rule references | 4 |
| Both sides modified the same array (`Controls`, `Actions`, `Items`) | 6 |
| SAP deleted a whole file we depend on | 1 |
| SAP and we both added a property with the same key but different values | 10 |

### JSON conflict detection

```javascript
function detectJsonConflicts(base, patch, ours, kp = '') {
  const conflicts = [];
  if (typeof base !== 'object' || base === null) {
    const [bs,ts,os] = [base,patch,ours].map(v=>JSON.stringify(v));
    if (ts!==bs && os!==bs && ts!==os)
      conflicts.push({path:kp||'<root>', base, patch, ours, type:'value-conflict'});
    return conflicts;
  }
  if (Array.isArray(base)) {
    const [bs,ts,os] = [base,patch,ours].map(v=>JSON.stringify(v));
    if (ts!==bs && os!==bs && ts!==os) conflicts.push({path:kp||'<array>', type:'array-conflict'});
    return conflicts;
  }
  const allKeys = new Set([...Object.keys(base||{}), ...Object.keys(patch||{}), ...Object.keys(ours||{})]);
  for (const key of allKeys) {
    const k = kp ? `${kp}.${key}` : key;
    if (key in (base||{}) && !(key in (patch||{}))) {
      if (key in (ours||{}) && JSON.stringify(ours[key]) !== JSON.stringify(base[key]))
        conflicts.push({path:k, type:'deleted-customized', base:base[key], ours:ours[key]});
      continue;
    }
    conflicts.push(...detectJsonConflicts(base[key], patch?.[key], ours?.[key], k));
  }
  return conflicts;
}
```

---

## 2 — JavaScript (`.js`) — Rules files

### Auto-merge safe

| Pattern | Merge action |
|---|---|
| SAP added a new exported function (unique name) | Append function block |
| SAP added an import/require we don't have | Add import line |
| SAP added JSDoc on a function we didn't touch | Take SAP version of that block |
| SAP changed a utility function we never override | Take SAP version |

### BLOCKING patterns

| Pattern | Rank |
|---|---|
| SAP changed the default export body we also modified | 8 |
| SAP renamed a function we call from another file | 3 |
| SAP deleted a function we call | 3 |
| Both sides modified lines in the same function scope | 8 |

### Function-boundary extraction

```javascript
function extractJsFunctions(content) {
  const fns = {};
  const re  = /(?:export\s+(?:default\s+)?)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1]||m[2];
    let depth=0, i=m.index;
    while (i<content.length) {
      if (content[i]==='{') depth++;
      else if (content[i]==='}' && --depth===0) break;
      i++;
    }
    fns[name] = content.slice(m.index, i+1);
  }
  return fns;
}

function detectJsConflicts(bText, tText, oText) {
  const [bF,tF,oF] = [bText,tText,oText].map(extractJsFunctions);
  const all = new Set([...Object.keys(bF),...Object.keys(tF),...Object.keys(oF)]);
  const conflicts = [];
  for (const name of all) {
    const b=bF[name],t=tF[name],o=oF[name];
    if (!b&&t&&o&&t!==o)          conflicts.push({name, type:'both-added-function'});
    if (b&&!t&&o&&o!==b)          conflicts.push({name, type:'deleted-customized-function'});
    if (b&&t&&o&&t!==b&&o!==b&&t!==o) conflicts.push({name, type:'both-modified-function'});
  }
  return conflicts;
}
```

---

## 3 — TypeScript (`.ts`)

Same rules as JavaScript plus interface/type collision detection:

```javascript
function detectTsConflicts(bText, tText, oText) {
  const extractTypes = c => {
    const m={}, re=/(?:export\s+)?(?:interface|type|class|enum)\s+(\w+)/g; let match;
    while ((match=re.exec(c))!==null) m[match[1]]=true;
    return m;
  };
  const [bT,tT,oT] = [bText,tText,oText].map(extractTypes);
  return Object.keys(tT)
    .filter(n => !bT[n] && oT[n])
    .map(n => ({name:n, type:'duplicate-type-definition'}));
}
```

---

## 4 — XML (`.xml`)

### Auto-merge safe

- SAP added a new element we don't have → append
- SAP changed an attribute on an element we didn't touch → take SAP value
- SAP added a new stylesheet class → append class block

### BLOCKING

- SAP changed an attribute we also changed → value conflict
- SAP deleted an element we reference → broken reference
- Both sides added elements with same `id` or `name` attribute → duplicate

```javascript
function detectXmlConflicts(bText, tText, oText) {
  const extractAttrs = c => {
    const m={}, re=/<(\w[\w:.-]*)\s([^>]+)>/g; let match;
    while ((match=re.exec(c))!==null) {
      const [,tag,body]=match; const ar=/(\w[\w:.-]*)="([^"]*)"/g; let a;
      while ((a=ar.exec(body))!==null) m[`${tag}@${a[1]}`]=a[2];
    }
    return m;
  };
  const [bA,tA,oA] = [bText,tText,oText].map(extractAttrs);
  const conflicts=[];
  for (const key of new Set([...Object.keys(tA),...Object.keys(oA)])) {
    const b=bA[key],t=tA[key],o=oA[key];
    if (b!==undefined&&t!==b&&o!==b&&t!==o)
      conflicts.push({attr:key, base:b, patch:t, ours:o, type:'xml-attribute-conflict'});
  }
  return conflicts;
}
```

---

## 5 — i18n Properties (`.properties`)

### Always-safe operations

| Condition | Decision |
|---|---|
| SAP adds new key | Add to our file |
| SAP deletes key we don't override | Accept deletion |
| SAP changes a key value we override in Z i18n | Our override wins — no conflict |
| SAP changes a key we don't override | Take SAP value |

### BLOCKING

- SAP deletes a key that `{i18n>Key}` references in any Z project file → BLOCKING rank 2
- SAP deletes a key we override in Z i18n → flag for review

```javascript
function findI18nDeletionBlockers(deletedKeys, CUSTOM_DIR) {
  const fs=require('fs'), path=require('path');
  const blockers=[], re=k=>new RegExp(`\\{i18n>${k}\\}|i18n\\.getText\\(['"]${k}['"]\\)`, 'g');
  const files = walkDir(CUSTOM_DIR).filter(f=>!f.endsWith('.properties'));
  for (const key of deletedKeys) {
    const pattern=re(key);
    for (const f of files) {
      const abs=path.join(CUSTOM_DIR,f);
      if (pattern.test(fs.readFileSync(abs,'utf8')))
        blockers.push({key, referencedIn:f});
    }
  }
  return blockers;
}
```

---

## 6 — Application Definition (`Application.app`)

| Property | Rule |
|---|---|
| `_Name` | BLOCKING rank 4 if changed — app identity |
| `_SchemaVersion` | Auto-take SAP value; flag → `mdk-migration` skill |
| `Version` | Auto-take SAP value |
| `OfflineEnabled` | CONFLICT rank 10 if both changed |
| `BrandedSettings` | CONFLICT rank 10 if both changed |
| `ConnectivitySettings` | BLOCKING if SAP changed what our rules depend on |
| `AppSettings` | MERGE if non-overlapping properties |
| `ProgressMessages` | Auto-add new SAP block (schema 26.6+) |

---

## 7 — Style Files (`.style`)

```javascript
function detectStyleConflicts(bText, tText, oText) {
  const parse=t=>{try{return JSON.parse(t);}catch(_){return{};}};
  const [base,patch,ours]=[bText,tText,oText].map(parse);
  const conflicts=[];
  const allCls=new Set([...Object.keys(base),...Object.keys(patch),...Object.keys(ours)]);
  for (const cls of allCls) {
    const b=base[cls]||{}, t=patch[cls]||{}, o=ours[cls]||{};
    if (!base[cls]&&patch[cls]&&ours[cls]&&JSON.stringify(t)!==JSON.stringify(o))
      conflicts.push({class:cls, type:'duplicate-class-added'});
    else for (const prop of new Set([...Object.keys(t),...Object.keys(o)])) {
      const bv=b[prop],tv=t[prop],ov=o[prop];
      if (bv!==undefined&&tv!==bv&&ov!==bv&&tv!==ov)
        conflicts.push({class:cls,prop,base:bv,patch:tv,ours:ov,type:'style-property-conflict'});
    }
  }
  return conflicts;
}
```

---

## 8 — Global Definitions (`.globaldef`)

```javascript
function detectGlobalNameCollisions(bText, tText, oText) {
  const extractNames=c=>{try{return(JSON.parse(c).Globals||[]).map(g=>g._Name).filter(Boolean);}catch(_){return[];}};
  const [bN,tN,oN]=[bText,tText,oText].map(extractNames);
  const bSet=new Set(bN);
  return tN.filter(n=>!bSet.has(n)&&oN.includes(n)).map(n=>({name:n,type:'global-name-collision'}));
}
```

---

## 9 — Binary and Unknown Files

```javascript
function classifyBinaryOrUnknown(bHash, tHash, oHash) {
  const b_t = bHash && tHash && bHash===tHash;
  const b_o = bHash && oHash && bHash===oHash;
  if (b_t) return oHash!==bHash ? 'CUST' : 'UNCHANGED';
  if (b_o) return 'PATCH'; // safe — our copy still matched base
  return 'CONFLICT'; // binary conflict is always BLOCKING
}
```

Binary conflicts always produce a BLOCKING message showing file sizes and
SHA-256 hashes. Never attempt content merge on binary files.
