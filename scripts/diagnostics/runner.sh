#!/usr/bin/env bash
# scripts/diagnostics/runner.sh — the runner half of the Diagnostics workflow
# (.github/workflows/diagnostics.yml; F-Tools-2, 2026-10-29).
#
# Runs on the GitHub runner only, with the short-lived read-only role
# PrimeStudios-ReadOnly-GHA. Collects one named check: AWS reads made here, and
# server reads through the PrimeStudios-Diagnostics SSM document (never
# AWS-RunShellScript). It changes nothing.
#
# PRIVACY: the workflow sends everything this script prints to a file, which is
# masked by redact.js and published to the PRIVATE output repository. Nothing
# from here reaches the public Actions log. Do not add `echo ::...` workflow
# commands or write to GITHUB_STEP_SUMMARY from this file.
#
# Usage: runner.sh <check>   (the list is in usage() below)
# Needs: AWS_REGION, EC2_INSTANCE_ID, RDS_INSTANCE_ID, TARGET_SHA; optional
#        HEALTH_URL, DIAG_S3_BUCKETS (space- or comma-separated names),
#        DIAG_COGNITO_POOL_ID, SSM_DOCUMENT (default PrimeStudios-Diagnostics).
# Exit: 0 ok; 1 a check reported a problem; 2 refused (bad arguments, CLAUDECODE).

set -uo pipefail

CHECK="${1:-}"
SSM_DOCUMENT="${SSM_DOCUMENT:-PrimeStudios-Diagnostics}"
BOX_WAIT_S="${BOX_WAIT_S:-150}"
POLL_S="${POLL_S:-5}"
RC=0

usage() {
  cat <<'EOF'
checks:
  overview        public health, AWS infrastructure, box health, deployed commit, database
  health          public health and box health
  deploy-state    the deployed commit against main
  app-logs        API error and output logs (masked)
  worker-logs     worker logs (masked)
  nginx-logs      nginx errors, status counts, top 5xx paths
  db              database connectivity, read-only proof, migrations
  db-schema       tables and column counts
  db-counts       row counts
  aws-infra       EC2, RDS, SSM, SQS and alarm status
  s3-config       bucket settings and listing summaries (never object contents)
  cognito-config  user pool settings, app clients, groups (no users, no secrets)
  self-test       proves reads work and writes, secrets and object reads are refused
  db-snapshot     the daily database snapshot: schema, exact counts, allowlisted samples
                  (scheduled runs only; F-Tools-2 Amendment 1)
EOF
}

if [ -n "${CLAUDECODE:-}" ]; then
  echo "REFUSED: CLAUDECODE is set, so this is a Claude Code session. Only the Diagnostics workflow runs this."
  exit 2
fi
case "$CHECK" in
  overview|health|deploy-state|app-logs|worker-logs|nginx-logs|db|db-schema|db-counts|aws-infra|s3-config|cognito-config|self-test|db-snapshot) ;;
  *) echo "REFUSED: unknown check '$CHECK'."; usage; exit 2 ;;
esac
# Amendment 1 §2: the snapshot, with its content samples, comes only from the
# schedule. A re-run of a scheduled run keeps the event name; a dispatch does not.
if [ "$CHECK" = "db-snapshot" ] && [ "${GITHUB_EVENT_NAME:-}" != "schedule" ]; then
  echo "REFUSED: db-snapshot runs only from the schedule (F-Tools-2 Amendment 1 §2)."
  exit 2
fi
: "${AWS_REGION:?}" "${EC2_INSTANCE_ID:?}" "${RDS_INSTANCE_ID:?}" "${TARGET_SHA:?}"
if ! printf '%s' "$TARGET_SHA" | grep -qE '^[0-9a-f]{40}$'; then
  echo "REFUSED: TARGET_SHA must be a full 40-character SHA."; exit 2
fi

section() { printf '\n## %s\n' "$1"; }
buckets() { printf '%s' "${DIAG_S3_BUCKETS:-}" | tr ',' ' '; }

# Runs a read and prints its output; a failure is printed and noted, not fatal.
read_cmd() {
  local label="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    printf '%s:\n%s\n' "$label" "$out"
  else
    printf '%s: FAILED: %s\n' "$label" "$(printf '%s' "$out" | head -3)"
    RC=1
  fi
}

