# Three-Way Merge — Node.js Implementation

All functions use built-in modules only: `fs`, `path`, `crypto`, `child_process`, `os`.

---

## Utility Functions

```javascript
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const os     = require('os');
const { execSync } = require('child_process');

function walkDir(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    e.isDirectory() ? out.push(...walkDir(f, base))
                    : out.push(path.relative(base, f).replace(/\\/g, '/'));
  }
  return out;
}

function hashFile(p) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
  catch (_) { return null; }
}

function normalizeText(content) {
  let s = content.toString('utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); // strip BOM
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isBinary(filePath) {
  try {
    const buf = Buffer.alloc(512);
    const fd  = fs.openSync(filePath, 'r');
    const n   = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  } catch (_) {}
  return false;
}

const MAX_MERGE_SIZE = 2 * 1024 * 1024; // 2 MB safety guard

const MDK_JSON_EXTS = new Set([
  '.json', '.page', '.action', '.rule', '.service', '.app',
  '.appconfig', '.designtime', '.metadata', '.style', '.globaldef',
]);
```

---

## attemptStructuredMerge

```javascript
/**
 * Attempt a three-way merge for file `f`.
 * B = SAP_DIR/f (base), T = PATCH_PKG/f (theirs), O = CUSTOM_DIR/oRel (ours)
 *
 * Returns:
 *   { success: true,  content, contentHash, strategy }
 *   { success: false, reason, conflicts? }
 */
function attemptStructuredMerge(f, SAP_DIR, PATCH_PKG, CUSTOM_DIR, oRel) {
  const bPath = path.join(SAP_DIR,   f);
  const tPath = path.join(PATCH_PKG, f);
  const oPath = path.join(CUSTOM_DIR, oRel);

  // Binary guard
  for (const p of [bPath, tPath, oPath])
    if (fs.existsSync(p) && isBinary(p))
      return { success: false, reason: 'Binary file — cannot auto-merge' };

  // Size guard
  for (const p of [bPath, tPath, oPath])
    if (fs.existsSync(p) && fs.statSync(p).size > MAX_MERGE_SIZE)
      return { success: false, reason: `File too large for in-memory merge: ${path.basename(p)}` };

  const bText = normalizeText(fs.readFileSync(bPath));
  const tText = normalizeText(fs.readFileSync(tPath));
  const oText = normalizeText(fs.readFileSync(oPath));

  // Trivial: both sides reached the same result
  const tHash = crypto.createHash('sha256').update(tText).digest('hex');
  const oHash = crypto.createHash('sha256').update(oText).digest('hex');
  if (tHash === oHash)
    return { success: true, content: tText, contentHash: tHash, strategy: 'trivial-equal' };

  const ext = path.extname(f).toLowerCase();
  if (MDK_JSON_EXTS.has(ext)) return mergeJson(bText, tText, oText);
  if (ext === '.properties')   return mergeI18n(bText, tText, oText);
  if (['.js','.ts'].includes(ext)) return mergeText(bText, tText, oText, ext.slice(1));
  if (ext === '.xml')          return mergeText(bText, tText, oText, 'xml');

  return { success: false, reason: `No merge strategy for extension: ${ext}` };
}
```

---

## mergeJson — Deep Three-Way JSON Merge

