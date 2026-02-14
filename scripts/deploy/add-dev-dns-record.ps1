# Add DNS record for dev.episodes.primestudios.dev
Write-Host "🌐 Adding DNS record for dev.episodes.primestudios.dev" -ForegroundColor Cyan

# Step 1: Get the hosted zone ID for primestudios.dev
Write-Host "`n1. Finding Route 53 hosted zone..." -ForegroundColor Yellow
$hostedZones = aws route53 list-hosted-zones --output json | ConvertFrom-Json

$zone = $hostedZones.HostedZones | Where-Object { $_.Name -eq "primestudios.dev." }

if (-not $zone) {
    Write-Host "❌ No hosted zone found for primestudios.dev" -ForegroundColor Red
    Write-Host "Please create a hosted zone first or use your DNS provider's web interface" -ForegroundColor Yellow
    exit 1
}

$zoneId = $zone.Id -replace "/hostedzone/", ""
Write-Host "✅ Found hosted zone: $($zone.Name) ($zoneId)" -ForegroundColor Green

# Step 2: Create the DNS record
Write-Host "`n2. Creating CNAME record..." -ForegroundColor Yellow

$changesBatch = @{
    Changes = @(
        @{
            Action = "UPSERT"
            ResourceRecordSet = @{
                Name = "dev.episodes.primestudios.dev"
                Type = "CNAME"
                TTL = 300
                ResourceRecords = @(
                    @{
                        Value = "primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com"
                    }
                )
            }
        }
    )
} | ConvertTo-Json -Depth 10

# Save to temp file
$tempFile = "dns-change-batch.json"
$changesBatch | Out-File -FilePath $tempFile -Encoding utf8

Write-Host "Creating record with change batch:" -ForegroundColor Gray
Write-Host $changesBatch -ForegroundColor Gray

# Execute the change
$result = aws route53 change-resource-record-sets `
    --hosted-zone-id $zoneId `
    --change-batch file://$tempFile `
    --output json | ConvertFrom-Json

Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($result.ChangeInfo.Status) {
    Write-Host "`n✅ DNS record created successfully!" -ForegroundColor Green
    Write-Host "Status: $($result.ChangeInfo.Status)" -ForegroundColor Cyan
    Write-Host "Change ID: $($result.ChangeInfo.Id)" -ForegroundColor Cyan
    Write-Host "`n⏳ DNS propagation may take a few minutes..." -ForegroundColor Yellow
    Write-Host "`nYour site will be available at: https://dev.episodes.primestudios.dev" -ForegroundColor Green
} else {
    Write-Host "`n❌ Failed to create DNS record" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
}