# ---------------------------------------------------------------------------
# Server checks through SSM. Works while the API is down: only the box and its
# SSM agent need to be up. If the agent is not online, says so and returns.
# ---------------------------------------------------------------------------
box() {
  local check="$1" page="${2:-0}" run="${3:-0}" ping cmd_id status waited=0 params
  section "server: $check"
  ping="$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=${EC2_INSTANCE_ID}" \
    --query "InstanceInformationList[0].PingStatus" --output text 2>&1)" || ping="error: $ping"
  if [ "$ping" != "Online" ]; then
    echo "SSM agent status: ${ping:-unknown}. The server cannot be reached through SSM, so no on-box check ran."
    echo "If the instance itself is up (see aws-infra), the SSM agent or the instance role is the problem; if it is down, EC2 status checks say why."
    RC=1; return
  fi
  params="$(mktemp)"
  jq -n --arg c "$check" --arg s "$TARGET_SHA" --arg p "$page" --arg r "$run" '{check: [$c], sha: [$s], page: [$p], run: [$r]}' >"$params"
  if ! cmd_id="$(aws ssm send-command \
      --instance-ids "$EC2_INSTANCE_ID" \
      --document-name "$SSM_DOCUMENT" \
      --comment "diagnostics $check run ${GITHUB_RUN_ID:-local}" \
      --parameters "file://$params" \
      --query "Command.CommandId" --output text 2>&1)"; then
    rm -f "$params"
    echo "send-command FAILED: $(printf '%s' "$cmd_id" | head -3)"
    RC=1; return
  fi
  rm -f "$params"
  status="Pending"
  while :; do
    sleep "$POLL_S"
    waited=$((waited + POLL_S))
    status="$(aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$EC2_INSTANCE_ID" \
      --query "Status" --output text 2>/dev/null || echo Pending)"
    case "$status" in Pending|InProgress|Delayed) ;; *) break ;; esac
    if [ "$waited" -ge "$BOX_WAIT_S" ]; then echo "no answer within ${BOX_WAIT_S}s (last status: $status)"; RC=1; return; fi
  done
  aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$EC2_INSTANCE_ID" \
    --query "StandardOutputContent" --output text 2>&1
  local err
  err="$(aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$EC2_INSTANCE_ID" \
    --query "StandardErrorContent" --output text 2>/dev/null)"
  if [ -n "$err" ] && [ "$err" != "None" ]; then printf 'on-box errors:\n%s\n' "$(printf '%s' "$err" | tail -20)"; fi
  echo "SSM status: $status"
  if [ "$status" != "Success" ]; then RC=1; fi
}

# ---------------------------------------------------------------------------
# The daily database snapshot (F-Tools-2 Amendment 1): fetched from the box in
# pages through the diagnostics document, joined, checked against the box's
# sha256, unpacked, and printed into the report. It was masked on the box.
# ---------------------------------------------------------------------------
snapshot() {
  local run="${GITHUB_RUN_ID:-0}" page=0 pages=1 out b64="" sha="" dbexit="" part
  while [ "$page" -lt "$pages" ]; do
    out="$(box db-snapshot "$page" "$run")"
    if ! printf '%s\n' "$out" | grep -q '^SNAPSHOT-END$'; then
      section "database snapshot"
      echo "FAIL page $page did not arrive:"
      printf '%s\n' "$out" | grep -vE '^[A-Za-z0-9+/=]{20,}$' | tail -15
      RC=1; return
    fi
    pages="$(printf '%s\n' "$out" | sed -n 's/^SNAPSHOT-PAGES \([0-9]*\)$/\1/p' | head -1)"
    if [ "$page" = 0 ]; then
      sha="$(printf '%s\n' "$out" | sed -n 's/^SNAPSHOT-SHA256 \([0-9a-f]*\)$/\1/p' | head -1)"
      dbexit="$(printf '%s\n' "$out" | sed -n 's/^SNAPSHOT-DB-EXIT \(.*\)$/\1/p' | head -1)"
    fi
    part="$(printf '%s\n' "$out" | sed -n '/^SNAPSHOT-PART /,/^SNAPSHOT-END$/p' | sed '1d;$d' | tr -d '\n')"
    b64="$b64$part"
    page=$((page + 1))
    if [ "$page" -gt 500 ]; then section "database snapshot"; echo "FAIL more than 500 pages"; RC=1; return; fi
  done
  if [ -z "$sha" ] || [ "$(printf '%s' "$b64" | sha256sum | cut -d' ' -f1)" != "$sha" ]; then
    section "database snapshot"; echo "FAIL the joined pages do not match the box's checksum"; RC=1; return
  fi
  if ! printf '%s' "$b64" | base64 -d | gunzip; then
    section "database snapshot"; echo "FAIL the snapshot could not be unpacked"; RC=1; return
  fi
  echo
  echo "snapshot: $pages page(s), sha256 ${sha:0:16}…; database part exit ${dbexit:-unknown}"
  if [ "$dbexit" != "0" ]; then RC=1; fi
}

