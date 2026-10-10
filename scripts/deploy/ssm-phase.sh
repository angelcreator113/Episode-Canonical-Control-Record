#!/usr/bin/env bash
# scripts/deploy/ssm-phase.sh — the runner half of one Deploy workflow phase
# (.github/workflows/deploy.yml, Task #2837).
#
# Runs on the GitHub runner only, with the short-lived OIDC credentials the
# workflow assumed. Sends one phase of scripts/deploy/workflow-deploy.sh to
# the production instance through the PrimeStudios-Deploy SSM document (never
# AWS-RunShellScript), waits for it, prints its output, and saves stdout to
# $RUNNER_TEMP/phase-<phase>.out for the workflow to read.
#
# Usage: ssm-phase.sh <plan|deploy|migrate|restart>
# Needs: EC2_INSTANCE_ID, TARGET_SHA, SSM_DOCUMENT, AWS_REGION (from the workflow env).
# Exit: 0 when the phase succeeded on the box; 1 otherwise.

set -euo pipefail

PHASE="${1:?phase required}"
: "${EC2_INSTANCE_ID:?}" "${TARGET_SHA:?}" "${SSM_DOCUMENT:?}" "${RUNNER_TEMP:?}"

case "$PHASE" in
  plan|deploy|migrate|restart) ;;
  *) echo "unknown phase: $PHASE" >&2; exit 1 ;;
esac

OUT="$RUNNER_TEMP/phase-$PHASE.out"
MAX_WAIT_S=2100   # the document's own timeout is 1800 s

COMMAND_ID="$(aws ssm send-command \
  --instance-ids "$EC2_INSTANCE_ID" \
  --document-name "$SSM_DOCUMENT" \
  --comment "deploy ${TARGET_SHA:0:12} $PHASE run ${GITHUB_RUN_ID:-local}" \
  --parameters "phase=$PHASE,sha=$TARGET_SHA" \
  --query "Command.CommandId" --output text)"
echo "SSM command $COMMAND_ID ($PHASE) sent."

STATUS="Pending"
waited=0
while :; do
  sleep 5
  waited=$((waited + 5))
  # The invocation may not exist for the first few seconds.
  STATUS="$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" --instance-id "$EC2_INSTANCE_ID" \
    --query "Status" --output text 2>/dev/null || echo Pending)"
  case "$STATUS" in
    Pending|InProgress|Delayed) ;;
    *) break ;;
  esac
  if [ "$waited" -ge "$MAX_WAIT_S" ]; then
    echo "::error::$PHASE did not finish within ${MAX_WAIT_S}s (last status: $STATUS)."
    exit 1
  fi
done

aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" --instance-id "$EC2_INSTANCE_ID" \
  --query "StandardOutputContent" --output text >"$OUT" || true
ERR_TEXT="$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" --instance-id "$EC2_INSTANCE_ID" \
  --query "StandardErrorContent" --output text 2>/dev/null || true)"

echo "─── $PHASE: on-box output ───"
cat "$OUT"
if [ -n "$ERR_TEXT" ] && [ "$ERR_TEXT" != "None" ]; then
  echo "─── $PHASE: on-box errors ───"
  printf '%s\n' "$ERR_TEXT"
fi
echo "─── $PHASE: $STATUS ───"

if [ "$STATUS" != "Success" ]; then
  echo "::error::$PHASE ended with SSM status $STATUS. The on-box output above says where it stopped."
  exit 1
fi
