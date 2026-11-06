#!/usr/bin/env bash
# =============================================================================
# Deploy pinning (D-21, Evoni 2026-11-06): the commit a Deploy run builds and
# deploys must be exactly the one the person starting it expected, and the
# release summary shown before approval must start from where production is.
# Every check fails closed: anything unknown stops the run.
#
#   check-pin.sh pin <expected_sha> <actual_sha>
#     Both must be full 40-character lowercase SHAs and equal. Run first in
#     the build job and first in the deploy job, before anything is built or
#     any production credential is taken.
#
#   check-pin.sh resolve <lookup_ok> <found_sha> <given_sha>
#     Chooses the release summary's base (production's baseline) in the build
#     job. <lookup_ok> is 1 when the GitHub API lookup of the last successful
#     Deploy run worked, <found_sha> its head commit ("" when none was found),
#     <given_sha> the optional baseline_sha input. Prints BASE=<sha> and
#     SOURCE=deploy-run|given. An unknown baseline with no baseline_sha, a
#     baseline_sha that contradicts a found run, or a malformed value: exit 1.
#
#   check-pin.sh base <box_sha> <base_sha> <target_sha> <box_stage> <box_from>
#     After the box's read-only plan, before any snapshot. Passes only when
#       (a) the box is at <base_sha>, the commit the summary started from; or
#       (b) the box's own deploy records (PLAN_BOX_STAGE / PLAN_BOX_FROM, see
#           box_stage_of in workflow-deploy.sh) say a workflow deploy put it
#           where it is, coming from <base_sha>: "unfinished" (the tree moved,
#           the restart has not succeeded) or "finished" (the restart
#           succeeded, the run did not). The summary's range then still holds
#           everything the API has not yet been verified on.
#     A box at the target with no such record fails: an equal commit alone is
#     not proof that a deploy happened or finished. An empty base fails.
#
# Exit 0 on success; 1 on any mismatch, unknown or malformed value; 2 on a
# usage error. Prints GitHub ::error:: lines naming the commits and the way
# forward. Changes nothing anywhere.
# =============================================================================
set -euo pipefail

is_sha() { printf '%s' "${1:-}" | grep -qE '^[0-9a-f]{40}$'; }
RUNBOOK="docs/runbooks/deploy-workflow.md"

mode="${1:-}"
case "$mode" in
  pin)
    expected="${2:-}"; actual="${3:-}"
    if ! is_sha "$expected"; then
      echo "::error::expected_sha must be the full 40-character lowercase commit SHA (got '${expected}'). Nothing was built or changed."
      exit 1
    fi
    if ! is_sha "$actual"; then
      echo "::error::The run's own commit is not a full SHA (got '${actual}'). Nothing was built or changed."
      exit 1
    fi
    if [ "$expected" != "$actual" ]; then
      echo "::error::main is at ${actual}, not the expected ${expected}. Nothing was built or changed. Check what was merged to main since the deploy was prepared, then prepare again."
      exit 1
    fi
    echo "Pinned commit confirmed: ${actual}."
    ;;
  resolve)
    lookup_ok="${2:-0}"; found="${3:-}"; given="${4:-}"
    if [ -n "$given" ] && ! is_sha "$given"; then
      echo "::error::baseline_sha must be the full 40-character lowercase commit SHA (got '${given}'). Nothing was built or changed."
      exit 1
    fi
    if [ "$lookup_ok" = "1" ] && [ -n "$found" ] && ! is_sha "$found"; then
      echo "::error::The last successful Deploy run's commit is not a full SHA (got '${found}'). Nothing was built or changed."
      exit 1
    fi
    if [ "$lookup_ok" = "1" ] && [ -n "$found" ]; then
      if [ -n "$given" ] && [ "$given" != "$found" ]; then
        echo "::error::baseline_sha ${given} contradicts the last successful Deploy run, which deployed ${found}. baseline_sha is only for a baseline the run cannot find. Nothing was built or changed. Start a new run without baseline_sha, or find out why they differ ($RUNBOOK, §4 'Baseline unknown')."
        exit 1
      fi
      echo "BASE=${found}"
      echo "SOURCE=deploy-run"
      exit 0
    fi
    if [ "$lookup_ok" = "1" ]; then why="no successful Deploy run on main was found"; else why="the lookup of the last successful Deploy run failed"; fi
    if [ -z "$given" ]; then
      echo "::error::Production's baseline is unknown (${why}), so this run cannot list what it would ship. Nothing was built or changed. To go on: read the commit production runs ($RUNBOOK, §4 'Baseline unknown'), then start a new run with that commit as baseline_sha. The run still stops before any snapshot if the box is not at it."
      exit 1
    fi
    echo "::warning::Baseline from baseline_sha (${given}), given by the person starting the run, because ${why}. The deploy job checks the box is at it before any change."
    echo "BASE=${given}"
    echo "SOURCE=given"
    ;;
  base)
    box="${2:-}"; base="${3:-}"; target="${4:-}"; stage="${5:-none}"; from="${6:-}"
    if ! is_sha "$box" || ! is_sha "$target"; then
      echo "::error::The box or target commit is not a full SHA (box '${box}', target '${target}'). Nothing was changed."
      exit 1
    fi
    if ! is_sha "$base"; then
      echo "::error::The release summary had no baseline (got '${base}'), so what ships was not listed before approval. Nothing was changed. See $RUNBOOK, §4 'Baseline unknown'."
      exit 1
    fi
    if [ "$box" = "$base" ]; then
      echo "Production is at ${box}, the release summary's base."
      exit 0
    fi
    case "$stage" in
      unfinished|finished)
        if is_sha "$from" && [ "$from" = "$base" ]; then
          if [ "$stage" = "unfinished" ]; then
            echo "::notice::The box is at ${box}, put there by a Deploy run from ${base} whose restart did not succeed (the API still runs ${base}). This run carries that range on; the release summary from ${base} covers it."
          else
            echo "::notice::The box is at ${box}, where a Deploy run from ${base} restarted the API, but that run did not finish. This run verifies it again (migrate check, restart, health); the release summary from ${base} covers it."
          fi
          exit 0
        fi
        echo "::error::The box is at ${box}; its records say a deploy left it ${stage}, coming from ${from:-unknown}, not from the release summary's base ${base}. What ships is not what was listed. Nothing was changed. See $RUNBOOK, §4 'Baseline unknown'."
        exit 1
        ;;
    esac
    if [ "$box" = "$target" ]; then
      echo "::error::The box is already at ${target}, but no Deploy record on it says a deploy put it there (stage '${stage}'). An equal commit is not proof the deploy happened or finished. Nothing was changed. See $RUNBOOK, §4 'Box at the target without a record'."
      exit 1
    fi
    echo "::error::Production is at ${box}, but the release summary shown before approval was computed from ${base}. What ships is not what was listed. Nothing was changed."
    exit 1
    ;;
  *)
    echo "usage: check-pin.sh pin <expected_sha> <actual_sha> | resolve <lookup_ok> <found_sha> <given_sha> | base <box_sha> <base_sha> <target_sha> <box_stage> <box_from>" >&2
    exit 2
    ;;
esac
