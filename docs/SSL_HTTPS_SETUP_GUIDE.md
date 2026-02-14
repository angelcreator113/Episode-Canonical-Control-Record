# 🔐 SSL/HTTPS Setup Guide

**Status:** Ready to configure  
**Domain:** www.primepisodes.com (✅ DNS live)  
**Current:** HTTP only  
**Goal:** Enable HTTPS with SSL certificate

---

## 🎯 Overview

Your API is currently accessible via HTTP. This guide covers three approaches to enable HTTPS:

1. **Option A (Recommended):** Use AWS Console to request ACM certificate → Nginx HTTPS
2. **Option B:** Self-signed certificate (for testing/staging)
3. **Option C:** Use AWS Application Load Balancer (ALB) with auto SSL

---

## ✅ Prerequisites Check

```powershell
# Verify DNS is working
nslookup www.primepisodes.com
# Expected: 52.91.217.230 ✅

# Verify API is accessible
curl http://www.primepisodes.com/api/v1/episodes?limit=1
# Expected: Episode data ✅

# Verify you can SSH to frontend
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230
# Expected: Connection successful ✅
```

---

## 🔧 Option A: ACM Certificate + Nginx (Recommended)

### Step A.1: Request Certificate via AWS Console

Since the IAM user doesn't have ACM permissions, use the AWS Management Console:

1. **Login to AWS Console** → https://console.aws.amazon.com
2. **Navigate** → ACM (Certificate Manager)
3. **Click** "Request a certificate"
4. **Domain names:**
   - Add `primepisodes.com`
   - Add `www.primepisodes.com`
5. **Validation method:** DNS
6. **Click** "Request"

### Step A.2: Create DNS Validation Records

AWS will show CNAME records needed for validation:

1. **Click** "Create records in Route53"
2. **Confirm** - AWS auto-adds CNAME records to your hosted zone
3. **Wait** 5-15 minutes for validation
4. **Check status** - Status changes to "Issued"

⏱️ **Typical timeline:**
- Request: 0 min
- Validation records created: 1 min
- Certificate issued: 5-15 min

### Step A.3: Export Certificate for Nginx

Once certificate is "Issued", export it:

```bash
# SSH to frontend
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230

# Export certificate (requires ACM export permissions - may need console method)
aws acm export-certificate \
  --certificate-arn arn:aws:acm:us-east-1:637423256673:certificate/XXXXX \
  --passphrase $(openssl rand -base64 32) \
  --region us-east-1 > /tmp/cert.json

# OR manually download from AWS Console → ACM → Certificate → Download
# Save as: primepisodes.crt and primepisodes.key
```

### Step A.4: Configure Nginx for HTTPS

SSH to frontend and update Nginx:

```bash
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230

# Update Nginx config
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
    
    # Catch-all for backend
    location / {
        proxy_pass http://3.94.166.174:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Verify it's running
sudo systemctl status nginx
```

### Step A.5: Verify HTTPS Works

```bash
# From your local machine
curl -I https://www.primepisodes.com/api/v1/episodes
# Expected: HTTP/1.1 200 OK with valid SSL certificate

# Get full response
curl https://www.primepisodes.com/api/v1/episodes?limit=1
# Expected: Episode data over HTTPS

# Open in browser
# https://www.primepisodes.com/api/v1/episodes
```

---

## 🔧 Option B: Self-Signed Certificate (Testing/Staging)

Use this for testing HTTPS before getting an ACM certificate.

### Step B.1: Create Self-Signed Certificate

```bash
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230

# Create certificate valid for 365 days
sudo mkdir -p /etc/ssl/private
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/primepisodes.key \
  -out /etc/ssl/certs/primepisodes.crt \
  -subj "/C=US/ST=CA/L=San Francisco/O=Prime Studios/CN=primepisodes.com"

# Verify certificate
sudo openssl x509 -in /etc/ssl/certs/primepisodes.crt -text -noout
```

### Step B.2: Configure Nginx (Same as Step A.4)

Use the same Nginx configuration as Option A above.

### Step B.3: Test

```bash
# Test (ignore certificate warning - it's self-signed)
curl -k https://www.primepisodes.com/api/v1/episodes?limit=1
# -k flag ignores self-signed certificate warnings
```

**Limitations:**
- ⚠️ Browsers will show "Not Secure" warning
- ✅ API calls work fine
- ✅ Good for testing/staging
- ❌ Not suitable for production

---

## 🔧 Option C: AWS Application Load Balancer (ALB)

### Advantages
- ✅ Automatic SSL termination
- ✅ Built-in health checks
- ✅ Auto-scaling ready
- ✅ CloudWatch integration
- ✅ High availability

### Step C.1: Create ALB

