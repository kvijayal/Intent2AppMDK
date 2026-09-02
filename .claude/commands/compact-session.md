# Compact Session

Use this command when the conversation is getting long and responses are slowing down.

## What /compact does

- Summarizes everything discussed so far into a short context block
- Replaces the full conversation history with that summary
- Frees up context window — Claude can process faster with less history
- **Your project files, skills, agents, and commands are NOT affected**
- **The SSAM upgrade progress is NOT lost** — re-state where you left off after compacting

## When to use it

- After a long debugging session (like SSAM upgrade testing)
- When Claude starts repeating itself or responses slow down
- After completing a major task before starting the next one
- After any session exceeding ~30 tool calls

## How to use

Simply type:
```
/compact
```

Claude will summarize the session. Then continue with:
```
/intent-mdk "continue SSAM upgrade — we completed Phase 1 and 2, now at Phase 3 CIM audit"
```

## Automatic reminder

The project is configured to remind you every 40 tool calls via the Stop hook.
You can also run `/compact` any time — there is no minimum session length required.
