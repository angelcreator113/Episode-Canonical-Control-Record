# 🚀 Phase 2 - Application Load Balancer (ALB) Setup

**Status:** Certificate exported disabled (AWS managed) ✅  
**Solution:** Use ALB which integrates directly with ACM  
**Next:** Deploy ALB with HTTPS

---

## Why ALB Instead of Nginx Manual Setup?

- ✅ ALB integrates directly with ACM certificates (no export needed)
- ✅ Automatic SSL termination
- ✅ High availability across multiple zones
- ✅ Health checks built-in
- ✅ Auto-scaling ready
- ✅ Better performance than single Nginx instance

---

## Phase 2: Option C - ALB Setup (1 hour)

### Step 1: Get Required Information from AWS

Run these commands to gather IDs:

```powershell
$env:AWS_ACCESS_KEY_ID="AKIAZI2LDARQ4MYI6XXY"
$env:AWS_SECRET_ACCESS_KEY="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"
$env:AWS_REGION="us-east-1"

# Get VPC ID
Write-Host "🔍 Getting VPC ID..." -ForegroundColor Cyan
$VPC_ID = aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text
Write-Host "VPC ID: $VPC_ID" -ForegroundColor Green

# Get Subnets (need at least 2 in different zones)
Write-Host "`n🔍 Getting Subnets..." -ForegroundColor Cyan
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table

# Get Security Group ID (for ALB)
Write-Host "`n🔍 Getting Security Groups..." -ForegroundColor Cyan
aws ec2 describe-security-groups --query 'SecurityGroups[0].[GroupId,GroupName]' --output table

# Get Certificate ARN
Write-Host "`n🔍 Getting Certificate ARN..." -ForegroundColor Cyan
aws acm list-certificates --certificate-statuses ISSUED --region us-east-1 --query 'CertificateSummaryList[?DomainName==`primepisodes.com`].CertificateArn' --output text
```

**Save these values:**
- `VPC_ID` = vpc-...
- `SUBNET_1` = subnet-... (zone a)
- `SUBNET_2` = subnet-... (zone b)
- `SECURITY_GROUP` = sg-...
- `CERT_ARN` = arn:aws:acm:...

---

### Step 2: Create Application Load Balancer

```powershell
# Replace with your actual values from Step 1
$VPC_ID = "vpc-XXXXX"
$SUBNET_1 = "subnet-XXXXX"
$SUBNET_2 = "subnet-YYYYY"
$SECURITY_GROUP = "sg-XXXXX"

Write-Host "🔨 Creating Application Load Balancer..." -ForegroundColor Cyan

$albResponse = aws elbv2 create-load-balancer `
  --name primepisodes-alb `
  --subnets $SUBNET_1 $SUBNET_2 `
  --security-groups $SECURITY_GROUP `
  --scheme internet-facing `
  --type application `
  --region us-east-1 | ConvertFrom-Json

$ALB_ARN = $albResponse.LoadBalancers[0].LoadBalancerArn
$ALB_DNS = $albResponse.LoadBalancers[0].DNSName

Write-Host "✅ ALB Created!" -ForegroundColor Green
Write-Host "ALB ARN: $ALB_ARN"
Write-Host "ALB DNS: $ALB_DNS"
```

---

### Step 3: Create Target Group for Backend

```powershell
# Target group for the backend API
Write-Host "`n🎯 Creating Target Group..." -ForegroundColor Cyan

$targetGroupResponse = aws elbv2 create-target-group `
  --name primepisodes-backend `
  --protocol HTTP `
  --port 3002 `
  --vpc-id $VPC_ID `
  --health-check-protocol HTTP `
  --health-check-path /api/v1/episodes `
  --health-check-interval-seconds 30 `
  --health-check-timeout-seconds 5 `
  --healthy-threshold-count 2 `
  --unhealthy-threshold-count 2 `
  --region us-east-1 | ConvertFrom-Json

$TARGET_GROUP_ARN = $targetGroupResponse.TargetGroups[0].TargetGroupArn

Write-Host "✅ Target Group Created!" -ForegroundColor Green
Write-Host "Target Group ARN: $TARGET_GROUP_ARN"
```

---

### Step 4: Register Backend Instance

```powershell
Write-Host "`n📝 Registering Backend Instance..." -ForegroundColor Cyan

aws elbv2 register-targets `
  --target-group-arn $TARGET_GROUP_ARN `
  --targets Id=i-02ae7608c531db485,Port=3002 `
  --region us-east-1

Write-Host "✅ Backend Registered!" -ForegroundColor Green
Write-Host "Instance: i-02ae7608c531db485:3002"
```

---

### Step 5: Create HTTPS Listener (Using ACM Certificate)

```powershell
# Get your certificate ARN from Step 1
$CERT_ARN = "arn:aws:acm:us-east-1:637423256673:certificate/d5b8a137-84a1-4ff8-9ae4-4b4ab546ea46"

Write-Host "`n🔒 Creating HTTPS Listener..." -ForegroundColor Cyan

aws elbv2 create-listener `
  --load-balancer-arn $ALB_ARN `
  --protocol HTTPS `
  --port 443 `
  --certificates CertificateArn=$CERT_ARN `
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN `
  --region us-east-1 | ConvertFrom-Json | ConvertTo-Json -Depth 2

Write-Host "✅ HTTPS Listener Created!" -ForegroundColor Green
```

---

### Step 6: Create HTTP Listener (Redirect to HTTPS)

```powershell
Write-Host "`n↩️  Creating HTTP→HTTPS Redirect Listener..." -ForegroundColor Cyan

