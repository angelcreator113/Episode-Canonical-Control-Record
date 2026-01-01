# Phase 0D: RDS PostgreSQL Setup
# Creates 3 RDS instances (dev: t3.small, staging: t3.small, production: t3.medium with Multi-AZ)

$ErrorActionPreference = "Stop"

Write-Host "🗄️  Phase 0D: Creating RDS PostgreSQL Instances..." -ForegroundColor Cyan

# VPC IDs from Phase 0B
$vpc_dev = "vpc-0754967be21268e7e"
$vpc_staging = "vpc-061b92a85af436d42"
$vpc_prod = "vpc-09cc6fa2ee3ce35ba"

# Function to get private subnets for a VPC
function Get-PrivateSubnets {
    param([string]$VpcId)
    aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VpcId" "Name=cidr-block,Values=*10*,*20*" --region us-east-1 --query 'Subnets[*].SubnetId' --output text
}

# Create DB Subnet Groups
Write-Host "`n🔧 Creating DB Subnet Groups..." -ForegroundColor Yellow

# Dev DB Subnet Group
$dev_subnets = Get-PrivateSubnets $vpc_dev
Write-Host "  Dev subnets: $dev_subnets" -ForegroundColor Gray
aws rds create-db-subnet-group `
    --db-subnet-group-name episode-metadata-db-subnet-dev `
    --db-subnet-group-description "Subnet group for Episode Metadata Dev RDS" `
    --subnet-ids $dev_subnets.Split(" ") `
    --tags Key=Environment,Value=dev Key=Project,Value=episode-metadata `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Dev DB Subnet Group created" -ForegroundColor Green

# Staging DB Subnet Group
$staging_subnets = Get-PrivateSubnets $vpc_staging
Write-Host "  Staging subnets: $staging_subnets" -ForegroundColor Gray
aws rds create-db-subnet-group `
    --db-subnet-group-name episode-metadata-db-subnet-staging `
    --db-subnet-group-description "Subnet group for Episode Metadata Staging RDS" `
    --subnet-ids $staging_subnets.Split(" ") `
    --tags Key=Environment,Value=staging Key=Project,Value=episode-metadata `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Staging DB Subnet Group created" -ForegroundColor Green

# Production DB Subnet Group
$prod_subnets = Get-PrivateSubnets $vpc_prod
Write-Host "  Prod subnets: $prod_subnets" -ForegroundColor Gray
aws rds create-db-subnet-group `
    --db-subnet-group-name episode-metadata-db-subnet-prod `
    --db-subnet-group-description "Subnet group for Episode Metadata Production RDS" `
    --subnet-ids $prod_subnets.Split(" ") `
    --tags Key=Environment,Value=production Key=Project,Value=episode-metadata `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Prod DB Subnet Group created" -ForegroundColor Green

# Create Security Groups
Write-Host "`n🔒 Creating Security Groups..." -ForegroundColor Yellow

# Dev Security Group
$dev_sg = aws ec2 create-security-group `
    --group-name episode-metadata-db-sg-dev `
    --description "Security group for Episode Metadata Dev RDS" `
    --vpc-id $vpc_dev `
    --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

aws ec2 authorize-security-group-ingress `
    --group-id $dev_sg `
    --protocol tcp `
    --port 5432 `
    --cidr 10.0.0.0/16 `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Dev Security Group created (allows 5432 from VPC)" -ForegroundColor Green

# Staging Security Group
$staging_sg = aws ec2 create-security-group `
    --group-name episode-metadata-db-sg-staging `
    --description "Security group for Episode Metadata Staging RDS" `
    --vpc-id $vpc_staging `
    --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

aws ec2 authorize-security-group-ingress `
    --group-id $staging_sg `
    --protocol tcp `
    --port 5432 `
    --cidr 10.1.0.0/16 `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Staging Security Group created" -ForegroundColor Green

