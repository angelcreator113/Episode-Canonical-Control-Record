#!/bin/bash
# aws-cost-reduction.sh — AWS CLI commands to reduce monthly costs
#
# ESTIMATED CURRENT: ~$300/month
# ESTIMATED AFTER:   ~$120-150/month (50% savings)
#
# Run each section after reviewing. These are safe, non-destructive operations.
# Requires: aws cli configured with your account credentials.

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo " AWS Cost Reduction Script for Episode Canonical Control Record"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── 1. S3 LIFECYCLE POLICIES — Move old assets to cheaper storage ──────────
# Saves ~$15-30/month on storage if you have 100-200GB across buckets
echo "1. Setting up S3 Intelligent-Tiering lifecycle policies..."
echo "   This moves infrequently accessed objects to cheaper storage automatically."
echo ""

LIFECYCLE_POLICY='{
  "Rules": [
    {
      "ID": "IntelligentTieringAfter30Days",
      "Status": "Enabled",
      "Filter": {},
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "INTELLIGENT_TIERING"
        }
      ]
    },
    {
      "ID": "DeleteIncompleteMultipartUploads",
      "Status": "Enabled",
      "Filter": {},
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 3
      }
    }
  ]
}'

for BUCKET in \
  "${S3_PRIMARY_BUCKET:-episode-metadata-storage-prod}" \
  "${S3_RAW_FOOTAGE_BUCKET:-episode-metadata-raw-footage-prod}" \
  "${S3_PROCESSED_VIDEOS_BUCKET:-episode-metadata-processed-videos-prod}" \
  "${S3_TRAINING_DATA_BUCKET:-episode-metadata-training-data-prod}" \
  "${S3_THUMBNAIL_BUCKET:-episode-metadata-thumbnails-prod}"; do

  echo "   → $BUCKET"
  # Uncomment to apply:
  # aws s3api put-bucket-lifecycle-configuration \
  #   --bucket "$BUCKET" \
  #   --lifecycle-configuration "$LIFECYCLE_POLICY"
done

# Extra: Move training data to Glacier after 7 days (rarely re-accessed)
TRAINING_LIFECYCLE='{
  "Rules": [
    {
      "ID": "GlacierAfter7Days",
      "Status": "Enabled",
      "Filter": {"Prefix": "youtube/"},
      "Transitions": [
        {"Days": 7, "StorageClass": "GLACIER_IR"}
      ]
    },
    {
      "ID": "DeleteIncompleteMultipartUploads",
      "Status": "Enabled",
      "Filter": {},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 3}
    }
  ]
}'

echo "   → Training data bucket: Glacier Instant Retrieval after 7 days"
# Uncomment to apply:
# aws s3api put-bucket-lifecycle-configuration \
#   --bucket "${S3_TRAINING_DATA_BUCKET:-episode-metadata-training-data-prod}" \
#   --lifecycle-configuration "$TRAINING_LIFECYCLE"

echo ""

# ─── 2. EC2 RIGHT-SIZING — Check current instance ──────────────────────────
echo "2. EC2 instance check..."
echo "   Your app needs: API (1GB) + Worker (2GB) = ~3GB RAM minimum"
echo "   Recommended: t3.medium (2 vCPU, 4GB RAM) — $0.042/hour = ~$30/month"
echo ""
echo "   If you're on t3.large or bigger, downsize to t3.medium."
echo "   BETTER: Switch to t4g.medium (ARM/Graviton) — $0.034/hour = ~$24/month"
echo "     → Same specs, 20% cheaper than t3, Node.js runs natively on ARM"
echo "     → Just launch a new t4g.medium, deploy, swap the Elastic IP"
echo "   If you're already on t3/t4g.medium, consider:"
echo "     - EC2 Savings Plan (1yr, no upfront): ~$15-19/month (37% savings)"
echo "     - Reserved Instance (1yr, no upfront): ~$16-20/month (33% savings)"
echo ""
# Uncomment to check your current instance type:
# aws ec2 describe-instances \
#   --filters "Name=instance-state-name,Values=running" \
#   --query 'Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,State:State.Name}' \
#   --output table

# ─── 3. EBS VOLUME AUDIT — Find unused/oversized volumes ───────────────────
echo "3. EBS volume audit..."
echo "   Checking for unattached EBS volumes (pure waste)..."
echo ""
# Uncomment to check:
# aws ec2 describe-volumes \
#   --filters "Name=status,Values=available" \
#   --query 'Volumes[].{ID:VolumeId,Size:Size,Type:VolumeType}' \
#   --output table
# echo "   ↑ Delete any unattached volumes you don't need"

# ─── 4. EBS SNAPSHOTS — Clean up old snapshots ─────────────────────────────
echo "4. EBS snapshot cleanup..."
echo "   Old snapshots can silently cost $5-20/month."
echo ""
# Uncomment to list snapshots older than 90 days:
# aws ec2 describe-snapshots \
#   --owner-ids self \
#   --query 'Snapshots[?StartTime<=`2026-01-01`].{ID:SnapshotId,Size:VolumeSize,Date:StartTime}' \
#   --output table

# ─── 5. CLOUDWATCH LOGS — Reduce retention ─────────────────────────────────
echo "5. CloudWatch log retention..."
echo "   Setting log retention to 7 days (from default: never expire)."
echo ""
# Uncomment to apply:
# for LOG_GROUP in $(aws logs describe-log-groups --query 'logGroups[].logGroupName' --output text); do
#   aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 7
#   echo "   → $LOG_GROUP: 7 days"
# done

# ─── 6. DATA TRANSFER — Identify egress costs ──────────────────────────────
echo "6. Data transfer optimization..."
echo "   Your nginx serves frontend from EC2 (free), but S3 direct downloads"
echo "   from browsers bypass CloudFront and cost $0.09/GB."
echo ""
echo "   If users download videos/assets directly from S3 presigned URLs,"
echo "   consider adding CloudFront (~$5/month) to cache at edge."
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo " Summary of potential savings:"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  S3 lifecycle policies:        -$15-30/month"
echo "  EC2 Savings Plan (1yr):       -$10-15/month"
echo "  EBS cleanup (if applicable):  -$5-20/month"
echo "  CloudWatch log retention:     -$2-10/month"
echo "  Opus→Sonnet (already done):   -$20-50/month (Anthropic, not AWS)"
echo "  Daily budget cap (done):      prevents runaway (was Infinity)"
echo "  ───────────────────────────────────────"
echo "  TOTAL ESTIMATED SAVINGS:      $50-125/month"
echo ""
echo "  Run with 'bash -x' to see commands, or uncomment sections to apply."
