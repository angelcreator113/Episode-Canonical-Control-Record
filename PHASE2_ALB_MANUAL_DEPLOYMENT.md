# 🎯 ALB Deployment Guide - Manual Setup

**Status:** Ready to deploy ALB  
**IAM Issue:** Current user lacks ALB creation permissions  
**Solution:** Use AWS Console or account with admin access

---

## Option 1: Deploy via AWS Console (Easiest)

### Step 1: Create Application Load Balancer

1. **Go to:** AWS Console → EC2 → Load Balancers
2. **Click:** "Create load balancer"
3. **Select:** Application Load Balancer
4. **Configure:**
   - Name: `primepisodes-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4
5. **Network mapping:**
   - VPC: `vpc-08a2fc23c52f6d542`
   - Subnets: Select `subnet-030b521050d3736e6` (us-east-1b)
6. **Security groups:** Select `sg-0bbe523f9dd31661a` (default)
7. **Click:** "Next"

### Step 2: Configure Listeners

1. **Add listener:**
   - Protocol: `HTTPS`
   - Port: `443`
   - Default action: Forward to target group (we'll create next)
   - Certificate: Select your `primepisodes.com` ACM certificate
2. **Add another listener:**
   - Protocol: `HTTP`
   - Port: `80`
   - Default action: Redirect to HTTPS (443)
3. **Click:** "Next"

### Step 3: Create Target Group

1. **Target type:** Instances
2. **Target group name:** `primepisodes-backend`
3. **Protocol:** HTTP
4. **Port:** `3002`
5. **VPC:** `vpc-08a2fc23c52f6d542`
6. **Health check:**
   - Protocol: HTTP
   - Path: `/api/v1/episodes`
   - Port: 3002
   - Interval: 30 seconds
   - Timeout: 5 seconds
   - Healthy threshold: 2
   - Unhealthy threshold: 2
7. **Click:** "Next"

### Step 4: Register Targets

1. **Available instances:** Select `i-02ae7608c531db485`
2. **Port:** `3002`
3. **Click:** "Include as pending below"
4. **Click:** "Create target group"

### Step 5: Update Route53 DNS

1. **Go to:** Route53 → Hosted zones → `primepisodes.com`
2. **Edit record:** `www.primepisodes.com`
3. **Change to Alias:**
   - Type: A
   - Alias target: Your new ALB (select from dropdown)
   - Evaluate target health: Yes
4. **Save**

### Step 6: Test

```powershell
# Wait 5 minutes for DNS propagation

# Test HTTPS
curl https://www.primepisodes.com/api/v1/episodes?limit=1

# Test HTTP redirect
curl -I http://www.primepisodes.com

# Check ALB DNS
nslookup www.primepisodes.com
```

---

## Option 2: Deploy via PowerShell (Using AWS CLI)

If you have proper IAM credentials with ALB permissions:

```powershell
$env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_KEY"
$env:AWS_REGION = "us-east-1"

# Variables
$VPC_ID = "vpc-08a2fc23c52f6d542"
$SUBNET = "subnet-030b521050d3736e6"
$SECURITY_GROUP = "sg-0bbe523f9dd31661a"
$CERT_ARN = "arn:aws:acm:us-east-1:637423256673:certificate/d5b8a137-84a1-4ff8-9ae4-4b4ab546ea46"
$ROUTE53_ZONE_ID = "Z0315161397ME2HLRQZCN"

# Create ALB
Write-Host "Creating ALB..." -ForegroundColor Cyan
$alb = aws elbv2 create-load-balancer `
  --name primepisodes-alb `
  --subnets $SUBNET `
  --security-groups $SECURITY_GROUP `
  --scheme internet-facing `
  --type application `
  --region us-east-1 | ConvertFrom-Json

$ALB_ARN = $alb.LoadBalancers[0].LoadBalancerArn
$ALB_DNS = $alb.LoadBalancers[0].DNSName

Write-Host "✅ ALB Created"
Write-Host "  ARN: $ALB_ARN"
Write-Host "  DNS: $ALB_DNS"

