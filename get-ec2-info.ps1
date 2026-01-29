# Get EC2 Instance Information for Deployment Troubleshooting
# Run this script to find your EC2 instance details

Write-Host "`n🔍 EC2 Instance Finder" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# Try to get EC2 instances in us-east-1
Write-Host "`nSearching for EC2 instances in us-east-1..." -ForegroundColor Yellow

try {
    $instances = aws ec2 describe-instances `
        --region us-east-1 `
        --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress,PrivateIpAddress,State.Name,InstanceType]" `
        --output json | ConvertFrom-Json
    
    if ($instances -and $instances.Count -gt 0) {
        Write-Host "`n✅ Found EC2 Instances:" -ForegroundColor Green
        $flatInstances = $instances | ForEach-Object { $_ } | ForEach-Object { $_ }
        
        $i = 1
        foreach ($instance in $flatInstances) {
            Write-Host "`nInstance $i" -ForegroundColor Cyan
            Write-Host "  Instance ID:    $($instance[0])" -ForegroundColor White
            Write-Host "  Public IP:      $($instance[1])" -ForegroundColor Yellow
            Write-Host "  Private IP:     $($instance[2])" -ForegroundColor White
            Write-Host "  State:          $($instance[3])" -ForegroundColor White
            Write-Host "  Type:           $($instance[4])" -ForegroundColor White
            
            if ($instance[1]) {
                Write-Host "`n  🔑 SSH Command:" -ForegroundColor Green
                Write-Host "     ssh -i YOUR_KEY.pem ubuntu@$($instance[1])" -ForegroundColor Cyan
            }
            $i++
        }
    } else {
        Write-Host "❌ No EC2 instances found" -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Error querying AWS: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nMake sure:" -ForegroundColor Yellow
    Write-Host "  1. AWS CLI is installed: aws --version" -ForegroundColor White
    Write-Host "  2. AWS credentials are configured: aws configure" -ForegroundColor White
    Write-Host "  3. You have permissions to describe EC2 instances" -ForegroundColor White
}

Write-Host "`n" -NoNewline
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Note the Public IP from above" -ForegroundColor White
Write-Host "  2. Find your .pem key file (check Downloads folder)" -ForegroundColor White
Write-Host "  3. Run: ssh -i path\to\key.pem ubuntu@PUBLIC_IP" -ForegroundColor Green
Write-Host "  4. Once connected, run: pm2 logs episode-api" -ForegroundColor Yellow
Write-Host ""