public_health() {
  section "public health"
  if [ -z "${HEALTH_URL:-}" ]; then echo "HEALTH_URL is not set"; return; fi
  local out code
  out="$(curl -sS -m 15 -o - -w '\n%{http_code} %{time_total}s' "$HEALTH_URL" 2>&1)"
  code="$(printf '%s' "$out" | tail -n 1)"
  echo "status and time: $code"
  printf '%s\n' "$out" | sed '$d' | head -c 1500
  case "$code" in 2*) ;; *) RC=1 ;; esac
}

aws_infra() {
  section "EC2"
  read_cmd "instance" aws ec2 describe-instances --instance-ids "$EC2_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].{state:State.Name,type:InstanceType,launched:LaunchTime,profile:IamInstanceProfile.Arn}" --output table
  read_cmd "status checks" aws ec2 describe-instance-status --instance-ids "$EC2_INSTANCE_ID" --include-all-instances \
    --query "InstanceStatuses[0].{system:SystemStatus.Status,instance:InstanceStatus.Status,events:length(Events||\`[]\`)}" --output table
  section "RDS"
  read_cmd "database instance" aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" \
    --query "DBInstances[0].{status:DBInstanceStatus,class:DBInstanceClass,engine:EngineVersion,storageGB:AllocatedStorage,multiAZ:MultiAZ,public:PubliclyAccessible,backupDays:BackupRetentionPeriod,pendingChanges:PendingModifiedValues}" --output json
  read_cmd "free storage (bytes, last hour, minimum)" aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name FreeStorageSpace \
    --dimensions "Name=DBInstanceIdentifier,Value=$RDS_INSTANCE_ID" --statistics Minimum --period 3600 \
    --start-time "$(date -u -d '-1 hour' '+%Y-%m-%dT%H:%M:%SZ')" --end-time "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --query "Datapoints[0].Minimum" --output text
  read_cmd "events (last 24 h)" aws rds describe-events --source-type db-instance --source-identifier "$RDS_INSTANCE_ID" \
    --duration 1440 --query "Events[-10:].[Date,Message]" --output text
  read_cmd "deploy snapshots (count, newest)" aws rds describe-db-snapshots --db-instance-identifier "$RDS_INSTANCE_ID" \
    --snapshot-type manual --query "[length(DBSnapshots), sort_by(DBSnapshots,&SnapshotCreateTime)[-1].[DBSnapshotIdentifier,Status,SnapshotCreateTime]]" --output text
  section "SSM"
  read_cmd "agent" aws ssm describe-instance-information --filters "Key=InstanceIds,Values=${EC2_INSTANCE_ID}" \
    --query "InstanceInformationList[0].{ping:PingStatus,lastPing:LastPingDateTime,agent:AgentVersion,platform:PlatformName}" --output table
  section "SQS"
  local q
  for q in $(aws sqs list-queues --query "QueueUrls[]" --output text 2>/dev/null); do
    [ "$q" = "None" ] && continue
    read_cmd "${q##*/}" aws sqs get-queue-attributes --queue-url "$q" \
      --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible ApproximateNumberOfMessagesDelayed \
      --query "Attributes" --output text
  done
  section "CloudWatch alarms in ALARM"
  read_cmd "alarms" aws cloudwatch describe-alarms --state-value ALARM --query "MetricAlarms[].[AlarmName,StateUpdatedTimestamp]" --output text
}