```javascript
function mergeJson(bText, tText, oText) {
  let base, patch, ours;
  try { base = JSON.parse(bText); patch = JSON.parse(tText); ours = JSON.parse(oText); }
  catch (e) { return { success: false, reason: `JSON parse error: ${e.message}` }; }

  const conflicts = [];
  const merged    = deepMerge(base, patch, ours, '', conflicts);
  if (conflicts.length)
    return { success: false, reason: `Conflicts at: ${conflicts.map(c=>c.path).join(', ')}`, conflicts };

  const content = JSON.stringify(merged, null, 2);
  return { success: true, content, contentHash: sha(content), strategy: 'json-deep-merge' };
}

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function deepMerge(base, patch, ours, kp, conflicts) {
  if (typeof base !== 'object' || base === null) {
    const [bs,ts,os] = [base,patch,ours].map(v=>JSON.stringify(v));
    if (ts===bs) return ours;   // SAP unchanged → keep ours
    if (os===bs) return patch;  // We unchanged → take patch
    if (ts===os) return ours;   // Both same result → trivial
    conflicts.push({ path: kp||'<root>', base, patch, ours, type: 'value-conflict' });
    return ours;
  }
  if (Array.isArray(base)) {
    const [bs,ts,os] = [base,patch,ours].map(v=>JSON.stringify(v));
    if (ts===bs) return ours;
    if (os===bs) return patch;
    if (ts===os) return ours;
    conflicts.push({ path: kp||'<array>', type: 'array-conflict' });
    return ours;
  }

  const result  = {};
  const allKeys = new Set([
    ...Object.keys(base||{}), ...Object.keys(patch||{}), ...Object.keys(ours||{}),
  ]);

  for (const key of allKeys) {
    const k    = kp ? `${kp}.${key}` : key;
    const bDef = key in (base||{}), tDef = key in (patch||{}), oDef = key in (ours||{});
    const bVal = base?.[key], tVal = patch?.[key], oVal = ours?.[key];

    if (bDef && !tDef) {
      // SAP deleted this key
      if (oDef && JSON.stringify(oVal) !== JSON.stringify(bVal))
        conflicts.push({ path: k, type: 'deleted-customized', base: bVal, ours: oVal });
      // If we didn't customize, omit (accept SAP deletion)
      if (oDef && JSON.stringify(oVal) !== JSON.stringify(bVal)) result[key] = oVal;
      continue;
    }
    if (!bDef &&  tDef && !oDef) { result[key] = tVal; continue; } // SAP added
    if (!bDef && !tDef &&  oDef) { result[key] = oVal; continue; } // we added
    if (!bDef &&  tDef &&  oDef) {
      // Both added — conflict if different values
      if (JSON.stringify(tVal) !== JSON.stringify(oVal))
        conflicts.push({ path: k, type: 'both-added', patch: tVal, ours: oVal });
      result[key] = oVal; continue;
    }
    result[key] = deepMerge(bVal, tVal, oVal, k, conflicts);
  }
  return result;
}
```

---

## mergeI18n — Key-Level i18n Merge

```javascript
function mergeI18n(bText, tText, oText) {
  const parse = text => {
    const m = {};
    for (const line of text.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const idx = line.indexOf('=');
      m[line.slice(0,idx).trim()] = line.slice(idx+1).trim();
    }
    return m;
  };

  const base = parse(bText), patch = parse(tText), ours = parse(oText);
  const result = { ...ours };
  const conflicts = [];

  for (const [key, tVal] of Object.entries(patch)) {
    const bVal = base[key];
    if (bVal === undefined) {
      // New key from SAP patch
      if (!(key in ours)) result[key] = tVal;
      else if (ours[key] !== tVal) conflicts.push({ key, type:'both-added-key', patch:tVal, ours:ours[key] });
      continue;
    }
    if (tVal === bVal) continue;         // SAP didn't change this key
    if (!(key in ours) || ours[key] === bVal) result[key] = tVal; // we didn't customize → take SAP
    // else: we customized it → our value stands (customer i18n overrides SAP)
  }

  // Keys SAP deleted that we still have
  for (const [key, bVal] of Object.entries(base)) {
    if (!(key in patch) && key in ours)
      conflicts.push({ key, type:'deleted-customized-key', base:bVal, ours:ours[key] });
  }

  if (conflicts.length)
    return { success:false, reason:`i18n key conflicts: ${conflicts.map(c=>c.key).join(', ')}`, conflicts };

  // Serialize preserving customer comment lines, then append new SAP keys
  const lines = oText.split('\n').map(line => {
    if (line.startsWith('#') || !line.includes('=')) return line;
    const key = line.slice(0, line.indexOf('=')).trim();
    return key in result ? `${key}=${result[key]}` : null;
  }).filter(l => l !== null);
  for (const [key, val] of Object.entries(result))
    if (!(key in ours)) lines.push(`${key}=${val}`);

  const content = lines.join('\n');
  return { success:true, content, contentHash:sha(content), strategy:'i18n-key-merge' };
}
```

---

## mergeText — LCS Hunk-Based Merge (JS, TS, XML)

