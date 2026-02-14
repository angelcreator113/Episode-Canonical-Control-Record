# 🔐 AWS COGNITO USER POOL CONFIGURATION

**Project:** Episode Canonical Control Record  
**Date:** February 4, 2026  
**AWS Region:** us-east-1  
**AWS Account:** 637423256673

---

## 📋 Quick Reference

### Pool IDs
```
DEV Pool ID:     us-east-1_mFVU52978
STAGING Pool ID: us-east-1_jYkqo528H
PROD Pool ID:    us-east-1_643pfiGql
```

### Test Users (All Environments)
```
Username: episode-control-prod
Password: Ayanna123!!

Username: episode-control-dev
Password: Ayanna123!!
```

### Standard Test Users (Created by Setup Script)
```
admin@episodeidentityform.com   → Group: admin
editor@episodeidentityform.com  → Group: editor
viewer@episodeidentityform.com  → Group: viewer
Temporary Password: TempPass123!
```

---

## 🏗️ User Pool Architecture

### Pool Names
```
Development: episode-metadata-users-dev
Staging:     episode-metadata-users-staging
Production:  episode-metadata-users-prod
```

### App Clients
```
Client Name: episode-metadata-api-client-{environment}
Purpose:     Backend API authentication
Auth Flows:  USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH
```

---

## 🔒 Password Policy

All three pools (dev, staging, prod) use the same password policy:

```json
{
  "PasswordPolicy": {
    "MinimumLength": 12,
    "RequireUppercase": true,
    "RequireLowercase": true,
    "RequireNumbers": true,
    "RequireSymbols": true
  }
}
```