```bash
# Get your VPC ID and subnet IDs
aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table

# Create load balancer
aws elbv2 create-load-balancer \
  --name primepisodes-alb \
  --subnets subnet-XXXXX subnet-YYYYY \
  --security-groups sg-XXXXX \
  --scheme internet-facing \
  --type application

# Get load balancer ARN from output
# arn:aws:elasticloadbalancing:us-east-1:637423256673:loadbalancer/app/primepisodes-alb/XXXXX
```

### Step C.2: Create Target Group

```bash
aws elbv2 create-target-group \
  --name primepisodes-backend \
  --protocol HTTP \
  --port 3002 \
  --vpc-id vpc-XXXXX \
  --health-check-protocol HTTP \
  --health-check-path /api/v1/episodes \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2

# Get target group ARN from output
```

### Step C.3: Register Backend Instance

```bash
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:637423256673:targetgroup/primepisodes-backend/XXXXX \
  --targets Id=i-02ae7608c531db485,Port=3002
```

### Step C.4: Create HTTPS Listener (After Certificate is Issued)

```bash
# Get certificate ARN from ACM console
CERT_ARN="arn:aws:acm:us-east-1:637423256673:certificate/XXXXX"
ALB_ARN="arn:aws:elasticloadbalancing:us-east-1:637423256673:loadbalancer/app/primepisodes-alb/XXXXX"
TG_ARN="arn:aws:elasticloadbalancing:us-east-1:637423256673:targetgroup/primepisodes-backend/XXXXX"

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Create HTTP listener to redirect to HTTPS
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,StatusCode=HTTP_301,Port=443}'
```

### Step C.5: Update Route53

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Create alias record pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id Z0315161397ME2HLRQZCN \
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
  }"
```

---

## 📊 Recommendation Summary

| Option | Timeline | Difficulty | Cost | Best For |
|--------|----------|-----------|------|----------|
| **A: ACM + Nginx** | 30 min | Easy | Free | ✅ Production |
| **B: Self-Signed** | 5 min | Very Easy | Free | Testing/Staging |
| **C: ALB** | 1 hour | Medium | $20/mo | High Traffic/HA |

**Recommended for now:** Start with **Option B** (self-signed cert for testing) or **Option A** (ACM for production).

---

## 🧪 Testing & Verification

### Full HTTPS Test

```powershell
# Test API via HTTPS domain
curl https://www.primepisodes.com/api/v1/episodes?limit=1

# Test with certificate validation
curl --cacert /path/to/cert.pem https://www.primepisodes.com/api/v1/episodes

# Browser test
# https://www.primepisodes.com/api/v1/episodes
```

### Certificate Details

```bash
# Check certificate expiration
echo | openssl s_client -servername www.primepisodes.com \
  -connect www.primepisodes.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Expected output:
# notBefore=Jan 13 00:00:00 2026 GMT
# notAfter=Jan 13 23:59:59 2027 GMT
```

### HTTP → HTTPS Redirect

```bash
# Test redirect works
curl -I http://www.primepisodes.com
# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://www.primepisodes.com
```

---

## 🚀 Deployment Checklist

- [ ] Choose HTTPS option (A, B, or C)
- [ ] Request certificate (Option A) or create self-signed (Option B)
- [ ] Update Nginx configuration
- [ ] Test Nginx config: `sudo nginx -t`
- [ ] Restart Nginx: `sudo systemctl restart nginx`
- [ ] Test HTTPS: `curl https://www.primepisodes.com/api/v1/episodes?limit=1`
- [ ] Verify certificate in browser
- [ ] Test HTTP → HTTPS redirect
- [ ] Update documentation
- [ ] Update client applications to use HTTPS
- [ ] Remove direct IP access (optional security step)

---

## ⚠️ Troubleshooting

### Certificate Not Found
```bash
sudo ls -la /etc/ssl/certs/primepisodes.crt
sudo ls -la /etc/ssl/private/primepisodes.key
```

### Nginx Test Failed
```bash
# View detailed error
sudo nginx -T

# Check certificate syntax
sudo openssl x509 -in /etc/ssl/certs/primepisodes.crt -text -noout

# Check key syntax
sudo openssl rsa -in /etc/ssl/private/primepisodes.key -check
```

### Redirect Loop
```bash
# Issue: Check for X-Forwarded-Proto in proxy headers
# Solution: Ensure "X-Forwarded-Proto https" is set in location block
```

### Browser Shows "Not Secure"
- Normal for self-signed certificates
- Use valid ACM certificate for production
- Or add exception in browser (development only)

---

## 📝 Next Steps

1. **Immediate (5 min):** Choose SSL option
2. **Quick (30 min):** Configure and test HTTPS
3. **Monitor (ongoing):** Check certificate expiration dates
4. **Optional:** Set up CloudWatch alerts for certificate expiration

---

**Status:** ✅ Ready to implement  
**Domain Status:** ✅ DNS configured and working  
**API Status:** ✅ HTTP accessible  
**Next:** Choose option and execute setup