s3_config() {
  local b
  if [ -z "$(buckets)" ]; then section "S3"; echo "DIAG_S3_BUCKETS is not set"; return; fi
  for b in $(buckets); do
    section "S3 bucket $b"
    read_cmd "region" aws s3api get-bucket-location --bucket "$b" --query LocationConstraint --output text
    read_cmd "block public access" aws s3api get-public-access-block --bucket "$b" --query PublicAccessBlockConfiguration --output json
    read_cmd "policy status" aws s3api get-bucket-policy-status --bucket "$b" --query PolicyStatus --output json
    read_cmd "policy" aws s3api get-bucket-policy --bucket "$b" --query Policy --output text
    read_cmd "object ownership" aws s3api get-bucket-ownership-controls --bucket "$b" --query OwnershipControls --output json
    read_cmd "versioning" aws s3api get-bucket-versioning --bucket "$b" --output json
    read_cmd "encryption" aws s3api get-bucket-encryption --bucket "$b" --query "ServerSideEncryptionConfiguration.Rules[0]" --output json
    read_cmd "CORS rules" aws s3api get-bucket-cors --bucket "$b" --query "length(CORSRules)" --output text
    read_cmd "lifecycle rules" aws s3api get-bucket-lifecycle-configuration --bucket "$b" --query "Rules[].[ID,Status]" --output text
    # Sizes per top-level folder from the first 5,000 keys. Key names are not printed.
    read_cmd "listing summary (first 5000 objects: folder, objects, MB)" bash -c '
      aws s3api list-objects-v2 --bucket "$1" --max-items 5000 --query "Contents[].[Key,Size]" --output text \
      | awk -F"\t" "NF==2 {split(\$1,p,\"/\"); n[p[1]]++; s[p[1]]+=\$2} END {for (k in n) printf \"  %s/ %d %.1f\n\", k, n[k], s[k]/1048576}" \
      | sort' _ "$b"
  done
}

cognito_config() {
  section "Cognito"
  if [ -z "${DIAG_COGNITO_POOL_ID:-}" ]; then echo "DIAG_COGNITO_POOL_ID is not set"; return; fi
  read_cmd "user pool" aws cognito-idp describe-user-pool --user-pool-id "$DIAG_COGNITO_POOL_ID" \
    --query "UserPool.{name:Name,status:Status,estimatedUsers:EstimatedNumberOfUsers,mfa:MfaConfiguration,signUp:AdminCreateUserConfig.AllowAdminCreateUserOnly,passwordMinLength:Policies.PasswordPolicy.MinimumLength,deletionProtection:DeletionProtection}" --output json
  read_cmd "app clients (names only)" aws cognito-idp list-user-pool-clients --user-pool-id "$DIAG_COGNITO_POOL_ID" \
    --query "UserPoolClients[].ClientName" --output text
  read_cmd "groups" aws cognito-idp list-groups --user-pool-id "$DIAG_COGNITO_POOL_ID" \
    --query "Groups[].[GroupName,Precedence]" --output text
}

# ---------------------------------------------------------------------------
# Self-test. Each refusal is checked with a harmless call: a dry run, a name
# that does not exist, or a zero-byte write under diag-selftest/. If IAM
# refuses, the call never reaches the resource; "not found" or "dry run would
# have succeeded" means the permission was granted, which is a FAIL.
# ---------------------------------------------------------------------------
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; RC=1; }

expect_allowed() {
  local label="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then pass "$label"; else fail "$label: $(printf '%s' "$out" | head -1)"; fi
}

expect_denied() {
  local label="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    fail "$label: it SUCCEEDED, so the role is allowed to do it"
  elif printf '%s' "$out" | grep -qE 'AccessDenied|UnauthorizedOperation|not authorized|explicit deny'; then
    pass "$label: refused"
  else
    fail "$label: not refused by IAM ($(printf '%s' "$out" | grep -oE '\(([A-Za-z]+)\)' | head -1 || echo 'unexpected error'))"
  fi
}

