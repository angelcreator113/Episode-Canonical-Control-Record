# Create DNS records for primepisodes.com subdomains
Write-Host "🌐 Creating DNS records for primepisodes.com" -ForegroundColor Cyan

$ZONE_ID = "Z0315161397ME2HLRQZCN"
$ALB_DNS = "primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com"
$ALB_ZONE_ID = "Z35SXDOTRQ7X7K"

$domains = @("staging", "dev", "www", "api")

foreach ($subdomain in $domains) {
    $domain = "$subdomain.primepisodes.com"
    
    Write-Host "`nCreating record for $domain..." -ForegroundColor Yellow
    
    # Create change batch JSON with proper formatting
    $json = @"
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$domain",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$ALB_ZONE_ID",
          "DNSName": "$ALB_DNS",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
"@
    
    $tempFile = "dns-change-$subdomain.json"
    $json | Out-File -FilePath $tempFile -Encoding ASCII -NoNewline
    
    try {
        $result = aws route53 change-resource-record-sets `
            --hosted-zone-id $ZONE_ID `
            --change-batch file://$tempFile `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Created: $domain → $ALB_DNS" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Error: $result" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ⚠️  Failed: $_" -ForegroundColor Red
    }
    
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

# Also create root domain if needed
Write-Host "`nCreating root domain record..." -ForegroundColor Yellow
$rootJson = @"
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "primepisodes.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$ALB_ZONE_ID",
          "DNSName": "$ALB_DNS",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
"@

$rootJson | Out-File -FilePath "dns-change-root.json" -Encoding ASCII -NoNewline

try {
    $result = aws route53 change-resource-record-sets `
        --hosted-zone-id $ZONE_ID `
        --change-batch file://dns-change-root.json `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Created: primepisodes.com → $ALB_DNS" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "  ⚠️  Failed: $_" -ForegroundColor Red
}

Remove-Item "dns-change-root.json" -ErrorAction SilentlyContinue

Write-Host "`n✅ DNS record creation complete!" -ForegroundColor Green
Write-Host "`nTest DNS propagation:" -ForegroundColor Cyan
Write-Host "  nslookup primepisodes.com" -ForegroundColor Gray
Write-Host "  nslookup dev.primepisodes.com" -ForegroundColor Gray
Write-Host "  nslookup staging.primepisodes.com" -ForegroundColor Gray
