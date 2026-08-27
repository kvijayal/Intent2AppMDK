#!/usr/bin/env bash
# Intent2App HARD STOP — blocks Write/Edit while a review lock is present.
# /review creates .intent2app/review.lock ; /modify deletes it.
set -euo pipefail
if [ -f ".intent2app/review.lock" ]; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Intent2App is in REVIEW mode (HARD STOP). The reviewer recommends changes but must not modify files. Approve findings with /modify to unlock writes."}}
JSON
fi
exit 0
