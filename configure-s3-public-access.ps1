# Configure S3 Bucket for Public Read Access and CORS

$BUCKET_NAME = "episode-metadata-storage-dev"
$THUMBNAIL_BUCKET = "episode-metadata-thumbnails-dev"

Write-Host "`nConfiguring S3 Buckets for Web Access`n" -ForegroundColor Cyan

# CORS Configuration
$CORS_CONFIG = @"
{
    "CORSRules": [
        {
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
"@

$CORS_FILE = ".\s3-cors-config.json"
$CORS_CONFIG | Out-File -FilePath $CORS_FILE -Encoding utf8

try {
    Write-Host "1. Setting CORS configuration on $BUCKET_NAME..." -ForegroundColor Yellow
    aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file://$CORS_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: CORS configured" -ForegroundColor Green
    }
    
    Write-Host "`n2. Setting CORS configuration on $THUMBNAIL_BUCKET..." -ForegroundColor Yellow
    aws s3api put-bucket-cors --bucket $THUMBNAIL_BUCKET --cors-configuration file://$CORS_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: CORS configured" -ForegroundColor Green
    }
    
    Write-Host "`n3. Setting public read policy on wardrobe folder..." -ForegroundColor Yellow
    
    $PUBLIC_POLICY = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": [
                "arn:aws:s3:::$BUCKET_NAME/wardrobe/*",
                "arn:aws:s3:::$THUMBNAIL_BUCKET/*"
            ]
        }
    ]
}
"@
    
    $POLICY_FILE = ".\s3-public-policy.json"
    $PUBLIC_POLICY | Out-File -FilePath $POLICY_FILE -Encoding utf8
    
    aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://$POLICY_FILE
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: Public read access configured" -ForegroundColor Green
    }
    
    Write-Host "`n4. Disabling block public access..." -ForegroundColor Yellow
    aws s3api put-public-access-block --bucket $BUCKET_NAME --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCESS: Public access enabled" -ForegroundColor Green
    }
    
    Write-Host "`nSUCCESS! S3 buckets configured for web access" -ForegroundColor Green
    Write-Host "Images should now display in your browser" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "`nERROR: $_" -ForegroundColor Red
} finally {
    if (Test-Path $CORS_FILE) { Remove-Item $CORS_FILE -Force }
    if (Test-Path $POLICY_FILE) { Remove-Item $POLICY_FILE -Force }
}