### Password Requirements:
- ✅ Minimum 12 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)
- ✅ At least one symbol (!@#$%^&*)

### Valid Password Examples:
```
✅ Ayanna123!!       (12 chars, upper, lower, number, symbol)
✅ TempPass123!      (12 chars, upper, lower, number, symbol)
✅ MyP@ssw0rd123     (13 chars, upper, lower, number, symbol)
✅ SecureKey#789     (13 chars, upper, lower, number, symbol)
```

### Invalid Password Examples:
```
❌ password123!      (no uppercase)
❌ PASSWORD123!      (no lowercase)
❌ Password!!!       (no numbers)
❌ Password123       (no symbols)
❌ Pass123!          (too short - only 8 chars)
```

---

## 👥 User Groups & Permissions

Each user pool has three groups with different permission levels:

### 1. Admin Group
**Description:** Full administrative access  
**Permissions:**
- Create, read, update, delete all resources
- Manage users and groups
- Access all API endpoints
- View audit logs
- Configure system settings

### 2. Editor Group
**Description:** Content creation and editing  
**Permissions:**
- Create and edit episodes, scripts, assets
- Upload files to S3
- Manage wardrobe items
- Cannot delete resources
- Cannot access admin functions

### 3. Viewer Group
**Description:** Read-only access  
**Permissions:**
- View episodes, scripts, assets
- Search and filter content
- Cannot create, edit, or delete
- Cannot upload files

---

## 🔐 Multi-Factor Authentication (MFA)

### Development & Staging
```
MFA Configuration: OPTIONAL
Status: Users can enable MFA but not required
Supported Methods: SMS, TOTP (Authenticator apps)
```

### Production
```
MFA Configuration: REQUIRED
Status: All users MUST enable MFA
Supported Methods: SMS, TOTP (Authenticator apps)
Recommendation: Use TOTP (Google Authenticator, Authy)
```

---

## 🌐 Username Configuration

### Attribute Settings
```
Username Attributes: email
Sign-in Options: Email address only
Email Verification: Required
Case Sensitivity: Case-insensitive
```

Users must sign in using their email address (not a separate username).

---

## 📧 Email Verification

### Settings
```
Verification Method: Email code
Auto-verify: Email addresses
Email Template: AWS Cognito default
Code Expiration: 24 hours
```

### Verification Flow:
1. User signs up with email
2. Verification code sent to email
3. User enters code to verify
4. Account activated

---

## 🔑 Authentication Flows

### Enabled Auth Flows
```
1. USER_PASSWORD_AUTH
   - Traditional username/password authentication
   - Used for API client authentication
   
2. ALLOW_REFRESH_TOKEN_AUTH
   - Refresh access tokens without re-authentication
   - Token refresh with long-lived refresh tokens
```

### Disabled Auth Flows
```
❌ ADMIN_NO_SRP_AUTH (Admin-only, not needed)
❌ USER_SRP_AUTH (SRP not required for API)
❌ CUSTOM_AUTH (No custom auth challenge)
```

---

## 🎫 Token Configuration

### Token Expiration
```
Access Token:  1 hour (3600 seconds)
ID Token:      1 hour (3600 seconds)
Refresh Token: 30 days (2592000 seconds)
```

### Token Claims
```
Standard Claims:
- sub (Unique user ID)
- email
- email_verified
- cognito:username
- cognito:groups (user group memberships)

Custom Claims: (Can be added)
- custom:role
- custom:organization_id
- custom:permissions
```

---

## 📝 User Attributes

### Standard Attributes (Required)
```
email          - User's email address (required)
email_verified - Email verification status
```

### Standard Attributes (Optional)
```
name           - Full name
given_name     - First name
family_name    - Last name
phone_number   - Phone for SMS MFA
```

### Custom Attributes (Available)
```
custom:organization_id  - Organization/tenant ID
custom:role             - Additional role info
custom:preferences      - User preferences JSON
```

---

## 🔄 User Lifecycle Management

### Account States
```
1. CONFIRMED - User verified email, active account
2. UNCONFIRMED - User created but not verified
3. FORCE_CHANGE_PASSWORD - Must change temporary password
4. RESET_REQUIRED - Password reset required
5. DISABLED - Account disabled by admin
```

### Temporary Passwords
```
Initial Password: TempPass123!
Expiration: 7 days
Change Required: Yes (on first sign-in)
```

---

## 🌍 Environment-Specific Configuration

### Development Environment
```
Pool ID: us-east-1_mFVU52978
Pool Name: episode-metadata-users-dev
MFA: OPTIONAL
Test Data: Allowed
User Limit: Unlimited (Cognito free tier)
```

### Staging Environment
```
Pool ID: us-east-1_jYkqo528H
Pool Name: episode-metadata-users-staging
MFA: OPTIONAL
Test Data: Allowed (mirror production)
User Limit: Unlimited (Cognito free tier)
```

### Production Environment
```
Pool ID: us-east-1_643pfiGql
Pool Name: episode-metadata-users-prod
MFA: REQUIRED ⚠️
Test Data: FORBIDDEN
User Limit: Monitored (scale with demand)
```

---

## 🔗 Integration with Application

### Backend Configuration (.env)
```bash
# Development
COGNITO_USER_POOL_ID=us-east-1_mFVU52978
COGNITO_CLIENT_ID=<dev-client-id>
COGNITO_CLIENT_SECRET=<dev-client-secret>
COGNITO_REGION=us-east-1

# Staging
COGNITO_USER_POOL_ID=us-east-1_jYkqo528H
COGNITO_CLIENT_ID=<staging-client-id>
COGNITO_CLIENT_SECRET=<staging-client-secret>
COGNITO_REGION=us-east-1

# Production
COGNITO_USER_POOL_ID=us-east-1_643pfiGql
COGNITO_CLIENT_ID=<prod-client-id>
COGNITO_CLIENT_SECRET=<prod-client-secret>
COGNITO_REGION=us-east-1
```

### Frontend Configuration (.env)
```bash
VITE_COGNITO_USER_POOL_ID=us-east-1_mFVU52978
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_COGNITO_REGION=us-east-1
```

---

## 🧪 Testing Authentication

### Test User Login (PowerShell)
```powershell
# Get authentication token
$auth = aws cognito-idp admin-initiate-auth `
  --user-pool-id us-east-1_mFVU52978 `
  --client-id <CLIENT_ID> `
  --auth-flow ADMIN_NO_SRP_AUTH `
  --auth-parameters USERNAME=episode-control-dev,PASSWORD=Ayanna123!! `
  --region us-east-1 | ConvertFrom-Json

$token = $auth.AuthenticationResult.IdToken

# Test API with token
Invoke-WebRequest -Uri "http://localhost:3002/api/v1/episodes" `
  -Headers @{Authorization = "Bearer $token"} `
  -UseBasicParsing
```

### Test User Login (curl)
```bash
# Get token (requires AWS CLI)
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id us-east-1_mFVU52978 \
  --client-id <CLIENT_ID> \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=episode-control-dev,PASSWORD=Ayanna123!! \
  --region us-east-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3002/api/v1/episodes
```

---

## 📊 User Pool Features

### Enabled Features
- ✅ Email-based username
- ✅ Email verification required
- ✅ Password policy enforcement
- ✅ User groups (admin, editor, viewer)
- ✅ Refresh token rotation
- ✅ MFA support (optional/required)
- ✅ Account recovery via email
- ✅ Temporary passwords
- ✅ Admin user creation
- ✅ Custom attributes support

### Disabled Features
- ❌ Phone number sign-in
- ❌ SMS verification (email only)
- ❌ Social identity providers (Facebook, Google)
- ❌ SAML/OpenID Connect federation
- ❌ Lambda triggers (not configured yet)
- ❌ Risk-based authentication

---

## 🚨 Security Recommendations

### Development
- ✅ Use separate pool from production
- ✅ Test users clearly marked
- ✅ MFA optional for testing ease
- ⚠️ Rotate test credentials monthly

### Staging
- ✅ Mirror production configuration
- ✅ Test MFA flow before prod
- ✅ Use production-like data
- ✅ Monitor authentication metrics

### Production
- ✅ MFA REQUIRED for all users
- ✅ Regular security audits
- ✅ Monitor failed login attempts
- ✅ Enable CloudWatch logging
- ✅ Regular credential rotation
- ✅ Implement account lockout policy
- ⚠️ Never share production credentials

---

## 🛠️ Setup Commands

### Create User Pool (Already Done)
```powershell
# Run the setup script
.\setup-cognito-sqs-secrets.ps1
```

### Add New User (Manual)
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_mFVU52978 \
  --username newuser@example.com \
  --user-attributes Name=email,Value=newuser@example.com Name=name,Value="New User" \
  --temporary-password "TempPass123!" \
  --region us-east-1
```

### Add User to Group
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_mFVU52978 \
  --username newuser@example.com \
  --group-name editor \
  --region us-east-1
```

### List All Users
```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_mFVU52978 \
  --region us-east-1
```

### Delete User
```bash
aws cognito-idp admin-delete-user \
  --user-pool-id us-east-1_mFVU52978 \
  --username user@example.com \
  --region us-east-1
```

---

## 📖 AWS Console Access

### Accessing Cognito in AWS Console
1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **Cognito** service
3. Select **User Pools**
4. Choose environment:
   - `episode-metadata-users-dev`
   - `episode-metadata-users-staging`
   - `episode-metadata-users-prod`

### What You Can Do in Console:
- View all users and their status
- Create/delete users manually
- Reset user passwords
- View user group memberships
- Monitor sign-in activity
- View authentication metrics
- Configure pool settings
- Set up Lambda triggers
- Export user data

---

## 🔍 Monitoring & Metrics

### CloudWatch Metrics (Available)
```
- UserAuthentication (Sign-in attempts)
- UserAuthenticationFailed (Failed sign-ins)
- UserCreated (New user registrations)
- TokenRefresh (Token refresh requests)
- PasswordResetRequested (Password resets)
```

### Recommended Alerts
```
⚠️ Failed Sign-ins > 5 in 5 minutes
⚠️ Password Reset Spike (> 10/hour)
⚠️ New User Creation Spike
⚠️ Token Refresh Failures
```

---

## 📚 Related Documentation

- [PM_FEATURE_STATUS_REPORT.md](PM_FEATURE_STATUS_REPORT.md) - Overall system status
- [PHASE_2_COMPLETION_SUMMARY.md](PHASE_2_COMPLETION_SUMMARY.md) - AWS infrastructure setup
- [setup-cognito-sqs-secrets.ps1](setup-cognito-sqs-secrets.ps1) - Automation script
- [cognito-ids.txt](cognito-ids.txt) - Pool IDs reference
- [cognito-password-policy.json](cognito-password-policy.json) - Password policy JSON

---

## ✅ Completion Checklist

### Initial Setup
- [x] Dev pool created (us-east-1_mFVU52978)
- [x] Staging pool created (us-east-1_jYkqo528H)
- [x] Prod pool created (us-east-1_643pfiGql)
- [x] Password policy configured
- [x] User groups created (admin, editor, viewer)
- [x] Test users created

### Configuration
- [x] Email-based authentication
- [x] MFA optional (dev/staging)
- [x] MFA required (production)
- [x] Auth flows configured
- [x] Token expiration set
- [x] App clients created

### Testing Required
- [ ] Test login with episode-control-dev
- [ ] Test login with episode-control-prod
- [ ] Verify group permissions
- [ ] Test MFA setup (staging)
- [ ] Test MFA enforcement (production)
- [ ] Test token refresh
- [ ] Test password reset flow
- [ ] Verify email verification

### Integration
- [x] Backend .env configured
- [x] Frontend .env configured
- [ ] Test backend authentication
- [ ] Test frontend login UI
- [ ] Verify JWT validation
- [ ] Test protected endpoints
- [ ] Test role-based access

### Production Readiness
- [ ] MFA enforced for all prod users
- [ ] CloudWatch logging enabled
- [ ] Monitoring alerts configured
- [ ] Security audit completed
- [ ] Incident response plan
- [ ] Credential rotation schedule
- [ ] Backup/recovery plan

---

**Created:** February 4, 2026  
**Last Updated:** February 4, 2026  
**Status:** ✅ Pools Configured & Ready for Testing  
**Next Steps:** Test authentication with provided credentials

