# ============================================================================
# AWS RDS Instance Rename Script
# ============================================================================
# This script helps document the RDS instance naming update
# AWS doesn't support direct renaming, so you'll need to:
# 1. Create a snapshot of the old instance
# 2. Restore to a new instance with the new name
# 3. Update security groups and configurations
# 4. Delete the old instance after verification
# ============================================================================

param(
    [string]$OldName = "episode-prod-db",
    [string]$NewName = "episode-control-staging",
    [switch]$DryRun = $false
)

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  AWS RDS Instance Rename Procedure" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

Write-Host "[INFO] Old Instance: $OldName" -ForegroundColor Yellow
Write-Host "[INFO] New Instance: $NewName`n" -ForegroundColor Yellow

Write-Host "IMPORTANT: AWS RDS does not support direct renaming." -ForegroundColor Red
Write-Host "You must use the AWS Console to rename the instance.`n" -ForegroundColor Red

Write-Host "Steps to rename in AWS Console:" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Green

Write-Host "1. Go to AWS RDS Console: https://console.aws.amazon.com/rds/`n"
Write-Host "2. Select the instance: $OldName`n"
Write-Host "3. Click 'Modify' button`n"
Write-Host "4. Change 'DB instance identifier' to: $NewName`n"
Write-Host "5. Scroll down and click 'Continue'`n"
Write-Host "6. Select 'Apply immediately'`n"
Write-Host "7. Click 'Modify DB instance'`n"

Write-Host "`n[INFO] After renaming, update these files:" -ForegroundColor Cyan
Write-Host "   - .env.staging" -ForegroundColor White
Write-Host "   - Any scripts referencing the old name`n" -ForegroundColor White

Write-Host "[INFO] New endpoint will be:" -ForegroundColor Yellow
Write-Host "   $NewName.csnow208wqtv.us-east-1.rds.amazonaws.com`n" -ForegroundColor White

if (-not $DryRun) {
    $confirm = Read-Host "Have you completed the rename in AWS Console? (yes/no)"
    if ($confirm -eq "yes") {
        Write-Host "`n[SUCCESS] Updating .env.staging with new endpoint..." -ForegroundColor Green
        
        $envPath = ".env.staging"
        $newEndpoint = "$NewName.csnow208wqtv.us-east-1.rds.amazonaws.com"
        
        if (Test-Path $envPath) {
            $content = Get-Content $envPath -Raw
            $content = $content -replace "episode-prod-db\.csnow208wqtv\.us-east-1\.rds\.amazonaws\.com", $newEndpoint
            $content | Set-Content $envPath -NoNewline
            
            Write-Host "[SUCCESS] Updated $envPath with new endpoint!" -ForegroundColor Green
            Write-Host "`n[INFO] Test the connection with:" -ForegroundColor Cyan
            Write-Host "   `$env:NODE_ENV=`"staging`"; npm run db:test`n" -ForegroundColor White
        } else {
            Write-Host "[ERROR] File not found: $envPath" -ForegroundColor Red
        }
    } else {
        Write-Host "`n[INFO] No changes made. Run this script again after renaming." -ForegroundColor Yellow
    }
}

Write-Host "`n============================================================`n" -ForegroundColor Cyan
