# GitHub Secrets Configuration Guide

## 🔐 Required Secrets for GitHub Actions Deployment

This guide explains how to configure GitHub repository secrets for automated deployments.

---

## 📋 Required Secrets List

### **1. Database Configuration**

#### `DATABASE_URL`
- **Description:** PostgreSQL connection string with SSL
- **Format:** `postgresql://username:password@host:port/database?sslmode=require`
- **Example:** `postgresql://postgres:MyPassword@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata?sslmode=require`
- **Where to find:** AWS RDS Console → episode-control-dev → Endpoint

⚠️ **IMPORTANT:** Do NOT include actual password in this file. Use your RDS master password.

---

### **2. AWS Configuration**

#### `AWS_ACCESS_KEY_ID`
- **Description:** AWS IAM access key for S3, SQS, Lambda access
- **Example:** `AKIAZI2LDARQ************` (20 characters)
- **Where to find:** AWS IAM Console → Users → Security credentials → Access keys

#### `AWS_SECRET_ACCESS_KEY`
- **Description:** AWS IAM secret access key (paired with access key ID)
- **Example:** `2j8fR4ZW****************************` (40 characters)
- **Where to find:** AWS IAM Console → Create new access key (shown only once!)

#### `AWS_ACCOUNT_ID`
- **Description:** Your AWS account identifier
- **Value:** `637423256673`
- **Where to find:** AWS Console → Account dropdown (top-right)

---

### **3. Cognito Authentication**

#### `COGNITO_USER_POOL_ID`
- **Description:** User pool ID for authentication
- **Value:** `us-east-1_mFVU52978`
- **Where to find:** AWS Cognito Console → User pools → episode-canonical-control-dev

#### `COGNITO_CLIENT_ID`
- **Description:** App client ID for Cognito
- **Value:** `lgtf3odnar8c456iehqfck1au`
- **Where to find:** AWS Cognito Console → User pools → App integration → App clients

---

### **4. EC2 Deployment**

#### `EC2_HOST`
- **Description:** Public IP address of backend EC2 instance
- **Value:** `54.163.229.144`
- **Where to find:** AWS EC2 Console → Instances → episode-backend → Public IPv4

#### `EC2_SSH_KEY`
- **Description:** Base64-encoded SSH private key (.pem file)
- **How to create:**
  ```powershell
  # If you have the .pem file:
  $pemContent = Get-Content -Path "episode-backend-key.pem" -Raw
  $base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($pemContent))
  $base64 | Set-Content -Path "key-base64.txt"
  ```
- **Where to find:** You should have downloaded this when creating the EC2 instance
  - If lost, you'll need to create a new key pair and update EC2 instance

---

### **5. Application Secrets**

#### `JWT_SECRET`
- **Description:** Secret key for JWT token signing (minimum 32 characters)
- **How to generate:**
  ```powershell
  # Generate a random 64-character secret:
  -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
  ```
- **Example:** `K8s9d2jH4nM7pQ6wE3rT5yU8iO1aS0dF2gH4jK6lZ9xC3vB7nM1q`

#### `SQS_THUMBNAIL_QUEUE_URL` (Optional)
- **Description:** SQS queue URL for thumbnail processing
- **Value:** `https://sqs.us-east-1.amazonaws.com/637423256673/episode-metadata-thumbnail-queue-dev`
- **Where to find:** AWS SQS Console → Queues → episode-metadata-thumbnail-queue-dev

---

## 🚀 How to Add Secrets to GitHub

### **Step 1: Navigate to Repository Settings**

1. Go to your GitHub repository: `https://github.com/angelcreator113/Episode-Canonical-Control-Record`
2. Click **Settings** tab
3. In left sidebar, click **Secrets and variables** → **Actions**

---

### **Step 2: Add Each Secret**

1. Click **New repository secret**
2. Enter the **Name** (exact name from list above)
3. Paste the **Value** (actual secret value)
4. Click **Add secret**

Repeat for all required secrets.

---

### **Step 3: Verify Secrets Are Set**

Run this in your repository settings:

```
Settings → Secrets and variables → Actions
```

You should see these secrets listed (values are hidden):
- ✅ AWS_ACCESS_KEY_ID
- ✅ AWS_ACCOUNT_ID
- ✅ AWS_SECRET_ACCESS_KEY
- ✅ COGNITO_CLIENT_ID
- ✅ COGNITO_USER_POOL_ID
- ✅ DATABASE_URL
- ✅ EC2_HOST
- ✅ EC2_SSH_KEY
- ✅ JWT_SECRET
- ✅ SQS_THUMBNAIL_QUEUE_URL (optional)

---

## ✅ Testing Deployment

After adding all secrets:

1. **Push to dev branch:**
   ```bash
   git push origin dev
   ```

2. **Watch GitHub Actions:**
   - Go to **Actions** tab in GitHub
   - Click on the running workflow
   - Monitor deployment progress

3. **Check deployment logs:**
   - Look for "✅ Deployment successful"
   - Verify health check passes

---

## 🔒 Security Best Practices

### ✅ **DO:**
- Rotate access keys every 90 days
- Use separate AWS IAM users for CI/CD
- Never commit secrets to repository
- Use strong JWT secrets (64+ characters)
- Enable MFA on AWS account

### ❌ **DON'T:**
- Share secrets in chat/email
- Commit .env files to git
- Use production credentials for development
- Reuse secrets across environments

---

## 🆘 Troubleshooting

### **Secret Not Working?**

1. **Check secret name spelling** - must match exactly
2. **Check for extra spaces** - copy/paste can add whitespace
3. **Regenerate and re-add** - secrets can become invalid
4. **Check GitHub Actions logs** - error messages will indicate which secret failed

### **SSH Key Issues?**

If EC2_SSH_KEY doesn't work:

1. **Verify base64 encoding:**
   ```powershell
   # Test decoding:
   $base64 = Get-Content key-base64.txt
   $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
   $decoded | Select-String "BEGIN RSA PRIVATE KEY"
   ```

2. **Check key permissions on EC2:**
   ```bash
   ssh -i ~/.ssh/deploy_key ubuntu@54.163.229.144
   ```

3. **Generate new key pair if needed** and update EC2 instance

---

## 📞 Support

If you encounter issues:

1. Check GitHub Actions logs (Actions tab → Latest workflow run)
2. Check EC2 instance health (AWS Console → EC2 → episode-backend)
3. Verify RDS database is accessible (AWS Console → RDS → episode-control-dev)
4. Review this document for correct secret formats

---

## 🔄 When to Update Secrets

**Update immediately if:**
- AWS credentials are rotated
- Database password changes
- EC2 instance is replaced
- Security breach is suspected

**Update regularly:**
- JWT_SECRET: Every 6 months
- AWS Access Keys: Every 90 days
- Review all secrets: Quarterly

---

## ✅ Quick Checklist

Before first deployment:

- [ ] All 9 required secrets added to GitHub
- [ ] EC2_SSH_KEY properly base64 encoded
- [ ] DATABASE_URL includes `?sslmode=require`
- [ ] JWT_SECRET is at least 32 characters
- [ ] EC2_HOST has correct IP address
- [ ] AWS credentials have necessary permissions
- [ ] .gitignore excludes .env files
- [ ] No secrets in repository code

---

**Last Updated:** February 5, 2026
**Maintained by:** Development Team
**Repository:** https://github.com/angelcreator113/Episode-Canonical-Control-Record
