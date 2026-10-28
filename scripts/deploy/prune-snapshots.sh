#!/usr/bin/env bash
# =============================================================================
# Removes the RDS instance's older deploy-* snapshots before a Deploy run takes
# its own (Evoni, 2026-10-22: runs #145 and #146 stopped at the snapshot with
# SnapshotQuotaExceeded, "cannot create more than 100 manual snapshots").
#
# Runs on the GitHub runner with the deploy role, never on the box. It never
# stops a deploy: when the role may not delete snapshots (the permission in
# docs/runbooks/deploy-workflow.md §2.1 not added), or a listing or delete
# fails, it warns and the run goes on to its snapshot.
#
# Safeguards (Evoni, 2026-10-28), each a repository variable on the workflow:
#   DRY_RUN       on unless set to 0 / false / off: lists what it would remove,
#                 removes nothing (DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN)
#   KEEP          the newest KEEP unprotected deploy snapshots always stay
#                 (default 10, never fewer than 3); protected ones (below) are
#                 kept as well and never count toward it (DEPLOY_SNAPSHOTS_KEEP)
#   MAX_DELETE    at most this many removals per run, oldest first (default
#                 5, 1 to 20) (DEPLOY_SNAPSHOTS_MAX_DELETE)
#   MIN_AGE_DAYS  nothing newer than this is removed (default 7, at least 1)
#                 (DEPLOY_SNAPSHOTS_MIN_AGE_DAYS)
# Never removed, whatever the counts:
#   - anything not named exactly as the workflow names its snapshots,
#     deploy-<12 hex>-<run id>-<attempt>;
#   - a snapshot tagged keep=true (protect one by hand in RDS → Tags);
#   - this run's own attempts (the run id in the name);
#   - automated or other manual snapshots, and any not yet available.
# It refuses to remove anything when the listing looks wrong (not a JSON list,
# or an identifier listed twice), and stops after 3 failed removals.
#
# Prints PRUNE_KEPT=, PRUNE_REMOVED=, PRUNE_WOULD_REMOVE=, PRUNE_PROTECTED= and
# PRUNE_NOTE= lines, and writes kept=, removed=, would_remove=, protected= and
# note= to GITHUB_OUTPUT when it is set. note: ok | dry-run | not-permitted |
# some-failed | list-failed | list-suspect.
# =============================================================================
set -uo pipefail

: "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID is not set}"
RUNBOOK="${RUNBOOK:-docs/runbooks/deploy-workflow.md}"
RUN_ID="${GITHUB_RUN_ID:-}"
NOW="${NOW_EPOCH:-$(date -u +%s)}"

# A whole number from a variable, or the default when unset or not a number; clamped to [min, max].
number() {
  local name="$1" value="$2" fallback="$3" min="$4" max="$5"
  if [ -z "$value" ]; then echo "$fallback"; return; fi
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "::warning::${name} is '${value}', not a number; using ${fallback}." >&2
    echo "$fallback"; return
  fi
  if [ "$value" -lt "$min" ]; then echo "::warning::${name} is ${value}; using ${min}, the least it allows." >&2; echo "$min"; return; fi
  if [ "$value" -gt "$max" ]; then echo "::warning::${name} is ${value}; using ${max}, the most it allows." >&2; echo "$max"; return; fi
  echo "$value"
}

KEEP="$(number DEPLOY_SNAPSHOTS_KEEP "${KEEP:-}" 10 3 1000)"
MAX_DELETE="$(number DEPLOY_SNAPSHOTS_MAX_DELETE "${MAX_DELETE:-}" 5 1 20)"
MIN_AGE_DAYS="$(number DEPLOY_SNAPSHOTS_MIN_AGE_DAYS "${MIN_AGE_DAYS:-}" 7 1 3650)"
case "$(printf '%s' "${DRY_RUN:-}" | tr '[:upper:]' '[:lower:]')" in
  0|false|off|no) DRY=0 ;;
  *) DRY=1 ;;
esac

removed=0
would=0
protected=0
note=""

finish() {
  echo "PRUNE_KEPT=${KEEP}"
  echo "PRUNE_REMOVED=${removed}"
  echo "PRUNE_WOULD_REMOVE=${would}"
  echo "PRUNE_PROTECTED=${protected}"
  echo "PRUNE_NOTE=${note:-ok}"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      echo "kept=${KEEP}"
      echo "removed=${removed}"
      echo "would_remove=${would}"
      echo "protected=${protected}"
      echo "note=${note:-ok}"
    } >>"$GITHUB_OUTPUT"
  fi
  exit 0
}

