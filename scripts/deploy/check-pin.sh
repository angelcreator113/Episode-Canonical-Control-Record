#!/usr/bin/env bash
# =============================================================================
# Deploy pinning (D-21, Evoni 2026-11-06): the commit a Deploy run builds and
# deploys must be exactly the one the person starting it expected.
#
#   check-pin.sh pin <expected_sha> <actual_sha>
#     Both must be full 40-character lowercase SHAs and equal. Run first in
#     the build job and first in the deploy job, before anything is built or
#     any production credential is taken.
#
#   check-pin.sh base <box_sha> <summary_base_sha> <target_sha> <resume>
#     After the box's read-only plan: production must be at the commit the
#     pre-approval release summary was computed from, so the list the approver
#     saw is the list that ships. A re-run of a run that already moved the box
#     (resume=1, box already at the target) passes. An empty summary base
#     (no earlier successful Deploy run) passes with a notice.
#
# Exit 0 on success; 1 on any mismatch or malformed value. Prints GitHub
# ::error:: lines naming both commits. Changes nothing anywhere.
# =============================================================================
set -euo pipefail

is_sha() { printf '%s' "${1:-}" | grep -qE '^[0-9a-f]{40}$'; }

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
  base)
    box="${2:-}"; base="${3:-}"; target="${4:-}"; resume="${5:-0}"
    if ! is_sha "$box" || ! is_sha "$target"; then
      echo "::error::The box or target commit is not a full SHA (box '${box}', target '${target}'). Nothing was changed."
      exit 1
    fi
    if [ "$resume" = "1" ] && [ "$box" = "$target" ]; then
      echo "The box is already at ${target} (a re-run); the release summary does not apply."
      exit 0
    fi
    if [ -z "$base" ]; then
      echo "::notice::No earlier successful Deploy run was found, so the release summary had no base; the box is at ${box}."
      exit 0
    fi
    if ! is_sha "$base"; then
      echo "::error::The release summary's base is not a full SHA (got '${base}'). Nothing was changed."
      exit 1
    fi
    if [ "$box" != "$base" ]; then
      echo "::error::Production is at ${box}, but the release summary shown before approval was computed from ${base}. What ships is not what was listed. Nothing was changed."
      exit 1
    fi
    echo "Production is at ${box}, the release summary's base."
    ;;
  *)
    echo "usage: check-pin.sh pin <expected_sha> <actual_sha> | base <box_sha> <summary_base_sha> <target_sha> <resume>" >&2
    exit 2
    ;;
esac
