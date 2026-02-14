# Check RDS status

$region = "us-east-1"

Write-Host "Checking RDS status..." -ForegroundColor Cyan

$result = aws rds describe-db-instances --region $region --query "DBInstances[?contains(DBInstanceIdentifier, 'episode')].{Name:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}" 2>&1

Write-Host $result

Write-Host "Wait 5-10 minutes for RDS to become available."
