#!/usr/bin/env bash
# =============================================================================
# Removes the RDS instance's older deploy-* snapshots as the LAST thing a
# Deploy run does: after its own snapshot is available and after the
# migration, the deploy, the restart and the public health check succeeded
# (Evoni, 2026-11-11 and 2026-11-12: an old recovery point is never removed
# before the new one exists, and never by a release that failed). Until then
# it ran before the snapshot (2026-10-22: runs #145 and #146 had stopped with
# SnapshotQuotaExceeded, "cannot create more than 100 manual snapshots").
#
# NEW_SNAPSHOT is the identifier of the snapshot this run just took. Nothing is
# removed unless it is given, is named as the workflow names its snapshots,
# and is in the listing of available snapshots. It is never removed and does
# not count toward KEEP, so a run leaves as many older snapshots as before.
#
# Runs on the GitHub runner with the deploy role, never on the box. It never
# stops a deploy: when the role may not delete snapshots (the permission in
# docs/runbooks/deploy-workflow.md §2.1 not added), or a listing or delete
# fails, it warns and the run goes on.
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
#   - this run's new snapshot (NEW_SNAPSHOT), and its other attempts (the run
#     id in the name);
#   - automated or other manual snapshots, and any not yet available.
# It refuses to remove anything when the listing looks wrong (not a JSON list,
# or an identifier listed twice), and stops after 3 failed removals.
#
# Prints PRUNE_KEPT=, PRUNE_REMOVED=, PRUNE_WOULD_REMOVE=, PRUNE_PROTECTED= and
# PRUNE_NOTE= lines, and writes kept=, removed=, would_remove=, protected= and
# note= to GITHUB_OUTPUT when it is set. note: ok | dry-run | not-permitted |
# some-failed | list-failed | list-suspect | no-new-snapshot.
# Every snapshot selected for removal is named, with when it was made, before
# the first removal.
# =============================================================================
set -uo pipefail

: "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID is not set}"
RUNBOOK="${RUNBOOK:-docs/runbooks/deploy-workflow.md}"
RUN_ID="${GITHUB_RUN_ID:-}"
NEW_SNAPSHOT="${NEW_SNAPSHOT:-}"
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

# No new snapshot named, or not one of the workflow's: nothing is removed.
if ! [[ "$NEW_SNAPSHOT" =~ ^deploy-[0-9a-f]{12}-[0-9]+-[0-9]+$ ]]; then
  echo "::warning::This run's new snapshot was not named (NEW_SNAPSHOT is '${NEW_SNAPSHOT:-empty}'), so no older snapshot was removed."
  note="no-new-snapshot"
  finish
fi

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

# The new snapshot must be in the listing, which holds available snapshots
# only. If it is not, nothing is removed: the older ones are still the newest
# recovery points there are.
new_listed=0
for id in "${ids[@]:-}"; do [ "$id" = "$NEW_SNAPSHOT" ] && new_listed=1; done
if [ "$new_listed" != 1 ]; then
  echo "::warning::This run's new snapshot ${NEW_SNAPSHOT} is not among the available deploy snapshots, so no older snapshot was removed."
  note="no-new-snapshot"
  finish
fi
echo "This run's new snapshot ${NEW_SNAPSHOT} is available. It is kept and does not count toward the newest ${KEEP}."
dry_note=""
[ "$DRY" = 1 ] && dry_note="; dry run: nothing will be removed"
echo "${#ids[@]} deploy snapshot(s) available; keeping the newest ${KEEP}; removing at most ${MAX_DELETE}, none newer than ${MIN_AGE_DAYS} day(s)${dry_note}."

# Protected snapshots are always kept and never count toward KEEP; of the rest, the newest KEEP stay,
# and the older ones are candidates unless newer than MIN_AGE_DAYS.
cands=()
cand_when=()
ordinary=0
for ((i = 0; i < ${#ids[@]}; i++)); do
  id="${ids[$i]}"
  # This run's new snapshot: never a candidate, never counted.
  [ "$id" = "$NEW_SNAPSHOT" ] && continue
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
  cands+=("$id"); cand_when+=("${created[$i]}")
done

# Oldest first, so a capped run always takes the oldest.
todo=()
todo_when=()
for ((i = ${#cands[@]} - 1; i >= 0 && ${#todo[@]} < MAX_DELETE; i--)); do todo+=("${cands[$i]}"); todo_when+=("${cand_when[$i]}"); done

# Named before anything is removed, oldest first.
if [ "${#todo[@]}" -eq 0 ]; then
  echo "Selected for removal: none."
else
  echo "Selected for removal (${#todo[@]}, oldest first):"
  for ((i = 0; i < ${#todo[@]}; i++)); do echo "  ${todo[$i]}  created ${todo_when[$i]}"; done
fi
if [ "$DRY" = 1 ]; then
  for id in "${todo[@]}"; do echo "Would remove ${id}."; done
  would=${#todo[@]}
  note="dry-run"
  finish
fi

failures=0
for id in "${todo[@]}"; do
  # Belt and braces: the new snapshot was excluded above and is refused here too.
  if [ "$id" = "$NEW_SNAPSHOT" ]; then echo "::warning::Refused to remove ${id}: it is this run's new snapshot."; continue; fi
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