err="$(mktemp)"
trap 'rm -f "$err"' EXIT

# This instance's available deploy-* manual snapshots, with their times and tags. The CLI follows every page.
if ! list="$(aws rds describe-db-snapshots \
  --db-instance-identifier "$RDS_INSTANCE_ID" \
  --snapshot-type manual \
  --query "DBSnapshots[?starts_with(DBSnapshotIdentifier, 'deploy-') && Status == 'available'].{id: DBSnapshotIdentifier, created: SnapshotCreateTime, tags: TagList}" \
  --output json 2>"$err")"; then
  echo "::warning::Could not list the deploy snapshots, so none were removed: $(head -1 "$err")"
  note="list-failed"
  finish
fi

# Newest first: "id<TAB>created<TAB>keep-tag".
if ! rows="$(printf '%s' "$list" | jq -r 'if type == "array" then . else error("not a list") end
    | sort_by(.created) | reverse | .[]
    | [.id, (.created // ""), ([(.tags // [])[] | select((.Key | ascii_downcase) == "keep") | .Value] | first // "")] | @tsv' 2>"$err")"; then
  echo "::warning::The snapshot listing was not what was expected, so none were removed: $(head -1 "$err")"
  note="list-failed"
  finish
fi

ids=()
created=()
keep_tag=()
while IFS=$'\t' read -r id when tag; do
  [ -z "$id" ] && continue
  ids+=("$id"); created+=("$when"); keep_tag+=("$tag")
done <<<"$rows"

if [ "${#ids[@]}" -gt 0 ] && [ -n "$(printf '%s\n' "${ids[@]}" | sort | uniq -d | head -1)" ]; then
  echo "::warning::The snapshot listing names a snapshot twice, so none were removed."
  note="list-suspect"
  finish
fi

dry_note=""
[ "$DRY" = 1 ] && dry_note="; dry run: nothing will be removed"
echo "${#ids[@]} deploy snapshot(s) available; keeping the newest ${KEEP}; removing at most ${MAX_DELETE}, none newer than ${MIN_AGE_DAYS} day(s)${dry_note}."

# Protected snapshots are always kept and never count toward KEEP; of the rest, the newest KEEP stay,
# and the older ones are candidates unless newer than MIN_AGE_DAYS.
cands=()
ordinary=0
for ((i = 0; i < ${#ids[@]}; i++)); do
  id="${ids[$i]}"
  if ! [[ "$id" =~ ^deploy-[0-9a-f]{12}-[0-9]+-[0-9]+$ ]]; then
    echo "Kept ${id}: not named as the workflow names its snapshots."; protected=$((protected + 1)); continue
  fi
  if [ "$(printf '%s' "${keep_tag[$i]}" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    echo "Kept ${id}: tagged keep=true."; protected=$((protected + 1)); continue
  fi
  if [ -n "$RUN_ID" ] && [[ "$id" == *"-${RUN_ID}-"* ]]; then
    echo "Kept ${id}: this run's own."; protected=$((protected + 1)); continue
  fi
  if ! t="$(date -u -d "${created[$i]}" +%s 2>/dev/null)"; then
    echo "Kept ${id}: its creation time could not be read."; protected=$((protected + 1)); continue
  fi
  ordinary=$((ordinary + 1))
  [ "$ordinary" -le "$KEEP" ] && continue
  if [ $((NOW - t)) -lt $((MIN_AGE_DAYS * 86400)) ]; then
    echo "Kept ${id}: newer than ${MIN_AGE_DAYS} day(s)."; protected=$((protected + 1)); continue
  fi
  cands+=("$id")
done

# Oldest first, so a capped run always takes the oldest.
todo=()
for ((i = ${#cands[@]} - 1; i >= 0 && ${#todo[@]} < MAX_DELETE; i--)); do todo+=("${cands[$i]}"); done

if [ "$DRY" = 1 ]; then
  for id in "${todo[@]}"; do echo "Would remove ${id}."; done
  would=${#todo[@]}
  note="dry-run"
  finish
fi

failures=0
for id in "${todo[@]}"; do
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
    failures=$((failures + 1))
    if [ "$failures" -ge 3 ]; then
      echo "::warning::Three removals failed, so no more were tried this run."
      finish
    fi
  fi
done

finish
