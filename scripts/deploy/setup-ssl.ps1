# Setup SSL Certificate with AWS Certificate Manager
Write-Host "🔒 Setting up SSL Certificate for primepisodes.com" -ForegroundColor Cyan

# Check if AWS CLI is available
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Download from: https://awscli.amazonaws.com/AWSCLIV2.msi" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n📋 This script will:" -ForegroundColor Yellow
Write-Host "  1. Request SSL certificate for *.primepisodes.com and primepisodes.com" -ForegroundColor Gray
Write-Host "  2. Guide you through DNS validation" -ForegroundColor Gray
Write-Host "  3. Add HTTPS listener to your load balancer" -ForegroundColor Gray

Read-Host "`nPress Enter to continue"

# Step 1: Request certificate
Write-Host "`n🔐 Step 1: Requesting SSL certificate..." -ForegroundColor Cyan

$certArn = aws acm request-certificate `
    --domain-name primepisodes.com `
    --subject-alternative-names "*.primepisodes.com" `
    --validation-method DNS `
    --region us-east-1 `
    --query "CertificateArn" `
    --output text

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($certArn)) {
    Write-Host "❌ Failed to request certificate" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Certificate requested: $certArn" -ForegroundColor Green

# Step 2: Get validation records
Write-Host "`n📝 Step 2: Getting DNS validation records..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

$certDetails = aws acm describe-certificate `
    --certificate-arn $certArn `
    --region us-east-1 `
    --output json | ConvertFrom-Json

Write-Host "`n⚠️  IMPORTANT: Add these DNS records to validate your certificate:" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Gray

foreach ($record in $certDetails.Certificate.DomainValidationOptions) {
    if ($record.ResourceRecord) {
        Write-Host "`nDomain: $($record.DomainName)" -ForegroundColor Cyan
        Write-Host "  Type:  $($record.ResourceRecord.Type)" -ForegroundColor White
        Write-Host "  Name:  $($record.ResourceRecord.Name)" -ForegroundColor White
        Write-Host "  Value: $($record.ResourceRecord.Value)" -ForegroundColor White
    }
}

Write-Host "`n" + ("=" * 80) -ForegroundColor Gray
Write-Host "`n📍 Go to AWS Route 53 console and add these CNAME records:" -ForegroundColor Yellow
Write-Host "   https://console.aws.amazon.com/route53/v2/hostedzones" -ForegroundColor Cyan
Write-Host "`nOr use the Route 53 console in your AWS account to add the validation records." -ForegroundColor Gray

Read-Host "`nPress Enter after you've added the DNS validation records"

# Step 3: Wait for validation
Write-Host "`n⏳ Step 3: Waiting for certificate validation..." -ForegroundColor Cyan
Write-Host "This may take several minutes (up to 30 minutes)" -ForegroundColor Gray

$validated = $false
$maxAttempts = 60
$attempt = 0

while (-not $validated -and $attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "." -NoNewline -ForegroundColor Gray
    
    $status = aws acm describe-certificate `
        --certificate-arn $certArn `
        --region us-east-1 `
        --query "Certificate.Status" `
        --output text
    
    if ($status -eq "ISSUED") {
        $validated = $true
        Write-Host "`n✅ Certificate validated and issued!" -ForegroundColor Green
        break
    }
    
    Start-Sleep -Seconds 30
}

if (-not $validated) {
    Write-Host "`n⚠️  Certificate validation is taking longer than expected." -ForegroundColor Yellow
    Write-Host "Check the ACM console: https://console.aws.amazon.com/acm/home?region=us-east-1" -ForegroundColor Cyan
    Write-Host "`nCertificate ARN: $certArn" -ForegroundColor White
    Write-Host "`nOnce validated, continue with Step 4 to add HTTPS listener" -ForegroundColor Yellow
    exit 0
}

# Step 4: Add HTTPS listener to load balancer
Write-Host "`n🔧 Step 4: Adding HTTPS listener to load balancer..." -ForegroundColor Cyan

# Get load balancer ARN
$lbArn = aws elbv2 describe-load-balancers `
    --region us-east-1 `
    --names "primepisodes-alb" `
    --query "LoadBalancers[0].LoadBalancerArn" `
    --output text

if ([string]::IsNullOrEmpty($lbArn) -or $lbArn -eq "None") {
    Write-Host "❌ Load balancer 'primepisodes-alb' not found" -ForegroundColor Red
    exit 1
}

Write-Host "Found load balancer: $lbArn" -ForegroundColor Gray

# Get target group ARN (backend target group)
$targetGroupArn = aws elbv2 describe-target-groups `
    --region us-east-1 `
    --query "TargetGroups[?contains(TargetGroupName, 'backend')].TargetGroupArn | [0]" `
    --output text

if ([string]::IsNullOrEmpty($targetGroupArn) -or $targetGroupArn -eq "None") {
    Write-Host "❌ Backend target group not found" -ForegroundColor Red
    Write-Host "Please specify the target group ARN manually" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found target group: $targetGroupArn" -ForegroundColor Gray

# Create HTTPS listener
$listenerArn = aws elbv2 create-listener `
    --load-balancer-arn $lbArn `
    --protocol HTTPS `
    --port 443 `
    --certificates CertificateArn=$certArn `
    --default-actions Type=forward,TargetGroupArn=$targetGroupArn `
    --region us-east-1 `
    --query "Listeners[0].ListenerArn" `
    --output text

if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrEmpty($listenerArn)) {
    Write-Host "`n✅ HTTPS listener created successfully!" -ForegroundColor Green
    Write-Host "Listener ARN: $listenerArn" -ForegroundColor Cyan
    Write-Host "`n🎉 SSL Setup Complete!" -ForegroundColor Green
    Write-Host "`nYour sites are now available at:" -ForegroundColor Cyan
    Write-Host "  • https://primepisodes.com" -ForegroundColor White
    Write-Host "  • https://www.primepisodes.com" -ForegroundColor White
    Write-Host "  • https://dev.primepisodes.com" -ForegroundColor White
    Write-Host "  • https://api.primepisodes.com" -ForegroundColor White
} else {
    Write-Host "`n❌ Failed to create HTTPS listener" -ForegroundColor Red
    Write-Host "You may need to create it manually in the AWS Console" -ForegroundColor Yellow
}
