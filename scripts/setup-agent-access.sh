#!/usr/bin/env bash
# setup-agent-access.sh: one-time, idempotent provisioning of Claude Code's
# scoped AWS access, run by Evoni (AWS CloudShell or her own terminal).
# Agent sessions never run this script.
#
# What it does (each step is safe to repeat):
#   1. Creates or updates the IAM role PrimeStudios-AgentAccess-GHA, which only
#      a GitHub Actions job in the `agent-access` environment can assume (OIDC,
#      short-lived credentials). Trust: infra/agent-access/assume-role-policy.json.
#   2. Puts the inline permissions policy infra/agent-access/policy.json on it,
#      with <BUCKET_NAME> filled in.
#   3. Turns on versioning for the bucket.
#   4. Reports, read-only, whether RDS automated backups are on.
#   5. Reports, read-only, whether an old IAM user claude-code-agent exists
#      and lists its access-key ids (never secrets), so it can be removed.
#
# What it never does: create an IAM user, create an access key, print or write
# any credential, or write anything to disk. Under F-Tools-3 (2026-10-29) a
# session holds no long-lived keys; see docs/runbooks/agent-access.md.
#
# Usage:
#   bash setup-agent-access.sh <bucket-name> [--repo owner/name] [--dry-run]
#
#   --repo      GitHub repository allowed to assume the role
#               (default: angelcreator113/Episode-Canonical-Control-Record)
#   --dry-run   show the rendered policies and what would change; make only
#               read calls

set -euo pipefail

ROLE_NAME="PrimeStudios-AgentAccess-GHA"
POLICY_NAME="AgentAccessScoped"
LEGACY_USER="claude-code-agent"
GH_ENVIRONMENT="agent-access"
REPO="angelcreator113/Episode-Canonical-Control-Record"
DRY_RUN=0
BUCKET=""

usage() { printf 'Usage: bash setup-agent-access.sh <bucket-name> [--repo owner/name] [--dry-run]\n'; }
say()   { printf '%s\n' "$*"; }
step()  { printf '\n== %s\n' "$*"; }
die()   { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)    [ $# -ge 2 ] || die "--repo needs owner/name"; REPO="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*)        die "unknown option: $1" ;;
    *)         [ -z "$BUCKET" ] || die "only one bucket name is accepted"; BUCKET="$1"; shift ;;
  esac
done

[ -n "$BUCKET" ] || { usage; die "bucket name is required"; }
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || die "not a valid S3 bucket name: $BUCKET"
[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "--repo must look like owner/name"
command -v aws >/dev/null 2>&1 || die "the aws CLI is not installed (CloudShell has it)"

# The policy files sit next to the script (CloudShell download) or in the repo.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_DIR=""
for d in "$SCRIPT_DIR" "$SCRIPT_DIR/../infra/agent-access"; do
  if [ -f "$d/policy.json" ] && [ -f "$d/assume-role-policy.json" ]; then POLICY_DIR="$d"; break; fi
done
[ -n "$POLICY_DIR" ] || die "policy.json and assume-role-policy.json not found next to the script or in ../infra/agent-access"

run() {
  # Write calls go through here so --dry-run can skip them.
  if [ "$DRY_RUN" -eq 1 ]; then say "   (dry run) would run: aws $*"; else aws "$@"; fi
}

step "Who am I"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
[[ "$ACCOUNT_ID" =~ ^[0-9]{12}$ ]] || die "could not read the account id"
say "   signed in to the account ending ${ACCOUNT_ID: -4}"

# Policies are rendered in memory only; nothing is written to disk.
PERMISSIONS_JSON="$(sed "s/<BUCKET_NAME>/${BUCKET}/g" "$POLICY_DIR/policy.json")"
TRUST_JSON="$(sed -e "s/<ACCOUNT_ID>/${ACCOUNT_ID}/g" -e "s#<GITHUB_REPO>#${REPO}#g" "$POLICY_DIR/assume-role-policy.json")"
if printf '%s' "$PERMISSIONS_JSON$TRUST_JSON" | grep -q '<[A-Z_]*>'; then die "a placeholder was left unfilled"; fi

step "Bucket ${BUCKET}"
aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1 || die "bucket not found, or this login cannot see it"
say "   found"

step "GitHub OIDC provider"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  say "   present"
else
  die "token.actions.githubusercontent.com is not set up in IAM; add it first (docs/runbooks/deploy-workflow.md), then run this again"
fi

step "Role ${ROLE_NAME}"
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  say "   exists; refreshing its trust policy"
  run iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST_JSON"
else
  say "   creating"
  run iam create-role --role-name "$ROLE_NAME" \
    --description "Claude Code scoped read access; assumed only by the agent-access GitHub environment" \
    --assume-role-policy-document "$TRUST_JSON" --max-session-duration 3600 \
    --query 'Role.RoleName' --output text
fi
say "   putting inline policy ${POLICY_NAME} (replaces any earlier version)"
run iam put-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --policy-document "$PERMISSIONS_JSON"

step "Bucket versioning"
BEFORE="$(aws s3api get-bucket-versioning --bucket "$BUCKET" --query Status --output text)"
[ "$BEFORE" = "None" ] && BEFORE="never enabled"
say "   before: ${BEFORE}"
if [ "$BEFORE" = "Enabled" ]; then
  say "   already on; no change"
else
  run s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  [ "$DRY_RUN" -eq 1 ] || say "   now: $(aws s3api get-bucket-versioning --bucket "$BUCKET" --query Status --output text)"
fi

step "RDS automated backups (read only)"
RDS_ROWS="$(aws rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier,BackupRetentionPeriod]' --output text || true)"
if [ -z "$RDS_ROWS" ]; then
  say "   no RDS instances visible in this region"
else
  while read -r name days; do
    [ -n "${name:-}" ] || continue
    if [ "${days:-0}" -gt 0 ] 2>/dev/null; then say "   ${name}: ON (${days}-day retention)"
    else say "   ${name}: OFF; turn it on in the RDS console (Modify, Backup retention). This script does not change RDS"; fi
  done <<< "$RDS_ROWS"
fi

step "Old IAM user ${LEGACY_USER} (read only)"
if aws iam get-user --user-name "$LEGACY_USER" >/dev/null 2>&1; then
  say "   EXISTS. It is not used by this setup. Its access-key ids (no secrets):"
  aws iam list-access-keys --user-name "$LEGACY_USER" --query 'AccessKeyMetadata[].[AccessKeyId,Status,CreateDate]' --output text | sed 's/^/     /'
  say "   Remove it as shown in docs/runbooks/agent-access.md, section 5"
else
  say "   none (good)"
fi

step "Done"
if [ "$DRY_RUN" -eq 1 ]; then
  say "   dry run: nothing was changed"
else
  say "   Role ARN: arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
  say "   Put it in GitHub as the environment secret AWS_AGENT_ACCESS_ROLE_ARN of environment"
  say "   '${GH_ENVIRONMENT}' (docs/runbooks/agent-access.md, section 3). Do not paste it into a"
  say "   Claude conversation: it contains your account id."
fi
say "   No IAM user and no access key were created. Nothing was written to disk."
