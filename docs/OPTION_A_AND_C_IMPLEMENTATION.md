# 🚀 HTTPS Setup - Option A + C Implementation Plan

**Goal:** Implement HTTPS with ACM certificate and Nginx (Option A), then set up ALB for high-availability (Option C)

---

## Phase 1: Option A - ACM Certificate + Nginx (30 minutes)

### Step 1: Request ACM Certificate via AWS Console

1. **Open AWS Console:** https://console.aws.amazon.com
2. **Navigate:** Services → Certificate Manager (ACM)
3. **Click:** "Request a certificate" (orange button)
4. **Certificate details:**
   - Certificate type: Request a public certificate ✓
   - Fully qualified domain names:
     - `primepisodes.com`
     - `www.primepisodes.com`
5. **Select validation method:** DNS ✓
6. **Click:** "Request"

### Step 2: Complete DNS Validation (Auto)

1. **Return to Certificates list**
2. **Find your certificate** (status: "Pending validation")
3. **Click on it** to open details
4. **Click:** "Create records in Route53"
5. **Confirm the batch:** Click "Create records"
   - AWS automatically adds CNAME records to your Route53 zone
6. **Wait:** Certificate validation (typically 5-15 minutes)
7. **Check status:** Refresh page → Status changes to "Issued"

⏱️ **Timeline:**
- Step 1-2: 2 min
- Validation: 5-15 min
- Total: ~15 min

---

## Phase 2: Configure Nginx for HTTPS

### Step 3: SSH to Frontend Instance

```powershell
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230
```

### Step 4: Create Nginx Configuration

Once certificate is "Issued", export or obtain the certificate files. AWS provides download option:

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/certs
sudo mkdir -p /etc/ssl/private

# Option A1: If you can download from ACM console
# Download certificate, certificate chain, and private key from ACM
# Then upload to instance:

# Option A2: Or use these paths if certificate is auto-imported
# (AWS often provides these paths directly)
```

**Download from AWS Console:**
1. Go back to ACM → Your certificate
2. Click "Certificate details" tab
3. Download: Certificate (PEM), Certificate chain (PEM), Private key (PEM)
4. Save locally, then SCP to server:

```powershell
# From your local machine
scp -i C:\Users\12483\episode-prod-key.pem `
  C:\path\to\primepisodes.crt `
  ubuntu@52.91.217.230:/tmp/primepisodes.crt

scp -i C:\Users\12483\episode-prod-key.pem `
  C:\path\to\primepisodes.key `
  ubuntu@52.91.217.230:/tmp/primepisodes.key

