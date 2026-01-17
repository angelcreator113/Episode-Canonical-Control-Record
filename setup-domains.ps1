# Setup DNS records for primepisodes.com domains
# This script creates Route 53 records for dev, staging, and production

Write-Host "🌐 Setting up primepisodes.com domains" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$DOMAIN = "primepisodes.com"
$ALB = "primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com"
$SUBDOMAINS = @("dev", "staging", "www", "api")

# Step 1: Get the hosted zone ID
Write-Host "1. Finding Route 53 hosted zone for $DOMAIN..." -ForegroundColor Yellow
$hostedZones = aws route53 list-hosted-zones --output json | ConvertFrom-Json

$zone = $hostedZones.HostedZones | Where-Object { $_.Name -eq "$DOMAIN." }

if (-not $zone) {
    Write-Host "❌ No hosted zone found for $DOMAIN" -ForegroundColor Red
    Write-Host ""
    Write-Host "To create a hosted zone:" -ForegroundColor Yellow
    Write-Host "  aws route53 create-hosted-zone --name $DOMAIN --caller-reference $(Get-Date -Format 'yyyyMMddHHmmss')" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then update your domain's nameservers at your registrar to point to Route 53" -ForegroundColor Yellow
    exit 1
}

$zoneId = $zone.Id -replace "/hostedzone/", ""
Write-Host "✅ Found hosted zone: $($zone.Name) (ID: $zoneId)" -ForegroundColor Green
Write-Host ""

# Step 2: Get ALB Hosted Zone ID
Write-Host "2. Getting ALB information..." -ForegroundColor Yellow
$albs = aws elbv2 describe-load-balancers --region us-east-1 --output json | ConvertFrom-Json
$alb = $albs.LoadBalancers | Where-Object { $_.DNSName -eq $ALB }

if (-not $alb) {
    Write-Host "❌ Load balancer not found: $ALB" -ForegroundColor Red
    exit 1
}

$albHostedZoneId = $alb.CanonicalHostedZoneId
Write-Host "✅ ALB Hosted Zone ID: $albHostedZoneId" -ForegroundColor Green
Write-Host ""

# Step 3: Create root domain A record (Alias to ALB)
Write-Host "3. Creating root domain record ($DOMAIN)..." -ForegroundColor Yellow

$rootChangeBatch = @{
    Changes = @(
        @{
            Action = "UPSERT"
            ResourceRecordSet = @{
                Name = $DOMAIN
                Type = "A"
                AliasTarget = @{
                    HostedZoneId = $albHostedZoneId
                    DNSName = $ALB
                    EvaluateTargetHealth = $false
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

$rootTempFile = "dns-root-change.json"
$rootChangeBatch | Out-File -FilePath $rootTempFile -Encoding utf8

try {
    aws route53 change-resource-record-sets `
        --hosted-zone-id $zoneId `
        --change-batch file://$rootTempFile | Out-Null
    Write-Host "✅ Created A record (Alias): $DOMAIN → $ALB" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to create root domain record: $_" -ForegroundColor Yellow
}
Remove-Item $rootTempFile -ErrorAction SilentlyContinue
Write-Host ""

# Step 4: Create subdomain A records (Alias to ALB)
Write-Host "4. Creating subdomain records..." -ForegroundColor Yellow

foreach ($subdomain in $SUBDOMAINS) {
    $fullDomain = "$subdomain.$DOMAIN"
    
    $changeBatch = @{
        Changes = @(
            @{
                Action = "UPSERT"
                ResourceRecordSet = @{
                    Name = $fullDomain
                    Type = "A"
                    AliasTarget = @{
                        HostedZoneId = $albHostedZoneId
                        DNSName = $ALB
                        EvaluateTargetHealth = $false
                    }
                }
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $tempFile = "dns-$subdomain-change.json"
    $changeBatch | Out-File -FilePath $tempFile -Encoding utf8
    
    try {
        aws route53 change-resource-record-sets `
            --hosted-zone-id $zoneId `
            --change-batch file://$tempFile | Out-Null
        Write-Host "  ✅ Created A record (Alias): $fullDomain → $ALB" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Failed to create $fullDomain : $_" -ForegroundColor Yellow
    }
    
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ DNS setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "DNS Records Created:" -ForegroundColor Cyan
Write-Host "  • $DOMAIN" -ForegroundColor White
foreach ($subdomain in $SUBDOMAINS) {
    Write-Host "  • $subdomain.$DOMAIN" -ForegroundColor White
}
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 5-10 minutes for DNS propagation" -ForegroundColor White
Write-Host "  2. Set up SSL certificate in ACM (see SSL_SETUP_GUIDE.md)" -ForegroundColor White
Write-Host "  3. Add HTTPS listener to load balancer" -ForegroundColor White
Write-Host "  4. Test domains:" -ForegroundColor White
Write-Host "     • https://primepisodes.com" -ForegroundColor Gray
Write-Host "     • https://dev.primepisodes.com" -ForegroundColor Gray
Write-Host "     • https://staging.primepisodes.com" -ForegroundColor Gray
Write-Host ""
Write-Host "🔍 Check DNS propagation:" -ForegroundColor Yellow
Write-Host "  nslookup primepisodes.com" -ForegroundColor Gray
Write-Host "  nslookup dev.primepisodes.com" -ForegroundColor Gray
Write-Host "  nslookup staging.primepisodes.com" -ForegroundColor Gray
Write-Host ""
