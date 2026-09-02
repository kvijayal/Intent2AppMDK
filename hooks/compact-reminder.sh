#!/bin/bash
# Tracks tool call count in session and reminds to /compact when context is getting large.
# Runs after every Claude response via the Stop hook.

COUNTER_FILE="/tmp/.intent2app_tool_count"

# Increment counter
count=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$COUNTER_FILE"

# Remind every 40 tool calls — context is likely getting large by then
if (( count % 40 == 0 )); then
  echo ""
  echo "💡 Context tip: This session has used ~${count} tool calls."
  echo "   Run /compact to summarize the conversation and free up context window."
  echo "   Your project files and skills are unaffected — only the chat history compacts."
fi
