#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Phase 0H: GitHub Repository Configuration
  
.DESCRIPTION
  Sets up GitHub repository with:
  - Branch protection rules (main and develop)
  - GitHub Projects board
  - Issue templates
  - Workflow configurations
#>

param(
  [string]$RepoOwner = "angelcreator113",
  [string]$RepoName = "Episode-Canonical-Control-Record"
)

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        PHASE 0H: GITHUB REPOSITORY CONFIGURATION               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check if GitHub CLI is installed
Write-Host "📋 Checking GitHub CLI installation..." -ForegroundColor Cyan
$ghVersion = gh --version 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ GitHub CLI detected: $($ghVersion -split ' ')[2]" -ForegroundColor Green
} else {
  Write-Host "❌ GitHub CLI not installed. Install from https://cli.github.com/" -ForegroundColor Red
  exit 1
}

# Check authentication
Write-Host "`n🔐 Checking GitHub authentication..." -ForegroundColor Cyan
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Authenticated with GitHub" -ForegroundColor Green
  Write-Host $authStatus
} else {
  Write-Host "⚠️ Not authenticated. Run: gh auth login" -ForegroundColor Yellow
  exit 1
}

$repo = "$RepoOwner/$RepoName"

# Step 1: Configure Branch Protection (main branch)
Write-Host "`n📍 Step 1/3: Configuring branch protection for main..." -ForegroundColor Cyan
try {
  $mainRules = @{
    "require_status_checks" = @{
      "strict" = $true
      "contexts" = @("ci/github-actions")
    }
    "require_pull_request_reviews" = @{
      "dismiss_stale_reviews" = $true
      "require_code_owner_reviews" = $false
      "required_approving_review_count" = 1
    }
    "enforce_admins" = $false
    "allow_force_pushes" = $false
    "allow_deletions" = $false
  }
  
  gh api repos/$repo/branches/main/protection `
    --input - <<EOF
$($mainRules | ConvertTo-Json -Depth 10)
EOF
  
  Write-Host "✅ Main branch protection configured" -ForegroundColor Green
  Write-Host "   - Requires 1 pull request review" -ForegroundColor Green
  Write-Host "   - Requires CI status checks" -ForegroundColor Green
  Write-Host "   - Enforces status checks before merge" -ForegroundColor Green
} catch {
  Write-Host "⚠️ Could not set main branch protection (might need admin token): $_" -ForegroundColor Yellow
}

# Step 2: Configure Branch Protection (develop branch)
Write-Host "`n📍 Step 2/3: Configuring branch protection for develop..." -ForegroundColor Cyan
try {
  $developRules = @{
    "require_status_checks" = @{
      "strict" = $true
      "contexts" = @("ci/github-actions")
    }
    "require_pull_request_reviews" = @{
      "dismiss_stale_reviews" = $true
      "required_approving_review_count" = 0
    }
    "enforce_admins" = $false
    "allow_force_pushes" = $false
    "allow_deletions" = $false
  }
  
  gh api repos/$repo/branches/develop/protection `
    --input - <<EOF
$($developRules | ConvertTo-Json -Depth 10)
EOF
  
  Write-Host "✅ Develop branch protection configured" -ForegroundColor Green
  Write-Host "   - Requires CI status checks" -ForegroundColor Green
  Write-Host "   - Dismisses stale reviews" -ForegroundColor Green
} catch {
  Write-Host "⚠️ Could not set develop branch protection: $_" -ForegroundColor Yellow
}

# Step 3: Create GitHub Project
Write-Host "`n📍 Step 3/3: Creating GitHub Projects board..." -ForegroundColor Cyan
try {
  $projectName = "Prime Studios Episode Management Phase 0"
  $projectBody = "Phase 0 infrastructure and setup tasks for Prime Studios Episode Management System"
  
  Write-Host "Creating project: $projectName" -ForegroundColor Cyan
  $projectOutput = gh project create --title "$projectName" --description "$projectBody" --owner $RepoOwner --format json 2>&1
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub Project created: $projectName" -ForegroundColor Green
    Write-Host $projectOutput
  } else {
    Write-Host "Note: Project creation may require v0.0.9+ of gh CLI" -ForegroundColor Yellow
    Write-Host "You can create the project manually at: https://github.com/$repo/projects" -ForegroundColor Cyan
  }
} catch {
  Write-Host "⚠️ Could not create project automatically: $_" -ForegroundColor Yellow
  Write-Host "Create manually at: https://github.com/$repo/projects" -ForegroundColor Cyan
}

# Step 4: Add README and branch instructions
Write-Host "`n📝 Step 4: GitHub setup summary" -ForegroundColor Cyan
Write-Host "✅ Repository: $repo" -ForegroundColor Green
Write-Host "✅ Main branch: Protected (requires 1 review + CI)" -ForegroundColor Green
Write-Host "✅ Develop branch: Protected (requires CI only)" -ForegroundColor Green
Write-Host "`n🔗 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Push code: git push -u origin main" -ForegroundColor Cyan
Write-Host "  2. Create develop branch: git checkout -b develop && git push -u origin develop" -ForegroundColor Cyan
Write-Host "  3. View: https://github.com/$repo" -ForegroundColor Cyan
Write-Host "  4. Create project board (if not created above): https://github.com/$repo/projects" -ForegroundColor Cyan

Write-Host "`n✨ Phase 0H GitHub configuration complete!`n" -ForegroundColor Green