aws elbv2 create-listener `
  --load-balancer-arn $ALB_ARN `
  --protocol HTTP `
  --port 80 `
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,StatusCode=HTTP_301,Port=443}' `
  --region us-east-1

Write-Host "✅ HTTP Redirect Listener Created!" -ForegroundColor Green
```

---

### Step 7: Update Route53 to Point to ALB

```powershell
Write-Host "`n🌐 Updating Route53 DNS Records..." -ForegroundColor Cyan

# ALB Hosted Zone ID (us-east-1)
$ALB_ZONE_ID = "Z35SXDOTRQ7X7K"
$ROUTE53_ZONE_ID = "Z0315161397ME2HLRQZCN"

aws route53 change-resource-record-sets `
  --hosted-zone-id $ROUTE53_ZONE_ID `
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"www.primepisodes.com\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"$ALB_ZONE_ID\",
          \"DNSName\": \"$ALB_DNS\",
          \"EvaluateTargetHealth\": true
        }
      }
    }]
  }" `
  --region us-east-1

Write-Host "✅ Route53 Updated!" -ForegroundColor Green
Write-Host "www.primepisodes.com → ALB ($ALB_DNS)"
Write-Host ""
Write-Host "⏳ DNS propagation: 2-5 minutes"
```

---

### Step 8: Verify ALB Health

```powershell
Write-Host "`n🏥 Checking Target Health..." -ForegroundColor Cyan

# Wait a moment for targets to register
Start-Sleep -Seconds 5

$health = aws elbv2 describe-target-health `
  --target-group-arn $TARGET_GROUP_ARN `
  --region us-east-1 | ConvertFrom-Json

$health.TargetHealthDescriptions | ForEach-Object {
  $state = $_.TargetHealth.State
  $reason = $_.TargetHealth.Reason
  Write-Host "Target: $($_.Target.Id):$($_.Target.Port)" -ForegroundColor Cyan
  Write-Host "  State: $state" -ForegroundColor $(if($state -eq 'healthy') {'Green'} else {'Yellow'})
  Write-Host "  Reason: $reason"
}
```

---

### Step 9: Test ALB

**After 5-10 minutes for DNS propagation:**

```powershell
Write-Host "`n🧪 Testing ALB..." -ForegroundColor Cyan

# Test 1: HTTPS via ALB DNS
Write-Host "`n1️⃣  Testing HTTPS (ALB DNS)..." -ForegroundColor Yellow
try {
    $response = curl -s https://$ALB_DNS/api/v1/episodes?limit=1
    Write-Host "✅ HTTPS Working" -ForegroundColor Green
    $response | ConvertFrom-Json | Select-Object -ExpandProperty pagination
} catch {
    Write-Host "❌ HTTPS Failed: $_" -ForegroundColor Red
}

# Test 2: HTTP redirect
Write-Host "`n2️⃣  Testing HTTP→HTTPS Redirect..." -ForegroundColor Yellow
try {
    $redirect = curl -I http://$ALB_DNS 2>&1
    if ($redirect -match "301|307") {
        Write-Host "✅ Redirect Working" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Redirect Failed" -ForegroundColor Red
}

# Test 3: HTTPS via domain (after DNS propagation)
Write-Host "`n3️⃣  Testing HTTPS (Domain)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = curl -s https://www.primepisodes.com/api/v1/episodes?limit=1
    if ($response) {
        Write-Host "✅ Domain HTTPS Working!" -ForegroundColor Green
        $response | ConvertFrom-Json | Select-Object -ExpandProperty pagination
    }
} catch {
    Write-Host "⏳ Domain still propagating..." -ForegroundColor Yellow
}
```

---

## 📊 Complete Test Script

Run this all at once:

```powershell
$env:AWS_ACCESS_KEY_ID="AKIAZI2LDARQ4MYI6XXY"
$env:AWS_SECRET_ACCESS_KEY="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"
$env:AWS_REGION="us-east-1"

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🚀 PHASE 2: ALB SETUP COMPLETE                          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n✅ Your setup includes:" -ForegroundColor Green
Write-Host "  • Application Load Balancer (ALB)"
Write-Host "  • HTTPS with ACM certificate"
Write-Host "  • Auto HTTP→HTTPS redirect"
Write-Host "  • Health checks"
Write-Host "  • DNS routing to ALB"
Write-Host ""
Write-Host "🌐 Access your API:" -ForegroundColor Cyan
Write-Host "  • https://www.primepisodes.com/api/v1/episodes"
Write-Host "  • https://<ALB-DNS>/api/v1/episodes"
Write-Host ""
Write-Host "⏳ Wait 5-10 minutes for full DNS propagation" -ForegroundColor Yellow
```

---

## ✅ Phase 2 Checklist

- [ ] Gathered VPC, Subnets, Security Group, Certificate ARN info
- [ ] Created Application Load Balancer
- [ ] Created Target Group
- [ ] Registered backend instance
- [ ] Created HTTPS listener with ACM certificate
- [ ] Created HTTP redirect listener
- [ ] Updated Route53 to point to ALB
- [ ] Verified target health status
- [ ] Tested HTTPS via ALB DNS
- [ ] Tested HTTPS via domain (after propagation)

---

## 🎉 Success!

Once tests pass, you have:
- ✅ DNS configured (www.primepisodes.com → ALB)
- ✅ HTTPS enabled (ACM certificate)
- ✅ HTTP auto-redirect to HTTPS
- ✅ Auto health checks
- ✅ Production-ready infrastructure

**No more manual certificate management - AWS handles it all!**

