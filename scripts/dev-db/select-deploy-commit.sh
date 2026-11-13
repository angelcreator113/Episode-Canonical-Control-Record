#!/usr/bin/env bash
# Which commit does this Deploy to Development run install? Runs on the
# GitHub runner, in a full checkout (fetch-depth 0). Read-only.
#
#   COMMIT      the workflow's `commit` input: empty, or a full 40-character sha
#   HEAD_SHA    the commit the workflow was dispatched on (github.sha)
#   REF_NAME    the ref it was dispatched on (github.ref)
#   REPO        owner/name (for the checks lookup)
#   MAIN_REF    default origin/main
#
# Empty COMMIT: the dispatched commit, as before (explicit=false). Its tests
# are looked up, or run, by the workflow's next jobs.
#
# A COMMIT (a redeploy or a rollback to a commit already verified;
# Evoni, 2026-11-13) is accepted only when all of these hold:
#   * it is a full lowercase 40-character sha;
#   * the workflow was dispatched on main, so main's own workflow, environment
#     rules and on-box scripts are the ones that run;
#   * the commit exists and is on main (an ancestor of MAIN_REF, or its tip);
#   * main's CI passed its required checks for exactly that commit: one
#     Validate run on a push to main whose Tests, Route Validation and Cost
#     Exposure Audit jobs all succeeded. Nothing is re-run in its place.
# Schema compatibility is decided on the box, against the database itself
# (scripts/dev-db/preflight-dev-deploy.sh); this prints only what main has
# that the commit does not.
#
# Writes sha=<40 hex> and explicit=true|false to $GITHUB_OUTPUT.
# Exit 0 accepted; 1 refused, with one SELECT REFUSED line.
set -uo pipefail
set +x

COMMIT="${COMMIT:-}"
HEAD_SHA="${HEAD_SHA:?}"
REF_NAME="${REF_NAME:-}"
REPO="${REPO:-}"
MAIN_REF="${MAIN_REF:-origin/main}"
OUT="${GITHUB_OUTPUT:-/dev/null}"
REQUIRED_JOBS=("Tests" "Route Validation" "Cost Exposure Audit")

refuse() { echo "SELECT REFUSED: $*"; exit 1; }

[[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]] || refuse "the dispatched commit is not a full sha."

if [ -z "$COMMIT" ]; then
  echo "No commit selected: deploying the dispatched commit ${HEAD_SHA:0:12}."
  { echo "sha=${HEAD_SHA}"; echo "explicit=false"; } >> "$OUT"
  exit 0
fi

[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || refuse "the commit must be a full, lowercase, 40-character sha. Nothing was deployed."
[ "$REF_NAME" = "refs/heads/main" ] || refuse "a selected commit is deployed only from a run dispatched on main. Nothing was deployed."
git cat-file -e "${COMMIT}^{commit}" 2>/dev/null || refuse "${COMMIT:0:12} is not a commit in this repository. Nothing was deployed."
git merge-base --is-ancestor "$COMMIT" "$MAIN_REF" 2>/dev/null || refuse "${COMMIT:0:12} is not on main. Nothing was deployed."

echo "Selected commit: ${COMMIT}  $(git log -1 --format='%ad %s' --date=short "$COMMIT" | cut -c1-100)"

# Main's CI for exactly this commit: one Validate push run with every required job green.
passed=false
run_ids="$(gh api "repos/${REPO}/actions/runs?head_sha=${COMMIT}&branch=main&event=push&per_page=100" \
  --jq '.workflow_runs[] | select(.path == ".github/workflows/validate.yml") | .id' 2>/dev/null || true)"
for id in $run_ids; do
  jobs="$(gh api "repos/${REPO}/actions/runs/${id}/jobs?per_page=100" --jq '.jobs[] | "\(.name)\t\(.conclusion)"' 2>/dev/null || true)"
  ok=true
  for name in "${REQUIRED_JOBS[@]}"; do
    conclusion="$(printf '%s\n' "$jobs" | awk -F'\t' -v n="$name" '$1 == n {print $2}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
    echo "Validate run ${id}: ${name}: ${conclusion:-none}"
    [ "$conclusion" = "success" ] || ok=false
  done
  if [ "$ok" = "true" ]; then passed=true; fi
done
[ -n "$run_ids" ] || echo "No Validate push run on main for ${COMMIT:0:12}."
[ "$passed" = "true" ] || refuse "main's CI did not pass ${REQUIRED_JOBS[*]} for ${COMMIT:0:12}. Only a commit CI verified on main can be selected. Nothing was deployed."

newer="$(git diff --name-only --diff-filter=A "$COMMIT" "$MAIN_REF" -- src/migrations 2>/dev/null | grep -c . || true)"
if [ "$newer" -gt 0 ]; then
  echo "Note: main has ${newer} migration file(s) that ${COMMIT:0:12} does not. If the dev database has applied any of them, the on-box preflight refuses this commit."
fi

{ echo "sha=${COMMIT}"; echo "explicit=true"; } >> "$OUT"
echo "Accepted: ${COMMIT:0:12} is on main and CI-verified."
