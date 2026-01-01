# Setup Staging and Production VPCs
# This script completes Phase 0B by creating VPCs and all subnets

$ErrorActionPreference = "Stop"

Write-Host "🔧 Phase 0B: Creating Staging and Production VPCs..." -ForegroundColor Cyan

# STAGING VPC (10.1.0.0/16)
Write-Host "`n📍 Creating Staging VPC..." -ForegroundColor Yellow

$vpc_staging_id = "vpc-061b92a85af436d42"

# Public subnets for staging
aws ec2 create-subnet --vpc-id $vpc_staging_id --cidr-block 10.1.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-public-1a-staging},{Key=Type,Value=Public}]' --region us-east-1 | Out-Null
aws ec2 create-subnet --vpc-id $vpc_staging_id --cidr-block 10.1.2.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-public-1b-staging},{Key=Type,Value=Public}]' --region us-east-1 | Out-Null

# Private subnets for staging
aws ec2 create-subnet --vpc-id $vpc_staging_id --cidr-block 10.1.10.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-private-1a-staging},{Key=Type,Value=Private}]' --region us-east-1 | Out-Null
aws ec2 create-subnet --vpc-id $vpc_staging_id --cidr-block 10.1.20.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-private-1b-staging},{Key=Type,Value=Private}]' --region us-east-1 | Out-Null

# IGW for staging
$igw_staging = aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=episode-metadata-igw-staging}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty InternetGateway | Select-Object -ExpandProperty InternetGatewayId
aws ec2 attach-internet-gateway --internet-gateway-id $igw_staging --vpc-id $vpc_staging_id --region us-east-1 | Out-Null

# EIP and NAT Gateway for staging
$eip_staging = aws ec2 allocate-address --domain vpc --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty AllocationId
$nat_staging = aws ec2 create-nat-gateway --subnet-id (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_staging_id" "Name=cidr-block,Values=10.1.1.0/24" --region us-east-1 --query 'Subnets[0].SubnetId' --output text) --allocation-id $eip_staging --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty NatGateway | Select-Object -ExpandProperty NatGatewayId

# Wait for NAT to be available
Start-Sleep -Seconds 10

# Route tables for staging
$rt_pub_staging = aws ec2 create-route-table --vpc-id $vpc_staging_id --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-rt-public-staging}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty RouteTable | Select-Object -ExpandProperty RouteTableId
aws ec2 create-route --route-table-id $rt_pub_staging --destination-cidr-block 0.0.0.0/0 --gateway-id $igw_staging --region us-east-1 | Out-Null

$rt_priv_staging = aws ec2 create-route-table --vpc-id $vpc_staging_id --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-rt-private-staging}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty RouteTable | Select-Object -ExpandProperty RouteTableId
aws ec2 create-route --route-table-id $rt_priv_staging --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $nat_staging --region us-east-1 | Out-Null

# Associate subnets
$pub_subnets_staging = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_staging_id" "Name=cidr-block,Values=10.1.1.0/24,10.1.2.0/24" --region us-east-1 --query 'Subnets[*].SubnetId' --output text
foreach ($subnet in $pub_subnets_staging.Split(" ")) {
    aws ec2 associate-route-table --route-table-id $rt_pub_staging --subnet-id $subnet --region us-east-1 | Out-Null
}

$priv_subnets_staging = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_staging_id" "Name=cidr-block,Values=10.1.10.0/24,10.1.20.0/24" --region us-east-1 --query 'Subnets[*].SubnetId' --output text
foreach ($subnet in $priv_subnets_staging.Split(" ")) {
    aws ec2 associate-route-table --route-table-id $rt_priv_staging --subnet-id $subnet --region us-east-1 | Out-Null
}

Write-Host "✅ Staging VPC complete (vpc-061b92a85af436d42)" -ForegroundColor Green

# PRODUCTION VPC (10.2.0.0/16) with Multi-AZ NAT
Write-Host "`n📍 Creating Production VPC (Multi-AZ)..." -ForegroundColor Yellow

$vpc_prod = aws ec2 create-vpc --cidr-block 10.2.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=episode-metadata-vpc-production},{Key=Environment,Value=production}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty Vpc | Select-Object -ExpandProperty VpcId

# Public subnets for prod
aws ec2 create-subnet --vpc-id $vpc_prod --cidr-block 10.2.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-public-1a-prod},{Key=Type,Value=Public}]' --region us-east-1 | Out-Null
aws ec2 create-subnet --vpc-id $vpc_prod --cidr-block 10.2.2.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-public-1b-prod},{Key=Type,Value=Public}]' --region us-east-1 | Out-Null

