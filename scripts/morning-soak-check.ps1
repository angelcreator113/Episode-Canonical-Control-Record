# Morning soak check — read-only PM2 status + recent log dump from prod EC2.
# Used during F-Stats-1 Phase A G6 soak (2026-05-14/15) and Phase A/B G4/G6 soaks per F-Deploy-1 Fix Plan v1.0.
# Requires PROD_KEY_PATH env var pointing to the prod SSH key.

if (-not $env:PROD_KEY_PATH) {
    Write-Error "PROD_KEY_PATH not set. Example: `$env:PROD_KEY_PATH = 'C:\Users\<you>\episode-prod-key.pem'"
    exit 1
}

if (-not (Test-Path $env:PROD_KEY_PATH)) {
    Write-Error "PROD_KEY_PATH points to '$env:PROD_KEY_PATH' but that file doesn't exist."
    exit 1
}

ssh -i "$env:PROD_KEY_PATH" ubuntu@54.163.229.144 'pm2 status && pm2 logs episode-api --lines 20 --nostream'
