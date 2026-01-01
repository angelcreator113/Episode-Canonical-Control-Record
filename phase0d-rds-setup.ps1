# Phase 0D: RDS PostgreSQL - Simplified Setup
# Creates 3 RDS instances with proper configuration

$ErrorActionPreference = "Stop"
$region = "us-east-1"

Write-Host "`n=== Phase 0D: RDS PostgreSQL Setup ===" -ForegroundColor Cyan

# VPC IDs from Phase 0B
$vpc_dev = "vpc-0754967be21268e7e"
$vpc_staging = "vpc-061b92a85af436d42"
$vpc_prod = "vpc-09cc6fa2ee3ce35ba"

Write-Host "`nGetting private subnets..." -ForegroundColor Yellow

# Get subnets for each VPC
$dev_subnets = (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_dev" --region $region --query 'Subnets[0:2].SubnetId' --output text).Split()
$staging_subnets = (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_staging" --region $region --query 'Subnets[0:2].SubnetId' --output text).Split()
$prod_subnets = (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_prod" --region $region --query 'Subnets[0:2].SubnetId' --output text).Split()

Write-Host "Dev subnets: $dev_subnets" -ForegroundColor Gray
Write-Host "Staging subnets: $staging_subnets" -ForegroundColor Gray
Write-Host "Prod subnets: $prod_subnets" -ForegroundColor Gray

# Create DB Subnet Groups
Write-Host "`nCreating DB Subnet Groups..." -ForegroundColor Yellow

aws rds create-db-subnet-group `
    --db-subnet-group-name "episode-metadata-db-subnet-dev" `
    --db-subnet-group-description "Dev RDS subnets" `
    --subnet-ids $dev_subnets `
    --region $region 2>&1 | Out-Null
Write-Host "  Dev subnet group created" -ForegroundColor Green

aws rds create-db-subnet-group `
    --db-subnet-group-name "episode-metadata-db-subnet-staging" `
    --db-subnet-group-description "Staging RDS subnets" `
    --subnet-ids $staging_subnets `
    --region $region 2>&1 | Out-Null
Write-Host "  Staging subnet group created" -ForegroundColor Green

aws rds create-db-subnet-group `
    --db-subnet-group-name "episode-metadata-db-subnet-prod" `
    --db-subnet-group-description "Prod RDS subnets" `
    --subnet-ids $prod_subnets `
    --region $region 2>&1 | Out-Null
Write-Host "  Prod subnet group created" -ForegroundColor Green

# Create Security Groups
Write-Host "`nCreating Security Groups..." -ForegroundColor Yellow

$dev_sg = aws ec2 create-security-group `
    --group-name "episode-metadata-db-sg-dev" `
    --description "Dev RDS security group" `
    --vpc-id $vpc_dev `
    --region $region | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

aws ec2 authorize-security-group-ingress `
    --group-id $dev_sg `
    --protocol tcp `
    --port 5432 `
    --cidr 10.0.0.0/16 `
    --region $region 2>&1 | Out-Null
Write-Host "  Dev security group created" -ForegroundColor Green

$staging_sg = aws ec2 create-security-group `
    --group-name "episode-metadata-db-sg-staging" `
    --description "Staging RDS security group" `
    --vpc-id $vpc_staging `
    --region $region | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

aws ec2 authorize-security-group-ingress `
    --group-id $staging_sg `
    --protocol tcp `
    --port 5432 `
    --cidr 10.1.0.0/16 `
    --region $region 2>&1 | Out-Null
Write-Host "  Staging security group created" -ForegroundColor Green

$prod_sg = aws ec2 create-security-group `
    --group-name "episode-metadata-db-sg-prod" `
    --description "Prod RDS security group" `
    --vpc-id $vpc_prod `
    --region $region | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

aws ec2 authorize-security-group-ingress `
    --group-id $prod_sg `
    --protocol tcp `
    --port 5432 `
    --cidr 10.2.0.0/16 `
    --region $region 2>&1 | Out-Null
Write-Host "  Prod security group created" -ForegroundColor Green

# Create RDS Instances
Write-Host "`nCreating RDS instances (this takes 5-10 minutes)..." -ForegroundColor Yellow

Write-Host "  Creating Dev database..." -ForegroundColor Gray
aws rds create-db-instance `
    --db-instance-identifier "episode-control-dev" `
    --db-instance-class "db.t3.micro" `
    --engine "postgres" `
    --engine-version "14.7" `
    --master-username "postgres" `
    --master-user-password "EpisodeControl2024!Dev" `
    --allocated-storage "20" `
    --storage-type "gp2" `
    --db-subnet-group-name "episode-metadata-db-subnet-dev" `
    --vpc-security-group-ids $dev_sg `
    --db-name "episode_metadata" `
    --backup-retention-period "7" `
    --no-publicly-accessible `
    --multi-az false `
    --storage-encrypted true `
    --region $region 2>&1 | Out-Null
Write-Host "    Dev database creation started" -ForegroundColor Green

Write-Host "  Creating Staging database..." -ForegroundColor Gray
aws rds create-db-instance `
    --db-instance-identifier "episode-control-staging" `
    --db-instance-class "db.t3.small" `
    --engine "postgres" `
    --engine-version "14.7" `
    --master-username "postgres" `
    --master-user-password "EpisodeControl2024!Staging" `
    --allocated-storage "30" `
    --storage-type "gp2" `
    --db-subnet-group-name "episode-metadata-db-subnet-staging" `
    --vpc-security-group-ids $staging_sg `
    --db-name "episode_metadata" `
    --backup-retention-period "30" `
    --no-publicly-accessible `
    --multi-az false `
    --storage-encrypted true `
    --region $region 2>&1 | Out-Null
Write-Host "    Staging database creation started" -ForegroundColor Green

Write-Host "  Creating Production database..." -ForegroundColor Gray
aws rds create-db-instance `
    --db-instance-identifier "episode-control-prod" `
    --db-instance-class "db.t3.small" `
    --engine "postgres" `
    --engine-version "14.7" `
    --master-username "postgres" `
    --master-user-password "EpisodeControl2024!Prod" `
    --allocated-storage "50" `
    --storage-type "gp2" `
    --db-subnet-group-name "episode-metadata-db-subnet-prod" `
    --vpc-security-group-ids $prod_sg `
    --db-name "episode_metadata" `
    --backup-retention-period "60" `
    --no-publicly-accessible `
    --multi-az false `
    --storage-encrypted true `
    --region $region 2>&1 | Out-Null
Write-Host "    Prod database creation started" -ForegroundColor Green

Write-Host "`n=== RDS Creation Initiated ===" -ForegroundColor Cyan
Write-Host "Databases will be available in 5-10 minutes" -ForegroundColor Yellow
Write-Host "`nTo check status, run:" -ForegroundColor Gray
Write-Host "  aws rds describe-db-instances --region us-east-1 --query 'DBInstances[*].{Name:DBInstanceIdentifier,Status:DBInstanceStatus}'" -ForegroundColor Gray
