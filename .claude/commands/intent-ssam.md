# SSAM Workflow — Customize & Enhance

*Loaded only when SAP Asset Manager → Customize is selected.*

### SSAM Customize Flow

Do not scan the workspace. Do not check for SAPAssetManager/ yourself.
The agent handles all detection via BLOCKING.

**Step 1 — Capture requirement (if not in $ARGUMENTS):**

If `$ARGUMENTS` is empty or generic (e.g. just "customize SSAM"), ask:
❓ **AskUserQuestion**: "What would you like to customize or add to the SAP Asset Manager project?"
  Options:
  - "Override an existing SAP standard rule or page"
  - "Add a new rule or page from scratch"
  - "Modify an existing custom (Z project) rule or page"
  - "Other — I will describe it"

Collect the free-text description of the requirement.

**Step 2 — Spawn agent immediately:**

```
Agent: mdk-developer
Brief:
  intent:      ssam-customize
  requirement: <captured requirement from Step 1 or $ARGUMENTS>
  projectDir:  <current working directory as absolute path>
```

The agent loads `mdk-ssam-patterns` and `mdk-ssam-workflow` skills and handles:
workspace detection, CIM management, file creation in Z project, validation.

If the agent returns `BLOCKING:` → surface it with ❓ **AskUserQuestion**,
collect the answer, append to brief, re-spawn the agent.