self_test() {
  local b key
  section "role"
  local arn
  arn="$(aws sts get-caller-identity --query Arn --output text 2>&1)"
  case "$arn" in
    *":assumed-role/PrimeStudios-ReadOnly-GHA/diag-"*) pass "short-lived session of PrimeStudios-ReadOnly-GHA" ;;
    *) fail "unexpected identity: $arn" ;;
  esac
  section "reads that must work"
  expect_allowed "describe the production instance" aws ec2 describe-instances --instance-ids "$EC2_INSTANCE_ID" --query "Reservations[0].Instances[0].State.Name"
  expect_allowed "describe the database instance" aws rds describe-db-instances --db-instance-identifier "$RDS_INSTANCE_ID" --query "DBInstances[0].DBInstanceStatus"
  expect_allowed "SSM agent status" aws ssm describe-instance-information --filters "Key=InstanceIds,Values=${EC2_INSTANCE_ID}"
  for b in $(buckets); do
    expect_allowed "bucket settings: $b" aws s3api get-public-access-block --bucket "$b"
    expect_allowed "bucket listing: $b" aws s3api list-objects-v2 --bucket "$b" --max-items 1 --query "KeyCount"
  done
  section "writes, secrets and object reads that must be refused"
  b="$(buckets | awk '{print $1}')"
  key="diag-selftest/${GITHUB_RUN_ID:-local}.txt"
  if [ -n "$b" ]; then
    expect_denied "write an object to $b" aws s3api put-object --bucket "$b" --key "$key" --content-length 0
    local first
    first="$(aws s3api list-objects-v2 --bucket "$b" --max-items 1 --query "Contents[0].Key" --output text 2>/dev/null)"
    if [ -n "$first" ] && [ "$first" != "None" ]; then
      expect_denied "read an object's contents from $b" aws s3api get-object --bucket "$b" --key "$first" /dev/null
      expect_denied "read an object's metadata (needs GetObject) from $b" aws s3api head-object --bucket "$b" --key "$first"
    fi
    expect_denied "delete an object in $b" aws s3api delete-object --bucket "$b" --key "$key"
  else
    fail "DIAG_S3_BUCKETS is not set, so the S3 refusals were not tested"
  fi
  expect_denied "read an SSM parameter" aws ssm get-parameter --name /prime/diag-selftest-does-not-exist --with-decryption
  expect_denied "read a Secrets Manager secret" aws secretsmanager get-secret-value --secret-id prime/diag-selftest-does-not-exist
  expect_denied "run an arbitrary shell command (AWS-RunShellScript)" aws ssm send-command --instance-ids "$EC2_INSTANCE_ID" \
    --document-name AWS-RunShellScript --parameters 'commands=["true"]'
  expect_denied "stop the production instance (dry run)" aws ec2 stop-instances --instance-ids "$EC2_INSTANCE_ID" --dry-run
  expect_denied "read the instance's start-up script" aws ec2 describe-instance-attribute --instance-id "$EC2_INSTANCE_ID" --attribute userData
  expect_denied "create a database snapshot" aws rds create-db-snapshot --db-instance-identifier diag-selftest-does-not-exist \
    --db-snapshot-identifier diag-selftest-does-not-exist
  expect_denied "modify the database instance" aws rds modify-db-instance --db-instance-identifier diag-selftest-does-not-exist --backup-retention-period 7
  expect_denied "list IAM users" aws iam list-users --max-items 1
  expect_denied "read Lambda functions (they carry environment variables)" aws lambda list-functions --max-items 1
  if [ -n "${DIAG_COGNITO_POOL_ID:-}" ]; then
    expect_denied "list Cognito users" aws cognito-idp list-users --user-pool-id "$DIAG_COGNITO_POOL_ID" --limit 1
    expect_denied "read an app client (it carries the client secret)" aws cognito-idp describe-user-pool-client \
      --user-pool-id "$DIAG_COGNITO_POOL_ID" --client-id diagselftestdoesnotexist0
  fi
  box self-test
}

echo "# Diagnostics: $CHECK"
echo "run ${GITHUB_RUN_ID:-local}; scripts at ${TARGET_SHA}; $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
case "$CHECK" in
  overview) public_health; aws_infra; box health; box deploy-state; box db ;;
  health) public_health; box health ;;
  deploy-state|app-logs|worker-logs|nginx-logs|db|db-schema|db-counts) box "$CHECK" ;;
  aws-infra) aws_infra ;;
  s3-config) s3_config ;;
  cognito-config) cognito_config ;;
  self-test) self_test ;;
  db-snapshot) snapshot ;;
esac
echo
echo "result: $([ "$RC" = 0 ] && echo ok || echo 'problems found (see FAIL / FAILED lines above)')"
exit "$RC"