# Create Target Group
Write-Host "`nCreating Target Group..." -ForegroundColor Cyan
$tg = aws elbv2 create-target-group `
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

$TG_ARN = $tg.TargetGroups[0].TargetGroupArn

Write-Host "✅ Target Group Created"
Write-Host "  ARN: $TG_ARN"

# Register Targets
Write-Host "`nRegistering Backend Instance..." -ForegroundColor Cyan
aws elbv2 register-targets `
  --target-group-arn $TG_ARN `
  --targets Id=i-02ae7608c531db485,Port=3002 `
  --region us-east-1

Write-Host "✅ Backend Registered"

# Create HTTPS Listener
Write-Host "`nCreating HTTPS Listener..." -ForegroundColor Cyan
aws elbv2 create-listener `
  --load-balancer-arn $ALB_ARN `
  --protocol HTTPS `
  --port 443 `
  --certificates CertificateArn=$CERT_ARN `
  --default-actions Type=forward,TargetGroupArn=$TG_ARN `
  --region us-east-1

Write-Host "✅ HTTPS Listener Created"

# Create HTTP Redirect Listener
Write-Host "`nCreating HTTP Redirect Listener..." -ForegroundColor Cyan
aws elbv2 create-listener `
  --load-balancer-arn $ALB_ARN `
  --protocol HTTP `
  --port 80 `
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,StatusCode=HTTP_301,Port=443}' `
  --region us-east-1

Write-Host "✅ HTTP Redirect Listener Created"

# Update Route53
Write-Host "`nUpdating Route53..." -ForegroundColor Cyan
aws route53 change-resource-record-sets `
  --hosted-zone-id $ROUTE53_ZONE_ID `
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"www.primepisodes.com\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"Z35SXDOTRQ7X7K\",
          \"DNSName\": \"$ALB_DNS\",
          \"EvaluateTargetHealth\": true
        }
      }
    }]
  }" `
  --region us-east-1

Write-Host "✅ Route53 Updated"
Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ ALB SETUP COMPLETE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Access your API:"
Write-Host "  • https://www.primepisodes.com/api/v1/episodes"
Write-Host ""
Write-Host "⏳ Wait 5-10 minutes for DNS propagation"
```

---

## Required Information Summary

**For AWS Console or CLI deployment:**

| Item | Value |
|------|-------|
| ALB Name | `primepisodes-alb` |
| VPC | `vpc-08a2fc23c52f6d542` |
| Subnet | `subnet-030b521050d3736e6` |
| Security Group | `sg-0bbe523f9dd31661a` |
| Target Group Name | `primepisodes-backend` |
| Backend Instance | `i-02ae7608c531db485` |
| Backend Port | `3002` |
| Health Check Path | `/api/v1/episodes` |
| Certificate ARN | `arn:aws:acm:us-east-1:637423256673:certificate/d5b8a137-84a1-4ff8-9ae4-4b4ab546ea46` |
| Route53 Zone ID | `Z0315161397ME2HLRQZCN` |
| Domain | `www.primepisodes.com` |

---

## ✅ After Deployment

### Test HTTPS

```powershell
# Wait 5 minutes for DNS to propagate

# Test 1: HTTPS API
curl https://www.primepisodes.com/api/v1/episodes?limit=1
# Expected: Episode data

# Test 2: HTTP Redirect
curl -I http://www.primepisodes.com
# Expected: 301 Moved Permanently → HTTPS

# Test 3: ALB DNS directly
curl https://<ALB-DNS>/api/v1/episodes?limit=1
# Expected: Episode data
```

---

## 📊 Final Architecture

```
User Request
    ↓
Route53 DNS (www.primepisodes.com)
    ↓
Application Load Balancer
    ├─ HTTPS (443) with ACM Certificate ✅
    └─ HTTP (80) → Redirect to HTTPS ✅
    ↓
Target Group (primepisodes-backend)
    ↓
Backend EC2 Instance (i-02ae7608c531db485:3002)
    ↓
API Response (episodes, metadata, etc.)
```

---

## 🎉 Success!

Once deployed, you have:
- ✅ DNS configured (www.primepisodes.com → ALB)
- ✅ HTTPS enabled with ACM certificate
- ✅ Auto HTTP → HTTPS redirect
- ✅ Health checks monitoring backend
- ✅ Production-ready infrastructure

**No manual certificate management needed!**

