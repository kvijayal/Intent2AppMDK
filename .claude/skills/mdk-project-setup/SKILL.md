---
name: mdk-project-setup
version: 0.4.0
description: >
  Use when reading an existing MDK project's context before making changes — app name,
  schema version, entity sets, page/action counts, service configuration. Trigger on:
  "read project context", "what entities does this project have", "check existing MDK project",
  "project structure", "how many pages", "what's in this MDK project", "before adding to
  existing project", "modify existing MDK", "SSAM project context", "project app name",
  "schema version of this project", ".project.json", ".service.metadata", "existing pages",
  "existing actions", "existing rules", "i18n keys count".
source: Intent2App — moved from mdk_read_project_context MCP tool
---

# MDK Project Context — How to Read It

Before modifying any existing MDK project, read its context directly using Claude's
file tools. No MCP tool needed — these are plain local files.

---

## Step-by-step: read project context

```bash
# 1. Find the MDK project root (has .project.json)
find . -name ".project.json" -maxdepth 4 2>/dev/null | head -5
```

Once found, read these files:

### .project.json — app name, schema version, offline flag
```bash
cat <projectDir>/.project.json
```
Key fields: `ApplicationName`, `SchemaVersion`, `Offline`

### .service.metadata — entity sets and OData service
```bash
cat <projectDir>/.service.metadata | python3 -c "
import json,sys
d=json.load(sys.stdin)
dests=d.get('mobile',{}).get('destinations',[])
for dest in dests:
    print('Destination:', dest.get('name'))
    edmx=dest.get('metadata',{}).get('odataContent','')
    import re
    entities=re.findall('EntitySet\s+Name=\"([^\"]+)\"', edmx)
    print('Entity sets:', entities)
"
```

### Count existing artifacts
```bash
# Pages
find <projectDir>/Pages -name "*.page" 2>/dev/null | wc -l
# Actions
find <projectDir>/Actions -name "*.action" 2>/dev/null | wc -l
# Rules
find <projectDir>/Rules -name "*.js" 2>/dev/null | wc -l
# i18n keys
grep -c "=" <projectDir>/i18n/i18n.properties 2>/dev/null || echo 0
```

### Check for CLAUDE.md (project-specific rules)
```bash
cat <projectDir>/CLAUDE.md 2>/dev/null || echo "No CLAUDE.md found"
```

---

## What to do with the context

| Finding | Action |
|---|---|
| `.service.metadata` missing | Use `mdk_mobile_services` (fetch-metadata operation) or VS Code → "MDK: Open Mobile App Editor" |
| No `.service` file in `Services/` | OData service not yet configured — fetch metadata first |
| Existing pages for an entity | Do NOT regenerate — use `mdk-gen` to add specific missing artifacts |
| `CLAUDE.md` found | Read `## MDK Project Rules` section and apply as hard constraints |
| `CLAUDE.md` not found | Ask developer: protected folders? implementation folder? CIM file? |
| `SchemaVersion` < 26.6 | Run `mdk_manage { operation: "migrate" }` first |
| `Offline: true` | Upload/Download pattern required for all CRUD actions |

---

## SSAM project detection

If the project root contains a `SAPAssetManager/` folder:

```bash
ls <projectDir> | grep -i "SAPAssetManager\|ZEquinor\|SSAM"
```

Apply rules from project `CLAUDE.md` immediately. If no `CLAUDE.md`:
- Protected: `SAPAssetManager/` — never modify or generate files here
- Implementation: `ZEquinorSSAM/` — all new code goes here
- CIM: `ZEquinorSSAM.CIM` — add entry for every new rule created
