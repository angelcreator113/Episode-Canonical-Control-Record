# Fix S3 Bucket Public Access
$BUCKET = "episode-metadata-storage-dev"

Write-Host "Configuring S3 bucket: $BUCKET" -ForegroundColor Cyan

# Create policy as single line JSON
$policy = "{`"Version`":`"2012-10-17`",`"Statement`":[{`"Sid`":`"PublicRead`",`"Effect`":`"Allow`",`"Principal`":`"*`",`"Action`":`"s3:GetObject`",`"Resource`":`"arn:aws:s3:::$BUCKET/*`"}]}"

# Save to file
Set-Content -Path "policy.json" -Value $policy -NoNewline

Write-Host "Applying policy..." -ForegroundColor Yellow
aws s3api put-bucket-policy --bucket $BUCKET --policy file://policy.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success! Now disable block public access:" -ForegroundColor Green
    Write-Host "aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" -ForegroundColor Gray
}

Remove-Item policy.json -ErrorAction SilentlyContinue