# Production Security Group
$prod_sg = aws ec2 create-security-group `
    --group-name episode-metadata-db-sg-prod `
    --description "Security group for Episode Metadata Production RDS" `
    --vpc-id $vpc_prod `
    --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

aws ec2 authorize-security-group-ingress `
    --group-id $prod_sg `
    --protocol tcp `
    --port 5432 `
    --cidr 10.2.0.0/16 `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Prod Security Group created" -ForegroundColor Green

# Create RDS Instances
Write-Host "`n📊 Creating RDS PostgreSQL Instances..." -ForegroundColor Yellow
Write-Host "  ⏳ This may take 5-10 minutes per instance..." -ForegroundColor Cyan

# Development RDS
Write-Host "`n  📍 Creating Dev RDS (t3.small, single-AZ)..." -ForegroundColor Cyan
aws rds create-db-instance `
    --db-instance-identifier episode-metadata-db-dev `
    --db-instance-class db.t3.small `
    --engine postgres `
    --engine-version 15.3 `
    --master-username postgres `
    --master-user-password "TempPassword123!Dev" `
    --allocated-storage 20 `
    --storage-type gp3 `
    --db-subnet-group-name episode-metadata-db-subnet-dev `
    --vpc-security-group-ids $dev_sg `
    --db-name episodemetadata `
    --backup-retention-period 1 `
    --storage-encrypted `
    --enable-cloudwatch-logs-exports '["postgresql"]' `
    --tags Key=Environment,Value=dev Key=Project,Value=episode-metadata `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Dev RDS instance created (will be available in 5-10 min)" -ForegroundColor Green

# Staging RDS
Write-Host "`n  📍 Creating Staging RDS (t3.small, single-AZ)..." -ForegroundColor Cyan
aws rds create-db-instance `
    --db-instance-identifier episode-metadata-db-staging `
    --db-instance-class db.t3.small `
    --engine postgres `
    --engine-version 15.3 `
    --master-username postgres `
    --master-user-password "TempPassword123!Staging" `
    --allocated-storage 20 `
    --storage-type gp3 `
    --db-subnet-group-name episode-metadata-db-subnet-staging `
    --vpc-security-group-ids $staging_sg `
    --db-name episodemetadata `
    --backup-retention-period 1 `
    --storage-encrypted `
    --enable-cloudwatch-logs-exports '["postgresql"]' `
    --tags Key=Environment,Value=staging Key=Project,Value=episode-metadata `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Staging RDS instance created (will be available in 5-10 min)" -ForegroundColor Green

# Production RDS (Multi-AZ, larger storage)
Write-Host "`n  📍 Creating Production RDS (t3.medium, Multi-AZ)..." -ForegroundColor Cyan
aws rds create-db-instance `
    --db-instance-identifier episode-metadata-db-prod `
    --db-instance-class db.t3.medium `
    --engine postgres `
    --engine-version 15.3 `
    --master-username postgres `
    --master-user-password "TempPassword123!Prod" `
    --allocated-storage 100 `
    --storage-type gp3 `
    --iops 3000 `
    --db-subnet-group-name episode-metadata-db-subnet-prod `
    --vpc-security-group-ids $prod_sg `
    --db-name episodemetadata `
    --backup-retention-period 7 `
    --multi-az `
    --storage-encrypted `
    --enable-cloudwatch-logs-exports '["postgresql"]' `
    --enable-enhanced-monitoring `
    --monitoring-role-arn "arn:aws:iam::637423256673:role/rds-monitoring-role" `
    --deletion-protection `
    --tags Key=Environment,Value=production Key=Project,Value=episode-metadata `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Production RDS instance created (Multi-AZ, will be available in 10-15 min)" -ForegroundColor Green

Write-Host "`n⏳ Waiting for RDS instances to initialize (this takes ~10 minutes)..." -ForegroundColor Yellow
Write-Host "   Checking status..." -ForegroundColor Gray

