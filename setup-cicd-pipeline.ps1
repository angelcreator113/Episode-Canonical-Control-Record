#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Phase 0J: CI/CD Pipeline Setup
  
.DESCRIPTION
  Sets up:
  - ECR repository for Docker images
  - GitHub Secrets for AWS credentials
  - GitHub Actions workflows
  - Initial CI/CD test pipeline
#>

param(
  [string]$RepoOwner = "angelcreator113",
  [string]$RepoName = "Episode-Canonical-Control-Record",
  [string]$AwsRegion = "us-east-1",
  [string]$CredentialsFile = "./ci-cd-credentials.json"
)

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          PHASE 0J: CI/CD PIPELINE SETUP                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Verify prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Cyan

# Check AWS CLI
$awsVersion = aws --version 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ AWS CLI installed: $($awsVersion -split ' ')[0]" -ForegroundColor Green
} else {
  Write-Host "❌ AWS CLI not installed" -ForegroundColor Red
  exit 1
}

# Check credentials file
if (Test-Path $CredentialsFile) {
  Write-Host "✅ Credentials file found" -ForegroundColor Green
  $credentials = Get-Content $CredentialsFile | ConvertFrom-Json
  $accessKey = $credentials.AccessKeyId
  $secretKey = $credentials.SecretAccessKey
} else {
  Write-Host "❌ Credentials file not found at: $CredentialsFile" -ForegroundColor Red
  exit 1
}

# Check GitHub CLI
$ghVersion = gh --version 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ GitHub CLI installed" -ForegroundColor Green
} else {
  Write-Host "❌ GitHub CLI not installed" -ForegroundColor Red
  exit 1
}

$repo = "$RepoOwner/$RepoName"

# Step 1: Create ECR Repository
Write-Host "`n📍 Step 1/4: Creating ECR Repository..." -ForegroundColor Cyan
$ecrRepoName = "episode-metadata-api"
try {
  $ecrRepo = aws ecr describe-repositories --repository-names $ecrRepoName --region $AwsRegion 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ECR repository already exists: $ecrRepoName" -ForegroundColor Green
  }
} catch {
  Write-Host "Creating new ECR repository..." -ForegroundColor Yellow
  $ecrCreate = aws ecr create-repository `
    --repository-name $ecrRepoName `
    --region $AwsRegion `
    --image-scanning-configuration scanOnPush=true `
    --encryption-configuration encryptionType=AES `
    --tags Key=Project,Value=EpisodeMetadata Key=Environment,Value=shared 2>&1
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ECR repository created: $ecrRepoName" -ForegroundColor Green
    $registryUrl = ($ecrCreate | ConvertFrom-Json).repository.repositoryUri -replace "/[^/]+$", ""
    Write-Host "   Registry: $registryUrl" -ForegroundColor Green
  }
}

# Get ECR registry URL
$registryOutput = aws ecr describe-repositories `
  --repository-names $ecrRepoName `
  --region $AwsRegion `
  --query 'repositories[0].repositoryUri' `
  --output text 2>&1
$registryUrl = $registryOutput -replace "/[^/]+$", ""

Write-Host "`n📍 Step 2/4: Adding GitHub Secrets..." -ForegroundColor Cyan

$secrets = @{
  "AWS_ACCESS_KEY_ID" = $accessKey
  "AWS_SECRET_ACCESS_KEY" = $secretKey
  "AWS_REGION" = $AwsRegion
  "ECR_REGISTRY" = $registryUrl
  "ECR_REPOSITORY" = $ecrRepoName
}

foreach ($secret in $secrets.GetEnumerator()) {
  Write-Host "  Setting secret: $($secret.Key)" -ForegroundColor Cyan
  $value = $secret.Value
  
  # Use gh CLI to set secrets
  $secretOutput = $value | gh secret set $secret.Key --repo $repo 2>&1
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ $($secret.Key) configured" -ForegroundColor Green
  } else {
    Write-Host "  ⚠️ Could not set $($secret.Key): $secretOutput" -ForegroundColor Yellow
  }
}

