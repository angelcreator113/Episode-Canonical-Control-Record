#!/usr/bin/env bash
# scripts/diagnostics/publish.sh — puts one diagnostics report in the PRIVATE
# output repository (.github/workflows/diagnostics.yml; F-Tools-2, 2026-10-29).
#
# Runs on the GitHub runner only. This repository is public, so its Actions logs
# and artifacts are readable by anyone: the report itself never goes there. This
# script prints only fixed messages, the report's path in the output repository,
# its size and the first 16 characters of its sha256 (so a reader of the private
# copy can confirm it is the same file). Git's own output is discarded.
#
# Usage:
#   publish.sh --check-private          confirm the output repository is private; publish nothing
#   publish.sh <report-file> <check>    confirm again, then commit the report and push
# Needs: DIAG_OUTPUT_REPO (owner/name); for publishing, DIAG_OUTPUT_DEPLOY_KEY
#        (a write deploy key for that repository only) and RUNNER_TEMP.
# Exit: 0 ok; 1 failed; 2 refused (the repository is not confirmed private, CLAUDECODE).

set -uo pipefail

if [ -n "${CLAUDECODE:-}" ]; then
  echo "REFUSED: CLAUDECODE is set, so this is a Claude Code session. Only the Diagnostics workflow runs this."
  exit 2
fi
: "${DIAG_OUTPUT_REPO:?DIAG_OUTPUT_REPO is not set}"
if ! printf '%s' "$DIAG_OUTPUT_REPO" | grep -qE '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'; then
  echo "REFUSED: DIAG_OUTPUT_REPO must be owner/name."; exit 2
fi
if [ "$DIAG_OUTPUT_REPO" = "${GITHUB_REPOSITORY:-}" ]; then
  echo "REFUSED: the output repository cannot be this (public) repository."; exit 2
fi
GITHUB_WEB="${GITHUB_WEB:-https://github.com}"

# A private repository answers 404 to a signed-out visitor; a public one 200.
# Anything else (a redirect after a rename, an error) is not proof, so refuse.
confirm_private() {
  local code
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$GITHUB_WEB/$DIAG_OUTPUT_REPO" 2>/dev/null || echo error)"
  case "$code" in
    404) echo "The output repository is private (a signed-out request gets 404)."; return 0 ;;
    200) echo "REFUSED: the output repository is PUBLIC. Nothing was published. Make it private first."; return 2 ;;
    *) echo "REFUSED: could not confirm the output repository is private (status $code). Nothing was published."; return 2 ;;
  esac
}

if [ "${1:-}" = "--check-private" ]; then
  confirm_private; exit $?
fi

REPORT="${1:?report file required}"
CHECK="${2:?check name required}"
: "${DIAG_OUTPUT_DEPLOY_KEY:?DIAG_OUTPUT_DEPLOY_KEY is not set}" "${RUNNER_TEMP:?}"
if [ ! -s "$REPORT" ]; then echo "The report is empty; nothing to publish."; exit 1; fi
if ! printf '%s' "$CHECK" | grep -qE '^[a-z-]+$'; then echo "REFUSED: unexpected check name."; exit 2; fi

confirm_private || exit $?

WORK="$(mktemp -d "$RUNNER_TEMP/diag-publish.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
KEY="$WORK/key"
KNOWN="$WORK/known_hosts"
( umask 077; printf '%s\n' "$DIAG_OUTPUT_DEPLOY_KEY" >"$KEY" )
# GitHub's published ed25519 host key (docs.github.com, "GitHub's SSH key
# fingerprints": SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU), pinned
# so a spoofed host is refused rather than trusted on first use.
echo 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' >"$KNOWN"
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o UserKnownHostsFile=$KNOWN -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes"
REMOTE="${DIAG_OUTPUT_REMOTE:-git@github.com:$DIAG_OUTPUT_REPO.git}"

DAY="$(date -u '+%Y-%m-%d')"
REL="runs/$DAY/${GITHUB_RUN_ID:-local}-$CHECK.md"
SHA256="$(sha256sum "$REPORT" | cut -c1-16)"
BYTES="$(wc -c <"$REPORT" | tr -d ' ')"

cd "$WORK" || exit 1
git init -q repo >/dev/null 2>&1 && cd repo || { echo "Could not prepare a working copy."; exit 1; }
git remote add origin "$REMOTE" >/dev/null 2>&1
git config user.name "prime-diagnostics"
git config user.email "prime-diagnostics@users.noreply.github.com"
# The first run finds an empty repository: start main there.
if git fetch -q --depth 1 origin main >/dev/null 2>&1; then
  git checkout -q -B main FETCH_HEAD >/dev/null 2>&1
else
  git checkout -q --orphan main >/dev/null 2>&1
fi
mkdir -p "runs/$DAY"
cp "$REPORT" "$REL"
cp "$REPORT" "latest-$CHECK.md"
git add "$REL" "latest-$CHECK.md" >/dev/null 2>&1
git commit -q -m "diagnostics: $CHECK (run ${GITHUB_RUN_ID:-local})" >/dev/null 2>&1 || { echo "Could not commit the report."; exit 1; }

for attempt in 1 2 3; do
  if git push -q origin HEAD:main >/dev/null 2>&1; then
    echo "Published to the private repository: $DIAG_OUTPUT_REPO/$REL ($BYTES bytes, sha256 $SHA256…)."
    exit 0
  fi
  # Runs never overlap (the workflow's concurrency group), so a failure here is
  # the network or the key: wait and try again.
  sleep $((attempt * 2))
done
echo "Could not push the report to the output repository (check the deploy key has write access)."
exit 1
