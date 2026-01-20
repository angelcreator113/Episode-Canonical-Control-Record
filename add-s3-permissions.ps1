# Add S3 Permissions to IAM User
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Adding S3 Permissions to IAM User" -ForegroundColor Cyan
Write-Host ""

$IAM_USER = "episode-metadata-ci-cd"
$POLICY_NAME = "EpisodeMetadataS3Access"

Write-Host "Policy Configuration:" -ForegroundColor Yellow
Write-Host "   IAM User: $IAM_USER"
Write-Host "   Policy Name: $POLICY_NAME"
Write-Host ""

$POLICY_FILE = ".\s3-policy-temp.json"

# Create policy JSON file
@'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ListBuckets",
            "Effect": "Allow",
            "Action": [
                "s3:ListAllMyBuckets",
                "s3:GetBucketLocation"
            ],
            "Resource": "*"
        },
        {
            "Sid": "ManageEpisodeBuckets",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:GetBucketVersioning"
            ],
            "Resource": [
                "arn:aws:s3:::episode-metadata-storage-dev",
                "arn:aws:s3:::episode-metadata-thumbnails-dev"
            ]
        },
        {
            "Sid": "ManageObjects",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl",
                "s3:GetObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::episode-metadata-storage-dev/*",
                "arn:aws:s3:::episode-metadata-thumbnails-dev/*"
            ]
        }
    ]
}
'@ | Out-File -FilePath $POLICY_FILE -Encoding utf8

try {
    Write-Host "Checking for existing policy..." -ForegroundColor Yellow
    
    $checkResult = aws iam get-user-policy --user-name $IAM_USER --policy-name $POLICY_NAME 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Policy exists. Updating..." -ForegroundColor Yellow
    } else {
        Write-Host "Creating new policy..." -ForegroundColor Yellow
    }
    
    # Create or update the policy
    aws iam put-user-policy --user-name $IAM_USER --policy-name $POLICY_NAME --policy-document file://$POLICY_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS! S3 Permissions Added!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The IAM user now has permissions to:" -ForegroundColor White
        Write-Host "  * Upload files to S3 (wardrobe images)" -ForegroundColor Gray
        Write-Host "  * Download files from S3" -ForegroundColor Gray
        Write-Host "  * Delete files from S3" -ForegroundColor Gray
        Write-Host "  * List buckets and objects" -ForegroundColor Gray
        Write-Host ""
        Write-Host "You can now upload wardrobe images!" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Failed to add policy" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  1. Make sure AWS CLI is installed: aws --version" -ForegroundColor Gray
        Write-Host "  2. Check AWS credentials: aws sts get-caller-identity" -ForegroundColor Gray
        Write-Host "  3. You may need admin credentials to modify IAM policies" -ForegroundColor Gray
        Write-Host ""
    }
}
catch {
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}
finally {
    if (Test-Path $POLICY_FILE) {
        Remove-Item $POLICY_FILE -Force
    }
}
