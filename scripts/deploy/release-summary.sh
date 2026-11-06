#!/usr/bin/env bash
# =============================================================================
# Release summary (D-21, Evoni 2026-11-06): before a Deploy run is approved,
# list exactly what it will ship, from the last successfully deployed commit
# (base) to the pinned target: every commit and its PR, the migrations, and
# whether the frontend changes. Written for $GITHUB_STEP_SUMMARY.
#
#   release-summary.sh <base_sha|""> <target_sha> [expected_prs] [base_source]
#
#   base_sha      production's baseline from check-pin.sh resolve: the head of
#                 the last successful Deploy run, or baseline_sha
#   target_sha    the pinned commit (already checked by check-pin.sh pin)
#   expected_prs  optional, comma-separated PR numbers (e.g. "3727,3730").
#                 When given, the run fails if the range holds a PR that is not
#                 listed, or a listed PR is not in the range.
#   base_source   "deploy-run" (default) or "given" (baseline_sha), for the label
#
# Reads git only (run in a full-history checkout). Changes nothing.
# Exit 0 = summary written; 3 = expected_prs mismatch; 4 = baseline unknown
# (fails closed: the recent commits are listed for context only);
# 1 = bad input (target missing, base not an ancestor of target).
# Prints "RELEASE_BASE=<sha or empty>" as its last line for the workflow.
# =============================================================================
set -euo pipefail

base="${1:-}"; target="${2:-}"; expected="${3:-}"; source="${4:-deploy-run}"
is_sha() { printf '%s' "${1:-}" | grep -qE '^[0-9a-f]{40}$'; }

if ! is_sha "$target" || ! git cat-file -e "${target}^{commit}" 2>/dev/null; then
  echo "::error::Target ${target} is not a commit in this checkout."
  exit 1
fi

# The PR number of a commit subject: GitHub squash "(#NNNN)" at the end, or
# a merge commit "Merge pull request #NNNN".
pr_of() {
  sed -nE 's/.*\(#([0-9]+)\)[[:space:]]*$/\1/p; s/^Merge pull request #([0-9]+).*/\1/p' | head -1
}

echo "## What this Deploy run will ship"
echo
echo "- **Target (pinned):** \`${target}\`"

if [ -n "$base" ] && is_sha "$base" && git cat-file -e "${base}^{commit}" 2>/dev/null; then
  if ! git merge-base --is-ancestor "$base" "$target"; then
    echo "::error::The last deployed commit ${base} is not an ancestor of ${target}. Nothing was built or changed."
    exit 1
  fi
  if [ "$source" = "given" ]; then
    echo "- **Production now (baseline_sha, given by the person starting the run; checked against the box before any change):** \`${base}\`"
  else
    echo "- **Production now (last successful Deploy):** \`${base}\`"
  fi
  range="${base}..${target}"
  count="$(git rev-list --count "$range")"
  echo "- **Commits:** ${count}"
  echo
  echo "| Commit | PR | Subject |"
  echo "|---|---|---|"
  prs=""
  while IFS=$'\t' read -r sha subject; do
    [ -n "$sha" ] || continue
    pr="$(printf '%s\n' "$subject" | pr_of || true)"
    [ -n "$pr" ] && prs="${prs} ${pr}"
    clean="$(printf '%s' "$subject" | tr '|' '/')"
    echo "| \`${sha}\` | ${pr:+#${pr}} | ${clean} |"
  done < <(git log --reverse --format='%h%x09%s' "$range")
  echo
  added="$(git diff --name-only --diff-filter=A "$base" "$target" -- src/migrations/ || true)"
  changed="$(git diff --name-only --diff-filter=MDR "$base" "$target" -- src/migrations/ || true)"
  frontend="$(git diff --name-only "$base" "$target" -- frontend/ | grep -c . || true)"
  echo "- **New migrations:** $(printf '%s' "$added" | grep -c . || true)"
  printf '%s\n' "$added" | grep . | sed 's#^#  - `#; s#$#`#' || true
  if [ -n "$changed" ]; then
    echo "- **Existing migration files changed (the box's plan refuses this):**"
    printf '%s\n' "$changed" | sed 's#^#  - `#; s#$#`#'
  fi
  echo "- **Frontend files changed:** ${frontend}"
  if [ -n "$expected" ]; then
    want="$(printf '%s' "$expected" | tr ', ' '\n\n' | sed -nE 's/^#?([0-9]+)$/\1/p' | sort -u)"
    have="$(printf '%s\n' $prs | grep . | sort -u || true)"
    extra="$(comm -13 <(printf '%s\n' "$want" | grep . || true) <(printf '%s\n' "$have" | grep . || true) | tr '\n' ' ')"
    missing="$(comm -23 <(printf '%s\n' "$want" | grep . || true) <(printf '%s\n' "$have" | grep . || true) | tr '\n' ' ')"
    echo
    if [ -n "${extra// /}" ] || [ -n "${missing// /}" ]; then
      echo "**Expected PRs do not match.** Not expected: ${extra:-none}. Expected but absent: ${missing:-none}."
      echo "::error::The range does not hold exactly the expected PRs (not expected: ${extra:-none}; absent: ${missing:-none}). Nothing was built or changed."
      echo "RELEASE_BASE=${base}"
      exit 3
    fi
    echo "**Expected PRs match:** $(printf '%s ' $want)"
  fi
  echo "RELEASE_BASE=${base}"
else
  echo "- **Production now:** unknown. **This run stops:** what it would ship cannot be listed."
  echo
  echo "For context only, the last 20 commits up to the target:"
  echo
  git log -20 --format='- `%h` %s' "$target" | tr '|' '/'
  echo
  echo "::error::Production's baseline is unknown, so what this run would ship cannot be listed. Nothing was built or changed. See docs/runbooks/deploy-workflow.md, §4 'Baseline unknown'."
  echo "RELEASE_BASE="
  exit 4
fi
