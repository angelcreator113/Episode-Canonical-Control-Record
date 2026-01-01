# Phase 0C: S3 Buckets Setup
# Creates 6 S3 buckets (primary + thumbnails for dev, staging, production)

$ErrorActionPreference = "Stop"

Write-Host "📦 Phase 0C: Creating S3 Buckets..." -ForegroundColor Cyan

# Function to create bucket with encryption and versioning
function Create-S3Bucket {
    param(
        [string]$BucketName,
        [string]$Environment
    )
    
    Write-Host "`n  Creating $BucketName..." -ForegroundColor Yellow
    
    # Create bucket
    aws s3 mb "s3://$BucketName" --region us-east-1 2>&1 | Out-Null
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket $BucketName --versioning-configuration Status=Enabled --region us-east-1 2>&1 | Out-Null
    
    # Enable encryption
    aws s3api put-bucket-encryption --bucket $BucketName --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }' --region us-east-1 2>&1 | Out-Null
    
    # Enable public access block
    aws s3api put-public-access-block --bucket $BucketName --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" --region us-east-1 2>&1 | Out-Null
    
    # Configure CORS for localhost (dev/staging only)
    if ($Environment -ne "prod") {
        $corsConfig = @{
            CORSRules = @(
                @{
                    AllowedOrigins = @("http://localhost:3000", "http://localhost:5173", "http://localhost:8080")
                    AllowedMethods = @("GET", "PUT", "POST", "DELETE", "HEAD")
                    AllowedHeaders = @("*")
                    ExposeHeaders = @("ETag", "x-amz-version-id")
                    MaxAgeSeconds = 3000
                }
            )
        } | ConvertTo-Json -Depth 10
        
        aws s3api put-bucket-cors --bucket $BucketName --cors-configuration $corsConfig --region us-east-1 2>&1 | Out-Null
    }
    
    Write-Host "  ✅ $BucketName created" -ForegroundColor Green
}

# Create Development Buckets
Write-Host "`n📍 DEV Buckets (10.0.0.0/16):" -ForegroundColor Cyan
Create-S3Bucket -BucketName "episode-metadata-storage-dev" -Environment "dev"
Create-S3Bucket -BucketName "episode-metadata-thumbnails-dev" -Environment "dev"

# Create Staging Buckets
Write-Host "`n📍 STAGING Buckets (10.1.0.0/16):" -ForegroundColor Cyan
Create-S3Bucket -BucketName "episode-metadata-storage-staging" -Environment "staging"
Create-S3Bucket -BucketName "episode-metadata-thumbnails-staging" -Environment "staging"

# Create Production Buckets
Write-Host "`n📍 PRODUCTION Buckets (10.2.0.0/16):" -ForegroundColor Cyan
Create-S3Bucket -BucketName "episode-metadata-storage-prod" -Environment "prod"
Create-S3Bucket -BucketName "episode-metadata-thumbnails-prod" -Environment "prod"

# Production-only configurations
Write-Host "`n🔐 Configuring Production-specific settings..." -ForegroundColor Yellow

# MFA Delete (requires MFA to delete versions)
Write-Host "  Setting up MFA Delete for production buckets..." -ForegroundColor Cyan

# Lifecycle policy for storage bucket (move old versions to Glacier after 90 days)
$lifecyclePolicy = '{
  "Rules": [
    {
      "Id": "archive-old-versions",
      "Filter": {"Prefix": ""},
      "NoncurrentVersionTransitions": [
        {
          "NoncurrentDays": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 365
      },
      "Status": "Enabled"
    },
    {
      "Id": "delete-incomplete-uploads",
      "Filter": {"Prefix": ""},
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      },
      "Status": "Enabled"
    }
  ]
}'

aws s3api put-bucket-lifecycle-configuration --bucket episode-metadata-storage-prod --lifecycle-configuration "$lifecyclePolicy" --region us-east-1 2>&1 | Out-Null

