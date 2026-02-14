# Configure S3 Bucket for Raw Footage Public Read Access and CORS

$BUCKET_NAME = "episode-metadata-raw-footage-dev"

Write-Host "`nConfiguring $BUCKET_NAME for Web Access`n" -ForegroundColor Cyan

# CORS Configuration - Allow localhost for development
$CORS_CONFIG = @"
{
    "CORSRules": [
        {
            "AllowedOrigins": [
                "http://localhost:5174",
                "http://localhost:3000",
                "http://localhost:3002",
                "http://127.0.0.1:5174",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3002"
            ],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
"@

$CORS_FILE = ".\s3-raw-footage-cors-config.json"
$CORS_CONFIG | Out-File -FilePath $CORS_FILE -Encoding utf8

try {
    Write-Host "1. Setting CORS configuration on $BUCKET_NAME..." -ForegroundColor Yellow
    aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file://$CORS_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: CORS configured" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: CORS configuration failed" -ForegroundColor Red
    }
    
    Write-Host "`n2. Setting public read policy on episodes folder..." -ForegroundColor Yellow
    
    $PUBLIC_POLICY = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/episodes/*"
        }
    ]
}
"@
    
    $POLICY_FILE = ".\s3-raw-footage-public-policy.json"
    $PUBLIC_POLICY | Out-File -FilePath $POLICY_FILE -Encoding utf8
    
    aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://$POLICY_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: Public read access configured" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: Public policy configuration failed" -ForegroundColor Red
    }
    
    Write-Host "`n3. Disabling block public access..." -ForegroundColor Yellow
    aws s3api put-public-access-block --bucket $BUCKET_NAME --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: Block public access disabled" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: Failed to disable block public access" -ForegroundColor Red
    }
    
    Write-Host "`n4. Verifying CORS configuration..." -ForegroundColor Yellow
    aws s3api get-bucket-cors --bucket $BUCKET_NAME
    
    Write-Host "`n`nConfiguration Complete!`n" -ForegroundColor Green
    Write-Host "Your raw footage videos should now be accessible from localhost:5174" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    # Clean up temp files
    if (Test-Path $CORS_FILE) { Remove-Item $CORS_FILE }
    if (Test-Path $POLICY_FILE) { Remove-Item $POLICY_FILE }
}