# Private subnets for prod
aws ec2 create-subnet --vpc-id $vpc_prod --cidr-block 10.2.10.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-private-1a-prod},{Key=Type,Value=Private}]' --region us-east-1 | Out-Null
aws ec2 create-subnet --vpc-id $vpc_prod --cidr-block 10.2.20.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-subnet-private-1b-prod},{Key=Type,Value=Private}]' --region us-east-1 | Out-Null

# IGW for prod
$igw_prod = aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=episode-metadata-igw-prod}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty InternetGateway | Select-Object -ExpandProperty InternetGatewayId
aws ec2 attach-internet-gateway --internet-gateway-id $igw_prod --vpc-id $vpc_prod --region us-east-1 | Out-Null

# EIP and NAT Gateways for prod (Multi-AZ with 2 NATs)
$eip_prod_1a = aws ec2 allocate-address --domain vpc --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty AllocationId
$eip_prod_1b = aws ec2 allocate-address --domain vpc --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty AllocationId

$sub_pub_1a_prod = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_prod" "Name=cidr-block,Values=10.2.1.0/24" --region us-east-1 --query 'Subnets[0].SubnetId' --output text
$sub_pub_1b_prod = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_prod" "Name=cidr-block,Values=10.2.2.0/24" --region us-east-1 --query 'Subnets[0].SubnetId' --output text

$nat_prod_1a = aws ec2 create-nat-gateway --subnet-id $sub_pub_1a_prod --allocation-id $eip_prod_1a --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty NatGateway | Select-Object -ExpandProperty NatGatewayId
$nat_prod_1b = aws ec2 create-nat-gateway --subnet-id $sub_pub_1b_prod --allocation-id $eip_prod_1b --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty NatGateway | Select-Object -ExpandProperty NatGatewayId

Write-Host "⏳ Waiting for Production NAT Gateways to be available..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Route tables for prod
$rt_pub_prod = aws ec2 create-route-table --vpc-id $vpc_prod --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-rt-public-prod}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty RouteTable | Select-Object -ExpandProperty RouteTableId
aws ec2 create-route --route-table-id $rt_pub_prod --destination-cidr-block 0.0.0.0/0 --gateway-id $igw_prod --region us-east-1 | Out-Null

$rt_priv_prod_1a = aws ec2 create-route-table --vpc-id $vpc_prod --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-rt-private-1a-prod}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty RouteTable | Select-Object -ExpandProperty RouteTableId
aws ec2 create-route --route-table-id $rt_priv_prod_1a --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $nat_prod_1a --region us-east-1 | Out-Null

$rt_priv_prod_1b = aws ec2 create-route-table --vpc-id $vpc_prod --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-rt-private-1b-prod}]' --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty RouteTable | Select-Object -ExpandProperty RouteTableId
aws ec2 create-route --route-table-id $rt_priv_prod_1b --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $nat_prod_1b --region us-east-1 | Out-Null

# Associate public subnets
aws ec2 associate-route-table --route-table-id $rt_pub_prod --subnet-id $sub_pub_1a_prod --region us-east-1 | Out-Null
aws ec2 associate-route-table --route-table-id $rt_pub_prod --subnet-id $sub_pub_1b_prod --region us-east-1 | Out-Null

# Associate private subnets (1a subnet with 1a NAT, 1b subnet with 1b NAT for redundancy)
$sub_priv_1a_prod = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_prod" "Name=cidr-block,Values=10.2.10.0/24" --region us-east-1 --query 'Subnets[0].SubnetId' --output text
$sub_priv_1b_prod = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc_prod" "Name=cidr-block,Values=10.2.20.0/24" --region us-east-1 --query 'Subnets[0].SubnetId' --output text

aws ec2 associate-route-table --route-table-id $rt_priv_prod_1a --subnet-id $sub_priv_1a_prod --region us-east-1 | Out-Null
aws ec2 associate-route-table --route-table-id $rt_priv_prod_1b --subnet-id $sub_priv_1b_prod --region us-east-1 | Out-Null

Write-Host "✅ Production VPC complete ($vpc_prod)" -ForegroundColor Green

Write-Host "`n✅ Phase 0B Complete: All 3 VPCs created with subnets, gateways, and route tables!" -ForegroundColor Cyan
Write-Host "`n📊 VPC Summary:" -ForegroundColor Cyan
Write-Host "  📍 Dev:        vpc-0754967be21268e7e (10.0.0.0/16)" -ForegroundColor Green
Write-Host "  📍 Staging:    vpc-061b92a85af436d42 (10.1.0.0/16)" -ForegroundColor Green
Write-Host "  📍 Production: $vpc_prod (10.2.0.0/16) - Multi-AZ" -ForegroundColor Green
