#!/usr/bin/env bash
# =============================================================================
# Removes the RDS instance's older deploy-* snapshots before a Deploy run takes
# its own (Evoni, 2026-10-22: runs #145 and #146 stopped at the snapshot with
# SnapshotQuotaExceeded, "cannot create more than 100 manual snapshots").
#
# Runs on the GitHub runner with the deploy role, never on the box. Keeps the
# newest KEEP available deploy-* manual snapshots of RDS_INSTANCE_ID (default
# 10, never fewer than 3) and deletes the older ones. Snapshots not named
# deploy-*, and any not yet available, are never touched.
#
# It never stops a deploy: when the role may not delete snapshots (the
# permission in docs/runbooks/deploy-workflow.md §2.1 not added yet), or a
# listing or delete fails, it warns and the run goes on to its snapshot.
#
# Prints PRUNE_KEPT=, PRUNE_REMOVED= and PRUNE_NOTE= lines, and writes kept=,
# removed= and note= to GITHUB_OUTPUT when it is set.
# =============================================================================
set -uo pipefail

: "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID is not set}"
RUNBOOK="${RUNBOOK:-docs/runbooks/deploy-workflow.md}"

KEEP="${KEEP:-}"
if [ -z "$KEEP" ]; then
  KEEP=10
elif ! [[ "$KEEP" =~ ^[0-9]+$ ]]; then
  echo "::warning::DEPLOY_SNAPSHOTS_KEEP is '${KEEP}', not a number; keeping the newest 10."
  KEEP=10
elif [ "$KEEP" -lt 3 ]; then
  echo "::warning::DEPLOY_SNAPSHOTS_KEEP is ${KEEP}; keeping the newest 3, the least it keeps."
  KEEP=3
fi

removed=0
note=""

finish() {
  echo "PRUNE_KEPT=${KEEP}"
  echo "PRUNE_REMOVED=${removed}"
  echo "PRUNE_NOTE=${note:-ok}"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      echo "kept=${KEEP}"
      echo "removed=${removed}"
      echo "note=${note:-ok}"
    } >>"$GITHUB_OUTPUT"
  fi
  exit 0
}

err="$(mktemp)"
trap 'rm -f "$err"' EXIT

# Newest first. The CLI follows every page of the listing.
if ! list="$(aws rds describe-db-snapshots \
  --db-instance-identifier "$RDS_INSTANCE_ID" \
  --snapshot-type manual \
  --query "reverse(sort_by(DBSnapshots[?starts_with(DBSnapshotIdentifier, 'deploy-') && Status == 'available'], &SnapshotCreateTime))[].DBSnapshotIdentifier" \
  --output text 2>"$err")"; then
  echo "::warning::Could not list the deploy snapshots, so none were removed: $(head -1 "$err")"
  note="list-failed"
  finish
fi

ids=()
for id in $list; do
  # Only well-formed deploy-* identifiers; the CLI prints "None" for an empty list.
  if [[ "$id" =~ ^deploy-[A-Za-z0-9-]+$ ]]; then ids+=("$id"); fi
done

echo "${#ids[@]} deploy snapshot(s) available; keeping the newest ${KEEP}."
if [ "${#ids[@]}" -le "$KEEP" ]; then
  finish
fi

for id in "${ids[@]:$KEEP}"; do
  if aws rds delete-db-snapshot --db-snapshot-identifier "$id" \
    --query "DBSnapshot.DBSnapshotIdentifier" --output text >/dev/null 2>"$err"; then
    echo "Removed ${id}."
    removed=$((removed + 1))
  elif grep -qE 'AccessDenied|not authorized|UnauthorizedOperation' "$err"; then
    echo "::warning::The deploy role may not delete snapshots, so none were removed. Add the DeleteOldDeploySnapshots permission (${RUNBOOK} §2.1), or remove old deploy-* snapshots in RDS → Snapshots → Manual (§7)."
    note="not-permitted"
    finish
  else
    echo "::warning::Could not remove ${id}: $(head -1 "$err")"
    note="some-failed"
  fi
done

finish
