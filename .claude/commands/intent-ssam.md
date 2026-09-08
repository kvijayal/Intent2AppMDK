# SSAM Workflow — Customize & Enhance

*Loaded only when SAP Asset Manager → Customize is selected.*

### SSAM Customize Flow

**Do not run SSAM-C1 through C4 steps here.**
Do not scan the workspace. Do not check for SAPAssetManager/. Do not ask about CIM files.

Immediately spawn the `mdk-developer` agent:

```
intent:       ssam-customize
requirement:  <user's original requirement text>
projectDir:   <current working directory as absolute path>
```

The agent loads `mdk-ssam-patterns` skill and `mdk-ssam-workflow` skill.
The skill handles everything: workspace detection, path collection via BLOCKING,
Z project setup, CIM entry management, and post-customization validation.

If the agent returns a `BLOCKING:` message → surface it to the developer with
❓ **AskUserQuestion**, collect the answer, append it to the brief, re-spawn the agent.