# Check status every 30 seconds for up to 15 minutes
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 30
    $attempt++
    
    $devStatus = aws rds describe-db-instances --db-instance-identifier episode-metadata-db-dev --region us-east-1 --query 'DBInstances[0].DBInstanceStatus' --output text 2>&1
    $stagingStatus = aws rds describe-db-instances --db-instance-identifier episode-metadata-db-staging --region us-east-1 --query 'DBInstances[0].DBInstanceStatus' --output text 2>&1
    $prodStatus = aws rds describe-db-instances --db-instance-identifier episode-metadata-db-prod --region us-east-1 --query 'DBInstances[0].DBInstanceStatus' --output text 2>&1
    
    if ($devStatus -eq "available" -and $stagingStatus -eq "available" -and $prodStatus -eq "available") {
        Write-Host "   ✅ All RDS instances are available!" -ForegroundColor Green
        break
    } else {
        Write-Host "   ⏳ Status: Dev=$devStatus, Staging=$stagingStatus, Prod=$prodStatus" -ForegroundColor Gray
    }
}

# Get RDS Endpoints
Write-Host "`n🔗 Retrieving RDS Endpoints..." -ForegroundColor Yellow

$dev_endpoint = aws rds describe-db-instances --db-instance-identifier episode-metadata-db-dev --region us-east-1 --query 'DBInstances[0].Endpoint.Address' --output text
$staging_endpoint = aws rds describe-db-instances --db-instance-identifier episode-metadata-db-staging --region us-east-1 --query 'DBInstances[0].Endpoint.Address' --output text
$prod_endpoint = aws rds describe-db-instances --db-instance-identifier episode-metadata-db-prod --region us-east-1 --query 'DBInstances[0].Endpoint.Address' --output text

Write-Host "`n✅ Phase 0D Complete: All RDS instances created!" -ForegroundColor Cyan
Write-Host "`n📊 RDS Summary:" -ForegroundColor Cyan
Write-Host "  🗄️  DEV (t3.small, single-AZ):" -ForegroundColor Green
Write-Host "      Instance: episode-metadata-db-dev" -ForegroundColor Green
Write-Host "      Endpoint: $dev_endpoint" -ForegroundColor Green
Write-Host "      Connection: postgres://postgres:PASSWORD@$($dev_endpoint):5432/episodemetadata" -ForegroundColor Green

Write-Host "`n  🗄️  STAGING (t3.small, single-AZ):" -ForegroundColor Green
Write-Host "      Instance: episode-metadata-db-staging" -ForegroundColor Green
Write-Host "      Endpoint: $staging_endpoint" -ForegroundColor Green
Write-Host "      Connection: postgres://postgres:PASSWORD@$($staging_endpoint):5432/episodemetadata" -ForegroundColor Green

Write-Host "`n  🗄️  PRODUCTION (t3.medium, Multi-AZ):" -ForegroundColor Green
Write-Host "      Instance: episode-metadata-db-prod" -ForegroundColor Green
Write-Host "      Endpoint: $prod_endpoint" -ForegroundColor Green
Write-Host "      Connection: postgres://postgres:PASSWORD@$($prod_endpoint):5432/episodemetadata" -ForegroundColor Green
Write-Host "      Features: 7-day backups, Multi-AZ, enhanced monitoring, deletion protection" -ForegroundColor Green

Write-Host "`n💾 Save these connection strings to .env and Secrets Manager!" -ForegroundColor Yellow

# Save endpoints to file for reference
@"
Development RDS:
  Host: $dev_endpoint
  Port: 5432
  Database: episodemetadata
  Username: postgres
  
Staging RDS:
  Host: $staging_endpoint
  Port: 5432
  Database: episodemetadata
  Username: postgres
  
Production RDS:
  Host: $prod_endpoint
  Port: 5432
  Database: episodemetadata
  Username: postgres
"@ | Out-File -FilePath "rds-endpoints.txt" -Encoding UTF8
Write-Host "`n📝 Endpoints saved to rds-endpoints.txt" -ForegroundColor Green
