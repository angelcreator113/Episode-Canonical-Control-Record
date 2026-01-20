# Fix S3 GetObject Permission for Background Removal
# This adds the missing s3:GetObject permission to the IAM user policy

$userName = "episode-metadata-ci-cd"
$bucketName = "episode-metadata-storage-dev"
$policyName = "S3AccessPolicy"

Write-Host "Adding s3:GetObject permission to IAM user..." -ForegroundColor Cyan

# Define the policy with GetObject added - write to file first
$policyJson = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl",
                "s3:GetObjectAcl",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::episode-metadata-storage-dev/*",
                "arn:aws:s3:::episode-metadata-storage-dev"
            ]
        }
    ]
}
"@

# Write policy to temp file
$tempFile = "temp-s3-policy.json"
$policyJson | Out-File -FilePath $tempFile -Encoding UTF8

# Update the policy
try {
    aws iam put-user-policy `
        --user-name $userName `
        --policy-name $policyName `
        --policy-document file://$tempFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully updated IAM policy with s3:GetObject permission" -ForegroundColor Green
        Write-Host ""
        Write-Host "The policy now includes:" -ForegroundColor Yellow
        Write-Host "  - s3:PutObject (upload files)" -ForegroundColor White
        Write-Host "  - s3:GetObject (download files for processing)" -ForegroundColor White
        Write-Host "  - s3:DeleteObject (delete files)" -ForegroundColor White
        Write-Host "  - s3:PutObjectAcl (set file permissions)" -ForegroundColor White
        Write-Host "  - s3:GetObjectAcl (read file permissions)" -ForegroundColor White
        Write-Host "  - s3:ListBucket (list bucket contents)" -ForegroundColor White
        Write-Host ""
        Write-Host "Background removal should now work!" -ForegroundColor Green
        
        # Clean up temp file
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    } else {
        Write-Host "Failed to update policy" -ForegroundColor Red
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}
