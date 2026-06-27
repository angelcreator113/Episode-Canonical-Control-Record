# GitHub Actions Automatic Deployment Setup

This guide will enable automatic deployments to your EC2 instance when you push to specific branches.

## 🎯 How It Works

Once configured, pushing code will trigger automatic deployments:

- **Push to `dev` branch** → Deploys to dev.primepisodes.com
- **Push to `staging` branch** → Deploys to staging.primepisodes.com (manual trigger)
- **Push to `main` branch** → Deploys to primepisodes.com (manual trigger with confirmation)

## 📋 Prerequisites

You need:
1. SSH access to your EC2 instance
2. The private SSH key used to connect to EC2
3. The EC2 instance public IP or hostname

## 🔑 Step 1: Add GitHub Secrets

Go to your GitHub repository:
https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions

Click **"New repository secret"** and add these two secrets:

### Secret 1: EC2_SSH_KEY

**Name:** `EC2_SSH_KEY`

**Value:** Your EC2 private key (entire contents of your `.pem` file)

```
-----BEGIN RSA PRIVATE KEY-----
[Your full private key contents here]
-----END RSA PRIVATE KEY-----
```

**Where to find it:**
- If you saved your EC2 key as `primepisodes-key.pem`, copy its entire contents
- On Windows: `Get-Content primepisodes-key.pem | clip` (copies to clipboard)
- On Mac/Linux: `cat primepisodes-key.pem | pbcopy`

### Secret 2: EC2_HOST

**Name:** `EC2_HOST`

**Value:** Your EC2 instance public IP or hostname

Example: `54.123.45.67` or `ec2-54-123-45-67.compute-1.amazonaws.com`

**Where to find it:**
```powershell
# Get your EC2 instance public IP
aws ec2 describe-instances `
  --filters "Name=tag:Name,Values=primepisodes-backend" `
  --query 'Reservations[0].Instances[0].PublicIpAddress' `
  --output text
```

## 🚀 Step 2: Test the Setup

Once secrets are added:

### Test Dev Deployment
1. Make a small change to your code
2. Commit and push to `dev` branch:
   ```bash
   git add .
   git commit -m "Test automatic deployment"
   git push origin dev
   ```
3. Go to GitHub Actions tab and watch the deployment
4. Check https://dev.primepisodes.com after completion

### Test Production Deployment
1. Go to GitHub Actions tab
2. Click on **"Deploy to Production"** workflow
3. Click **"Run workflow"**
4. Type: `DEPLOY TO PRODUCTION`
5. Enter reason: `Testing automatic deployment`
6. Click **"Run workflow"**
7. Watch the deployment progress
8. Check https://primepisodes.com after completion

## 📂 File Structure on EC2

The workflows assume this directory structure on your EC2 instance:

```
/home/ubuntu/episode-metadata/
├── src/
├── frontend/
├── package.json
└── ... (your project files)
```

If your project is in a different location, update the `cd` path in the workflow files.

## 🔍 What the Workflows Do

Each deployment workflow:

1. ✅ Runs tests with PostgreSQL
2. ✅ Builds the frontend
3. ✅ Creates deployment artifact
4. ✅ Connects to EC2 via SSH
5. ✅ Pulls latest code from the appropriate branch
6. ✅ Installs dependencies
7. ✅ Builds frontend
8. ✅ Runs database migrations
9. ✅ Restarts PM2 applications
10. ✅ Tests health endpoint

## 🛡️ Security Notes

- **Never commit your private SSH key to the repository**
- GitHub Secrets are encrypted and only accessible to workflows
- The SSH key is written to a temporary file during workflow execution and deleted after
- Only repository admins can view/edit secrets

## 🔧 Troubleshooting

### "Permission denied (publickey)"
- Verify `EC2_SSH_KEY` secret contains the full private key including header/footer
- Ensure the key corresponds to the EC2 instance's authorized_keys
- Check that the EC2 security group allows SSH (port 22) from GitHub Actions IPs

### "Host key verification failed"
- The workflow includes `ssh-keyscan` to automatically add the host to known_hosts
- If issues persist, check your EC2 instance SSH configuration

### "pm2: command not found"
- Ensure PM2 is installed globally on EC2: `npm install -g pm2`
- Make sure it's in the PATH for the ubuntu user

### Deployment succeeds but site doesn't update
- Check PM2 status: `pm2 status`
- Check PM2 logs: `pm2 logs`
- Verify the app is actually running on port 3000
- Check nginx/ALB configuration

## 📊 Monitoring Deployments

### View Deployment History
- Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
- See all deployment runs, logs, and statuses

### Get Notified
- GitHub will email you on failed deployments
- You can add Slack/Discord notifications if needed

## 🎉 You're All Set!

After adding the secrets:

1. **Dev deployments** happen automatically on push to `dev` branch
2. **Staging deployments** can be triggered manually from GitHub Actions
3. **Production deployments** require explicit confirmation and reason

**Current State:**
- ✅ GitHub workflows updated with SSH deployment steps
- ✅ Deployment handled by `.github/scripts/deploy-production.sh` (invoked by `deploy-production.yml`)
- ⏳ Waiting for GitHub secrets to be configured

**Next Step:** Add the two secrets to GitHub, then test a deployment!

---

## 🆘 Quick Reference

### Add GitHub Secrets
1. Go to: `Settings` → `Secrets and variables` → `Actions`
2. Click `New repository secret`
3. Add `EC2_SSH_KEY` and `EC2_HOST`

### Manual Deploy to Production
1. Go to `Actions` tab
2. Select `Deploy to Production`
3. Click `Run workflow`
4. Type exact phrase: `DEPLOY TO PRODUCTION`
5. Enter deployment reason
6. Click `Run workflow`

### Check EC2 Instance
```powershell
# Get EC2 public IP
aws ec2 describe-instances `
  --filters "Name=tag:Name,Values=primepisodes-backend" `
  --query 'Reservations[0].Instances[0].PublicIpAddress' `
  --output text
```

### Connect to EC2
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```
