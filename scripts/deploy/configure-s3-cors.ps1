# Configure CORS for S3 bucket to allow video previews

$corsConfig = @'
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
            "MaxAgeSeconds": 3600
        }
    ]
}
'@

Write-Host "Configuring CORS for episode-metadata-raw-footage-dev bucket..." -ForegroundColor Cyan

# Save CORS config to temporary file
$corsConfig | Out-File -FilePath cors-config.json -Encoding ASCII -NoNewline

# Apply CORS configuration
aws s3api put-bucket-cors --bucket episode-metadata-raw-footage-dev --cors-configuration file://cors-config.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "CORS configuration applied successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to apply CORS configuration" -ForegroundColor Red
}

# Clean up
Remove-Item cors-config.json

Write-Host ""
Write-Host "You can verify CORS configuration with:" -ForegroundColor Yellow
Write-Host "  aws s3api get-bucket-cors --bucket episode-metadata-raw-footage-dev" -ForegroundColor Gray

