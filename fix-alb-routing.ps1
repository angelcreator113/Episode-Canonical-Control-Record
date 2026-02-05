$env:AWS_DEFAULT_REGION = "us-east-1"
$listenerArn = "arn:aws:elasticloadbalancing:us-east-1:637423256673:listener/app/primepisodes-alb/75ba68945d7aa0bf/3a39b9175d605939"
$backendTg = "arn:aws:elasticloadbalancing:us-east-1:637423256673:targetgroup/primepisodes-backend/44bf124db474bed5"

Write-Host "Getting /assets/* rule..." -ForegroundColor Yellow
$assetsRule = aws elbv2 describe-rules --listener-arn $listenerArn --query "Rules[?Conditions[0].Values[0]==''/assets/*''].RuleArn" --output text

Write-Host "Updating /assets/* rule to backend..." -ForegroundColor Yellow
aws elbv2 modify-rule --rule-arn $assetsRule --actions Type=forward,TargetGroupArn=$backendTg

Write-Host "Getting default rule..." -ForegroundColor Yellow  
$defaultRule = aws elbv2 describe-rules --listener-arn $listenerArn --query "Rules[?Priority==''default''].RuleArn" --output text

Write-Host "Updating default rule to backend..." -ForegroundColor Yellow
aws elbv2 modify-rule --rule-arn $defaultRule --actions Type=forward,TargetGroupArn=$backendTg

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "ALB now routes all traffic to backend server" -ForegroundColor White
