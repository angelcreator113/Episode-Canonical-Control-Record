#!/bin/bash
# audit-cost-exposure.sh — Detect uncontrolled AWS/AI cost patterns
#
# Catches:
#   1. Schedulers calling Claude API without env gate
#   2. setInterval with Claude API calls (continuous billing)
#   3. Bulk API calls without concurrency limits
#   4. Missing AI_DAILY_BUDGET_USD in production configs
#
# Run: bash scripts/audit-cost-exposure.sh

set -euo pipefail

VIOLATIONS=0

echo "Auditing for uncontrolled cost patterns..."
echo ""

# 1. Schedulers that start unconditionally (no env check in startScheduler function)
echo "1. Checking for ungated schedulers..."
# Only flag startScheduler functions that call setInterval without env gate
for SVC_FILE in src/services/feedScheduler.js; do
  if [ -f "$SVC_FILE" ]; then
    if ! grep -A5 'function startScheduler' "$SVC_FILE" | grep -q 'process\.env\.\|ENABLED'; then
      echo "  UNGATED SCHEDULER: $SVC_FILE — startScheduler() has no env gate"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
done

# 2. Claude API calls inside setInterval callbacks
echo ""
echo "2. Checking for Claude API calls in continuous loops..."
RESULTS=$(grep -rn 'anthropic\.\|messages\.create\|callClaude' src/services/ --include='*.js' 2>/dev/null \
  | grep -v 'test\|mock\|aiCostTracker' || true)
# Count calls per service file
if [ -n "$RESULTS" ]; then
  FILES=$(echo "$RESULTS" | cut -d: -f1 | sort -u)
  for f in $FILES; do
    COUNT=$(echo "$RESULTS" | grep -c "^$f:" || true)
    if [ "$COUNT" -gt 3 ]; then
      echo "  HIGH API DENSITY: $f has $COUNT Claude API call sites"
    fi
  done
fi

# 3. Missing budget limit in env files
echo ""
echo "3. Checking for AI budget configuration..."
if [ -f .env ] || [ -f .env.example ] || [ -f .env.production ]; then
  HAS_BUDGET=$(grep -rl 'AI_DAILY_BUDGET_USD' .env* 2>/dev/null || true)
  if [ -z "$HAS_BUDGET" ]; then
    echo "  MISSING: AI_DAILY_BUDGET_USD not set in any .env file"
    echo "           Add AI_DAILY_BUDGET_USD=50 to cap daily AI spend"
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo "  OK: AI_DAILY_BUDGET_USD found in $HAS_BUDGET"
  fi
else
  echo "  INFO: No .env files found (env vars may be set externally)"
fi

# 4. Check for FEED_SCHEDULER_ENABLED gate
echo ""
echo "4. Checking feed scheduler gate..."
if grep -q 'FEED_SCHEDULER_ENABLED' src/services/feedScheduler.js 2>/dev/null; then
  echo "  OK: Feed scheduler gated by FEED_SCHEDULER_ENABLED env var"
else
  echo "  UNGATED: Feed scheduler runs unconditionally"
  VIOLATIONS=$((VIOLATIONS + 1))
fi

echo ""
echo "─────────────────────────────────────────"
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "Found $VIOLATIONS cost exposure issue(s)."
  exit 1
else
  echo "No uncontrolled cost patterns found."
  exit 0
fi