```javascript
function mergeText(bText, tText, oText, type) {
  const bLines = bText.split('\n'), tLines = tText.split('\n'), oLines = oText.split('\n');
  const patchOps = lcsOps(bLines, tLines);
  const oursOps  = lcsOps(bLines, oLines);
  const overlaps = hunkOverlaps(patchOps, oursOps);

  if (overlaps.length)
    return { success:false, reason:`${type} hunk conflicts at base lines: ${overlaps.map(c=>c.bi).join(', ')}`, conflicts:overlaps };

  const merged  = applyPatch(oLines, patchOps, bLines);
  const content = merged.join('\n');
  return { success:true, content, contentHash:sha(content), strategy:`${type}-hunk-merge` };
}

function lcsOps(base, target) {
  const m=base.length, n=target.length;
  const dp = Array.from({length:m+1}, ()=>new Uint32Array(n+1));
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j] = base[i-1]===target[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
  const ops=[]; let i=m, j=n;
  while (i>0||j>0) {
    if (i>0&&j>0&&base[i-1]===target[j-1]) { ops.push({type:'keep',bi:i-1,ti:j-1}); i--;j--; }
    else if (j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])) { ops.push({type:'ins',ti:j-1,content:target[j-1]}); j--; }
    else { ops.push({type:'del',bi:i-1,content:base[i-1]}); i--; }
  }
  return ops.reverse();
}

function hunkOverlaps(patchOps, oursOps) {
  const pDel = new Set(patchOps.filter(o=>o.type==='del').map(o=>o.bi));
  const oDel = new Set(oursOps.filter(o=>o.type==='del').map(o=>o.bi));
  return [...pDel].filter(bi=>oDel.has(bi)).map(bi=>({bi, type:'both-deleted-line'}));
}

function applyPatch(oLines, patchOps, bLines) {
  const b2o={};
  let bi=0, oi=0;
  for (const op of lcsOps(bLines, oLines)) {
    if (op.type==='keep') { b2o[bi]=oi; bi++;oi++; }
    else if (op.type==='del') bi++;
    else oi++;
  }
  const result=[...oLines]; let offset=0;
  for (const op of patchOps) {
    if (op.type==='ins') { const at=((b2o[op.afterBi]??-1)+1)+offset; result.splice(at,0,op.content); offset++; }
    else if (op.type==='del') { const at=b2o[op.bi]; if (at!==undefined) { result.splice(at+offset,1); offset--; } }
  }
  return result;
}
```

---

## detectRenames

```javascript
function detectRenames(hashB, hashT, currentFiles, patchFiles) {
  const byB={}, byT={};
  for (const [f,h] of Object.entries(hashB)) if (h) (byB[h]=byB[h]||[]).push(f);
  for (const [f,h] of Object.entries(hashT)) if (h) (byT[h]=byT[h]||[]).push(f);
  const renames=[];
  for (const [hash, tPaths] of Object.entries(byT)) {
    const cPaths=byB[hash]||[];
    for (const tp of tPaths)
      if (!currentFiles.has(tp)&&cPaths.length===1&&!patchFiles.has(cPaths[0]))
        renames.push({from:cPaths[0], to:tp, hash});
  }
  return renames;
}
```

---

## ZIP Expansion

```javascript
function expandIfZip(pkgPath, label) {
  if (!pkgPath.endsWith('.zip')) return pkgPath;
  const tmp = path.join(os.tmpdir(), `ssam_${label}_${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try { execSync(`unzip -q "${pkgPath}" -d "${tmp}"`, { stdio:'pipe' }); }
  catch (_) {
    execSync(`powershell -Command "Expand-Archive -Path '${pkgPath}' -DestinationPath '${tmp}' -Force"`, { stdio:'pipe' });
  }
  const entries = fs.readdirSync(tmp);
  if (entries.length===1 && fs.statSync(path.join(tmp,entries[0])).isDirectory())
    return path.join(tmp, entries[0]);
  return tmp;
}
```

---

## Partial Patch Detection

```javascript
// SAP hot-fix ZIPs often contain only changed files, not the full project.
// When partial: files NOT in PATCH_PKG are unchanged from current baseline.
function isPartialPatch(patchFiles, currentFiles) {
  return patchFiles.size < currentFiles.size * 0.4;
}
```

If partial patch is detected, report it prominently in the conflict report header.
