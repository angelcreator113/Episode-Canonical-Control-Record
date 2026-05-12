# G5 Phase 4 verification - run immediately post-deploy
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\g5-phase4-postdeploy-verification.ps1

# 4.1 Health check on prod
Write-Output "=== PROD HEALTH CHECK ==="
$health = (Invoke-WebRequest -UseBasicParsing https://primepisodes.com/api/v1/health).Content
Write-Output $health
Write-Output ""

$apiHealth = (Invoke-WebRequest -UseBasicParsing https://api.primepisodes.com/api/v1/health).Content
Write-Output "=== API.PROD HEALTH CHECK ==="
Write-Output $apiHealth
Write-Output ""

# 4.3 Runtime probe matrix on prod
Write-Output "=== RUNTIME PROBES ON PROD ==="

# Probe 1: press.js Tier 3 polymorphic (expect 200)
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method GET https://primepisodes.com/api/v1/press/characters
  Write-Output "Probe 1 (press/characters Tier 3): $($r.StatusCode) - expected 200"
} catch [System.Net.WebException] {
  Write-Output "Probe 1 (press/characters Tier 3): $([int]$_.Exception.Response.StatusCode) - expected 200"
}

# Probe 2: phoneAIRoutes Tier 1 + aiRateLimiter (expect 401)
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method POST https://primepisodes.com/api/v1/ui-overlays/SHOW_ID/ai/add-zones
  Write-Output "Probe 2 (phoneAI Tier 1 + aiRateLimiter): $($r.StatusCode) - expected 401"
} catch [System.Net.WebException] {
  Write-Output "Probe 2 (phoneAI Tier 1 + aiRateLimiter): $([int]$_.Exception.Response.StatusCode) - expected 401"
}

# Probe 3: assets approve Tier 2 admin (expect 401)
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method PUT https://primepisodes.com/api/v1/assets/SOME_UUID/approve
  Write-Output "Probe 3 (assets approve Tier 2): $($r.StatusCode) - expected 401"
} catch [System.Net.WebException] {
  Write-Output "Probe 3 (assets approve Tier 2): $([int]$_.Exception.Response.StatusCode) - expected 401"
}

# Probe 4: beats Tier 1 ADD (expect 401 - CP11 banner closure)
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method GET https://primepisodes.com/api/v1/beats/00000000-0000-0000-0000-000000000000
  Write-Output "Probe 4 (beats Tier 1 ADD): $($r.StatusCode) - expected 401"
} catch [System.Net.WebException] {
  Write-Output "Probe 4 (beats Tier 1 ADD): $([int]$_.Exception.Response.StatusCode) - expected 401"
}

# Probe 5: assets eligible Tier 4 PUBLIC catalog (expect 400 - reaches handler, fails validation)
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method GET https://primepisodes.com/api/v1/assets/eligible
  Write-Output "Probe 5 (assets/eligible Tier 4): $($r.StatusCode) - expected 400"
} catch [System.Net.WebException] {
  Write-Output "Probe 5 (assets/eligible Tier 4): $([int]$_.Exception.Response.StatusCode) - expected 400"
}

# Probe 6: evaluation 5.51 admin escalation (expect 401)
try {
  $r = Invoke-WebRequest -UseBasicParsing -Method POST https://primepisodes.com/api/v1/admin/reset-character-stats
  Write-Output "Probe 6 (evaluation admin 5.51): $($r.StatusCode) - expected 401"
} catch [System.Net.WebException] {
  Write-Output "Probe 6 (evaluation admin 5.51): $([int]$_.Exception.Response.StatusCode) - expected 401"
}

Write-Output ""
Write-Output "=== EXPECTED RESULT MATRIX ==="
Write-Output "Health:     200 healthy on both prod URLs"
Write-Output "Probe 1:    200 (press Tier 3 anonymous reach)"
Write-Output "Probe 2:    401 (Tier 1 + aiRateLimiter)"
Write-Output "Probe 3:    401 (Tier 2 admin)"
Write-Output "Probe 4:    401 (CP11 beats Tier 1 ADD)"
Write-Output "Probe 5:    400 (Tier 4 PUBLIC handler reach + validation)"
Write-Output "Probe 6:    401 (CP12 5.51 escalation)"