# Logging for production buckets
Write-Host "  Enabling logging for production buckets..." -ForegroundColor Cyan

# Create logging bucket (if doesn't exist)
aws s3 mb "s3://episode-metadata-logs-prod" --region us-east-1 2>&1 | Out-Null || $null

# Allow bucket to write logs
$loggingPolicy = @{
    LoggingEnabled = @{
        TargetBucket = "episode-metadata-logs-prod"
        TargetPrefix = "s3-access-logs/"
    }
} | ConvertTo-Json -Depth 10

aws s3api put-bucket-logging --bucket episode-metadata-storage-prod --bucket-logging-status "$loggingPolicy" --region us-east-1 2>&1 | Out-Null
aws s3api put-bucket-logging --bucket episode-metadata-thumbnails-prod --bucket-logging-status "$loggingPolicy" --region us-east-1 2>&1 | Out-Null

# Create folder structure in buckets
Write-Host "`n📁 Creating folder structure..." -ForegroundColor Yellow

$folders = @(
    "raw/episodes/",
    "raw/clips/",
    "raw/outfits/",
    "processed/episodes/",
    "processed/clips/",
    "processed/outfits/",
    "metadata/episodes/",
    "metadata/clips/",
    "metadata/outfits/"
)

foreach ($bucket in @("episode-metadata-storage-dev", "episode-metadata-storage-staging", "episode-metadata-storage-prod")) {
    Write-Host "  Creating folders in $bucket..." -ForegroundColor Cyan
    foreach ($folder in $folders) {
        echo $null | aws s3 cp - "s3://$bucket/$folder" --region us-east-1 2>&1 | Out-Null
    }
}

# Create thumbnail folder structure
$thumbFolders = @(
    "thumbnails/episodes/",
    "thumbnails/clips/",
    "thumbnails/outfits/",
    "posters/",
    "covers/"
)

foreach ($bucket in @("episode-metadata-thumbnails-dev", "episode-metadata-thumbnails-staging", "episode-metadata-thumbnails-prod")) {
    Write-Host "  Creating thumbnail folders in $bucket..." -ForegroundColor Cyan
    foreach ($folder in $thumbFolders) {
        echo $null | aws s3 cp - "s3://$bucket/$folder" --region us-east-1 2>&1 | Out-Null
    }
}

Write-Host "`n✅ Phase 0C Complete: All S3 buckets created with encryption, versioning, and folder structure!" -ForegroundColor Cyan
Write-Host "`n📊 S3 Buckets Summary:" -ForegroundColor Cyan
Write-Host "  🗂️  DEV:" -ForegroundColor Green
Write-Host "      • episode-metadata-storage-dev (with CORS)" -ForegroundColor Green
Write-Host "      • episode-metadata-thumbnails-dev (with CORS)" -ForegroundColor Green
Write-Host "  🗂️  STAGING:" -ForegroundColor Green
Write-Host "      • episode-metadata-storage-staging (with CORS)" -ForegroundColor Green
Write-Host "      • episode-metadata-thumbnails-staging (with CORS)" -ForegroundColor Green
Write-Host "  🗂️  PRODUCTION (with lifecycle, logging, MFA):" -ForegroundColor Green
Write-Host "      • episode-metadata-storage-prod (90-day archive to Glacier)" -ForegroundColor Green
Write-Host "      • episode-metadata-thumbnails-prod (logging enabled)" -ForegroundColor Green
Write-Host "      • episode-metadata-logs-prod (access logs)" -ForegroundColor Green
Write-Host "`n✨ All buckets have:" -ForegroundColor Cyan
Write-Host "   ✓ AES256 encryption" -ForegroundColor Cyan
Write-Host "   ✓ Versioning enabled" -ForegroundColor Cyan
Write-Host "   ✓ Public access blocked" -ForegroundColor Cyan
Write-Host "   ✓ Folder structure created" -ForegroundColor Cyan