Write-Host "`n📍 Step 3/4: Configuring GitHub Actions Workflows..." -ForegroundColor Cyan

# Create workflows directory if it doesn't exist
$workflowDir = ".github/workflows"
if (!(Test-Path $workflowDir)) {
  New-Item -ItemType Directory -Path $workflowDir -Force | Out-Null
  Write-Host "  ✅ Created workflow directory" -ForegroundColor Green
}

# Create test CI workflow
$testCiWorkflow = @"
name: Test CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint --if-present
    
    - name: Run tests
      run: npm test --if-present
    
    - name: Check code style
      run: npm run format:check --if-present

  build:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: `${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: `${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: `${{ secrets.AWS_REGION }}
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build Docker image
      env:
        ECR_REGISTRY: `${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: `${{ secrets.ECR_REPOSITORY }}
        IMAGE_TAG: `${{ github.sha }}
      run: |
        docker build -t `$ECR_REGISTRY/`$ECR_REPOSITORY:`$IMAGE_TAG .
        docker tag `$ECR_REGISTRY/`$ECR_REPOSITORY:`$IMAGE_TAG `$ECR_REGISTRY/`$ECR_REPOSITORY:latest
    
    - name: Push to Amazon ECR
      env:
        ECR_REGISTRY: `${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: `${{ secrets.ECR_REPOSITORY }}
        IMAGE_TAG: `${{ github.sha }}
      run: |
        docker push `$ECR_REGISTRY/`$ECR_REPOSITORY:`$IMAGE_TAG
        docker push `$ECR_REGISTRY/`$ECR_REPOSITORY:latest
      if: github.event_name == 'push' && github.ref == 'refs/heads/main'
"@

$testCiPath = Join-Path $workflowDir "test-ci.yml"
Set-Content -Path $testCiPath -Value $testCiWorkflow -Force
Write-Host "  ✅ Created test-ci.yml workflow" -ForegroundColor Green

Write-Host "`n📍 Step 4/4: Summarizing CI/CD Setup..." -ForegroundColor Cyan

Write-Host "`n📊 CI/CD Configuration Summary:" -ForegroundColor Green
Write-Host "  ECR Repository: $ecrRepoName" -ForegroundColor Green
Write-Host "  Registry URL: $registryUrl" -ForegroundColor Green
Write-Host "  Region: $AwsRegion" -ForegroundColor Green
Write-Host "  Workflow Path: $workflowDir/test-ci.yml" -ForegroundColor Green

Write-Host "`n🔐 GitHub Secrets Configured:" -ForegroundColor Green
Write-Host "  • AWS_ACCESS_KEY_ID" -ForegroundColor Green
Write-Host "  • AWS_SECRET_ACCESS_KEY" -ForegroundColor Green
Write-Host "  • AWS_REGION" -ForegroundColor Green
Write-Host "  • ECR_REGISTRY" -ForegroundColor Green
Write-Host "  • ECR_REPOSITORY" -ForegroundColor Green

Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Commit and push the workflow files to GitHub" -ForegroundColor Cyan
Write-Host "     git add .github/workflows/" -ForegroundColor Cyan
Write-Host "     git commit -m 'Add CI/CD pipeline workflows'" -ForegroundColor Cyan
Write-Host "     git push origin develop" -ForegroundColor Cyan
Write-Host "`n  2. Create a test branch and open a PR to trigger CI" -ForegroundColor Cyan
Write-Host "     git checkout -b test/ci-verification" -ForegroundColor Cyan
Write-Host "     git push origin test/ci-verification" -ForegroundColor Cyan
Write-Host "     Open PR on GitHub" -ForegroundColor Cyan
Write-Host "`n  3. Monitor the Actions tab: https://github.com/$repo/actions" -ForegroundColor Cyan

Write-Host "`n✨ Phase 0J CI/CD Pipeline setup complete!`n" -ForegroundColor Green
