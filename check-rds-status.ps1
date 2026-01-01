#!/usr/bin/env powershell
# Check RDS status and get endpoints when ready

$region = "us-east-1"

Write-Host "`n=== RDS Status Check ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date)" -ForegroundColor Gray

$instances = aws rds describe-db-instances --region $region --query 'DBInstances[?contains(DBInstanceIdentifier, `episode`)].{Name:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}' | ConvertFrom-Json

if ($instances) {
    foreach ($instance in $instances) {
        $statusColor = if ($instance.Status -eq "available") { "Green" } elseif ($instance.Status -eq "creating") { "Yellow" } else { "Red" }
        Write-Host "$($instance.Name): $($instance.Status)" -ForegroundColor $statusColor
        
        if ($instance.Endpoint) {
            Write-Host "  Endpoint: $($instance.Endpoint):$($instance.Port)" -ForegroundColor Gray
        }
    }
    
    # Check if all are available
    $allAvailable = $instances | Where-Object { $_.Status -eq "available" }
    if ($allAvailable.Count -eq $instances.Count) {
        Write-Host "`n✓ All databases are AVAILABLE!" -ForegroundColor Green
        
        # Save endpoints
        Write-Host "`nSaving endpoints to rds-endpoints.txt..." -ForegroundColor Yellow
        $content = "=== RDS ENDPOINTS ==="
        foreach ($instance in $instances) {
            $content += "`n$($instance.Name): $($instance.Endpoint):$($instance.Port)"
        }
        
        Set-Content -Path "rds-endpoints.txt" -Value $content
        Write-Host "Endpoints saved!" -ForegroundColor Green
    } else {
        Write-Host "`n⏳ Waiting for databases to be available..." -ForegroundColor Yellow
        Write-Host "Run this again in 1-2 minutes" -ForegroundColor Gray
    }
} else {
    Write-Host "No episode RDS instances found" -ForegroundColor Red
}
