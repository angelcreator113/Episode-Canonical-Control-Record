# Deploy Amber AI Assistant files to EC2 dev server
# Usage: .\deploy-amber-to-ec2.ps1

$KEY = "C:\Users\12483\episode-prod-key.pem"
$EC2 = "ubuntu@54.163.229.144"
$REMOTE = "/home/ubuntu/episode-metadata"
$LOCAL = "C:\Users\12483\Projects\Episode-Canonical-Control-Record-1"

Write-Host "=== Deploying Amber AI Assistant to EC2 ===" -ForegroundColor Cyan

# 1. Critical Amber route files
Write-Host "`n[1/7] Amber route files..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\src\routes\amberSessionRoutes.js" "${EC2}:${REMOTE}/src/routes/amberSessionRoutes.js"
scp -i $KEY "$LOCAL\src\routes\amberDiagnosticRoutes.js" "${EC2}:${REMOTE}/src/routes/amberDiagnosticRoutes.js"
scp -i $KEY "$LOCAL\src\routes\franchiseBrainRoutes.js" "${EC2}:${REMOTE}/src/routes/franchiseBrainRoutes.js"
scp -i $KEY "$LOCAL\src\routes\eventGeneratorRoute.js" "${EC2}:${REMOTE}/src/routes/eventGeneratorRoute.js"

# 2. memories.js (contains assistant-command endpoint — the 404 fix)
Write-Host "[2/7] memories.js (assistant-command endpoint)..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\src\routes\memories.js" "${EC2}:${REMOTE}/src/routes/memories.js"

# 3. Amber models
Write-Host "[3/7] Amber model files..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\src\models\AmberFinding.js" "${EC2}:${REMOTE}/src/models/AmberFinding.js"
scp -i $KEY "$LOCAL\src\models\AmberScanRun.js" "${EC2}:${REMOTE}/src/models/AmberScanRun.js"
scp -i $KEY "$LOCAL\src\models\AmberTaskQueue.js" "${EC2}:${REMOTE}/src/models/AmberTaskQueue.js"
scp -i $KEY "$LOCAL\src\models\index.js" "${EC2}:${REMOTE}/src/models/index.js"

# 4. Claude/AI services
Write-Host "[4/7] Claude AI services..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\src\services\claudeService.js" "${EC2}:${REMOTE}/src/services/claudeService.js"

# 5. app.js (route mounting — includes Amber route registration)
Write-Host "[5/7] app.js (route mounting)..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\src\app.js" "${EC2}:${REMOTE}/src/app.js"

# 6. ecosystem.config.js (ELEVENLABS_API_KEY added)
Write-Host "[6/7] ecosystem.config.js..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\ecosystem.config.js" "${EC2}:${REMOTE}/ecosystem.config.js"

# 7. package.json (ensure @anthropic-ai/sdk dependency is listed)
Write-Host "[7/7] package.json..." -ForegroundColor Yellow
scp -i $KEY "$LOCAL\package.json" "${EC2}:${REMOTE}/package.json"

Write-Host "`n=== Files deployed! ===" -ForegroundColor Green
Write-Host "`nNow SSH in and run:" -ForegroundColor Cyan
Write-Host "  ssh -i `"$KEY`" $EC2" -ForegroundColor White
Write-Host "  cd $REMOTE" -ForegroundColor White
Write-Host "  npm install   # install @anthropic-ai/sdk if missing" -ForegroundColor White
Write-Host "  pm2 restart ecosystem.config.js" -ForegroundColor White
