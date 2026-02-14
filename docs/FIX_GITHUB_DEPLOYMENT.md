# Fix GitHub Actions Deployment - SSH Target Issue

## Problem
GitHub Actions deployment is failing because it's trying to SSH to an Application Load Balancer (ALB) endpoint:
```
Target: primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com
Connection timed out during banner exchange
```

**Root Cause:** ALBs only handle HTTP/HTTPS traffic routing - they don't accept SSH connections.

## Solution
Update the GitHub repository secret `EC2_HOST` to use the EC2 instance IP instead of the ALB endpoint.

### Step 1: Update GitHub Secret

1. Go to your GitHub repository: https://github.com/angelcreator113/Episode-Canonical-Control-Record
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Find the secret named `EC2_HOST`
4. Click **Update** and change the value from:
   ```
   primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com
   ```
   To:
   ```
   3.94.166.174
   ```
5. Click **Update secret**

### Step 2: Verify Other Required Secrets

Make sure these secrets are also configured:

| Secret Name | Required Value | Purpose |
|------------|----------------|---------|
| `EC2_HOST` | `3.94.166.174` | EC2 instance IP for SSH |
| `EC2_SSH_KEY` | Base64-encoded SSH private key | Authentication for EC2 |
| `AWS_ACCESS_KEY_ID` | Your AWS access key | AWS API access |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | AWS API access |

### Step 3: Get Base64 Encoded SSH Key (if needed)

If `EC2_SSH_KEY` is not set, encode your `episode-prod-key.pem` file:

**On Windows PowerShell:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("episode-prod-key.pem"))
```

**On Linux/Mac:**
```bash
base64 -w 0 episode-prod-key.pem
```

Copy the output and save it as the `EC2_SSH_KEY` secret in GitHub.

### Step 4: Re-run the Workflow

1. Go to **Actions** tab in GitHub
2. Find the failed workflow run
3. Click **Re-run all jobs**

OR push a new commit to trigger deployment:
```bash
git commit --allow-empty -m "Trigger deployment after fixing EC2_HOST secret"
git push origin dev
```

## Why This Happened

The deployment was configured to use the ALB endpoint, which makes sense for HTTP/HTTPS traffic but not for SSH:

- **HTTP/HTTPS Traffic Flow:** Browser → ALB → EC2 (Port 80/443)
- **SSH Connection:** GitHub Actions → EC2 directly (Port 22)

The ALB sits between users and your EC2 instance for web traffic, but deployment scripts must SSH directly to EC2.

## Verification

After updating the secret and re-running, you should see:
```
🚀 Deploying to development environment...
🔄 Deployment attempt 1 of 3...
✅ Deployment successful on attempt 1
✅ Health check passed!
🌐 Site: https://dev.primepisodes.com
```

## Architecture Diagram

```
┌──────────────┐
│   GitHub     │
│   Actions    │
└──────┬───────┘
       │ SSH (port 22)
       │ Target: 3.94.166.174
       ▼
┌──────────────────┐
│   EC2 Instance   │
│  3.94.166.174    │
│                  │
│  - Nginx (80/443)│
│  - Node.js API   │
│  - PM2 Manager   │
└────────▲─────────┘
         │
         │ HTTP/HTTPS
         │
┌────────┴─────────┐
│       ALB        │
│  primepisodes-   │
│  alb-...         │
└────────▲─────────┘
         │
         │ HTTPS
         │
   ┌─────┴──────┐
   │   Users    │
   │ (browsers) │
   └────────────┘
```

## Current Workflow Configuration

The workflow in [.github/workflows/deploy-dev.yml](.github/workflows/deploy-dev.yml) correctly uses:
```yaml
ssh -i ~/.ssh/deploy_key ubuntu@${{ secrets.EC2_HOST }}
```

It just needs the `EC2_HOST` secret to be set to the correct EC2 IP address.