# Then on server, move to proper location
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230
sudo mv /tmp/primepisodes.crt /etc/ssl/certs/
sudo mv /tmp/primepisodes.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/primepisodes.key
sudo chmod 644 /etc/ssl/certs/primepisodes.crt
```

### Step 5: Update Nginx Configuration

Still on the server:

```bash
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name www.primepisodes.com primepisodes.com;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS - Secure connection
server {
    listen 443 ssl http2;
    server_name www.primepisodes.com primepisodes.com;
    
    # SSL Certificate (from ACM)
    ssl_certificate /etc/ssl/certs/primepisodes.crt;
    ssl_certificate_key /etc/ssl/private/primepisodes.key;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Add security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    
    # API Proxy
    location /api/ {
        proxy_pass http://3.94.166.174:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Catch-all
    location / {
        proxy_pass http://3.94.166.174:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
```

### Step 6: Test & Enable Nginx

```bash
# Test configuration
sudo nginx -t
# Expected: nginx: configuration file test is successful ✓

# Reload Nginx
sudo systemctl reload nginx

# Verify it's running
sudo systemctl status nginx
```

---

## Phase 3: Test HTTPS Works

### Step 7: Verify HTTPS

From your local PowerShell:

```powershell
# Test HTTPS endpoint
curl https://www.primepisodes.com/api/v1/episodes?limit=2

# Should return episode data over HTTPS

# Check certificate details
curl -I https://www.primepisodes.com

# Check redirect works
curl -I http://www.primepisodes.com
# Expected: 301 Moved Permanently → https://www.primepisodes.com
```

---

## Phase 4: Option C - Application Load Balancer Setup (1 hour)

Once HTTPS is working, set up ALB for high-availability.

### Step 8: Get Required Information

```powershell
$env:AWS_ACCESS_KEY_ID="your-access-key-id"
$env:AWS_SECRET_ACCESS_KEY="your-secret-access-key"
$env:AWS_REGION="us-east-1"

# Get VPC ID
aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text
# Expected: vpc-XXXXX

# Get Subnet IDs (need at least 2)
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table

# Get Security Group ID for ALB
aws ec2 describe-security-groups --query 'SecurityGroups[0].GroupId' --output text
# Expected: sg-XXXXX

# Get Certificate ARN (from ACM console or:)
aws acm list-certificates --certificate-statuses ISSUED --region us-east-1
# Copy your primepisodes.com certificate ARN
```

### Step 9: Create Application Load Balancer

```powershell
# Replace values from Step 8
$VPC_ID = "vpc-XXXXX"
$SUBNET_1 = "subnet-XXXXX"
$SUBNET_2 = "subnet-YYYYY"
$SECURITY_GROUP = "sg-XXXXX"

$albResponse = aws elbv2 create-load-balancer `
  --name primepisodes-alb `
  --subnets $SUBNET_1 $SUBNET_2 `
  --security-groups $SECURITY_GROUP `
  --scheme internet-facing `
  --type application `
  --region us-east-1 | ConvertFrom-Json

$ALB_ARN = $albResponse.LoadBalancers[0].LoadBalancerArn
$ALB_DNS = $albResponse.LoadBalancers[0].DNSName

Write-Host "ALB ARN: $ALB_ARN"
Write-Host "ALB DNS: $ALB_DNS"
```

### Step 10: Create Target Group

```powershell
$targetGroupResponse = aws elbv2 create-target-group `
  --name primepisodes-backend `
  --protocol HTTP `
  --port 3002 `
  --vpc-id $VPC_ID `
  --health-check-protocol HTTP `
  --health-check-path /api/v1/episodes `
  --health-check-interval-seconds 30 `
  --healthy-threshold-count 2 `
  --unhealthy-threshold-count 2 `
  --region us-east-1 | ConvertFrom-Json

$TARGET_GROUP_ARN = $targetGroupResponse.TargetGroups[0].TargetGroupArn
Write-Host "Target Group ARN: $TARGET_GROUP_ARN"
```

### Step 11: Register Backend Target

```powershell
aws elbv2 register-targets `
  --target-group-arn $TARGET_GROUP_ARN `
  --targets Id=i-02ae7608c531db485,Port=3002 `
  --region us-east-1

Write-Host "✓ Backend registered with target group"
```

### Step 12: Create HTTPS Listener

```powershell
# Get Certificate ARN from ACM (replace with your actual ARN)
$CERT_ARN = "arn:aws:acm:us-east-1:637423256673:certificate/XXXXX"

# Create HTTPS listener
aws elbv2 create-listener `
  --load-balancer-arn $ALB_ARN `
  --protocol HTTPS `
  --port 443 `
  --certificates CertificateArn=$CERT_ARN `
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN `
  --region us-east-1

Write-Host "✓ HTTPS listener created"

# Create HTTP listener (redirect to HTTPS)
aws elbv2 create-listener `
  --load-balancer-arn $ALB_ARN `
  --protocol HTTP `
  --port 80 `
  --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,StatusCode=HTTP_301,Port=443}" `
  --region us-east-1

Write-Host "✓ HTTP redirect listener created"
```

### Step 13: Update Route53 to Point to ALB

```powershell
# Create alias record pointing to ALB
aws route53 change-resource-record-sets `
  --hosted-zone-id Z0315161397ME2HLRQZCN `
  --change-batch "{
    `"Changes`": [{
      `"Action`": `"UPSERT`",
      `"ResourceRecordSet`": {
        `"Name`": `"www.primepisodes.com`",
        `"Type`": `"A`",
        `"AliasTarget`": {
          `"HostedZoneId`": `"Z35SXDOTRQ7X7K`",
          `"DNSName`": `"$ALB_DNS`",
          `"EvaluateTargetHealth`": true
        }
      }
    }]
  }" `
  --region us-east-1

Write-Host "✓ Route53 updated to point to ALB"
Write-Host "⏳ Changes may take 2-5 minutes to propagate"
```

### Step 14: Verify ALB Setup

```powershell
# Wait 2-3 minutes for changes to propagate

# Test via ALB DNS name
curl https://$ALB_DNS/api/v1/episodes?limit=1

# Test via domain (after propagation)
curl https://www.primepisodes.com/api/v1/episodes?limit=1

# Check ALB health
aws elbv2 describe-target-health `
  --target-group-arn $TARGET_GROUP_ARN `
  --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty TargetHealthDescriptions
```

---

## 📊 Implementation Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Request ACM Certificate | 5 min | ⏳ Ready |
| 2 | DNS Validation | 5-15 min | ⏳ Automatic |
| 3 | Nginx HTTPS Config | 10 min | ⏳ Ready |
| 4 | Test HTTPS | 5 min | ⏳ Ready |
| 5 | Create ALB | 5 min | ⏳ Ready |
| 6 | Create Target Group | 5 min | ⏳ Ready |
| 7 | Register Targets | 2 min | ⏳ Ready |
| 8 | Create Listeners | 5 min | ⏳ Ready |
| 9 | Update Route53 | 2 min | ⏳ Ready |
| 10 | Verify ALB | 5 min | ⏳ Ready |
| **Total** | | **~45-60 min** | |

---

## 🎯 Starting Now - Phase 1 (Option A)

Ready to proceed? Here's what to do:

1. **Open AWS Console** → ACM → Request Certificate
2. **Add domains:**
   - `primepisodes.com`
   - `www.primepisodes.com`
3. **Select DNS validation**
4. **Click "Create records in Route53"** (AWS does this automatically)
5. **Wait for "Issued" status** (5-15 min)

Once certificate is issued, I'll help you:
- Download certificate files
- Configure Nginx with HTTPS
- Test HTTPS works
- Then proceed to ALB setup

**Let me know when your ACM certificate shows "Issued" status, then we'll proceed with Nginx configuration.**

---

## ✅ Current State

- ✓ DNS working (www.primepisodes.com → 52.91.217.230)
- ✓ API accessible via HTTP
- ⏳ ACM certificate pending (request needed)
- ⏳ Nginx HTTPS pending
- ⏳ ALB pending

