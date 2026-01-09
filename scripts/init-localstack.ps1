#!/usr/bin/env pwsh
# LocalStack Initialization Script - Windows PowerShell
# Initializes LocalStack S3 buckets and SQS queues for development

param(
    [string]$EndpointUrl = "http://localhost:4566",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Continue"

Write-Host "🔧 Initializing LocalStack for Episode Metadata API..." -ForegroundColor Cyan
Write-Host "Endpoint: $EndpointUrl"
Write-Host "Region: $Region"
Write-Host ""

# Set AWS credentials for LocalStack
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = $Region

# Function to create bucket
function New-S3Bucket {
    param(
        [string]$BucketName,
        [string]$Endpoint,
        [string]$Region
    )
    
    Write-Host "📦 Creating bucket: $BucketName" -ForegroundColor Yellow
    
    try {
        $output = aws s3 mb "s3://$BucketName" `
            --endpoint-url $Endpoint `
            --region $Region 2>&1
        
        Write-Host "✓ Bucket ready: $BucketName" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Bucket may already exist or error occurred" -ForegroundColor Yellow
    }
}

# Function to create SQS queue
function New-SQSQueue {
    param(
        [string]$QueueName,
        [string]$Endpoint,
        [string]$Region
    )
    
    Write-Host "📬 Creating SQS queue: $QueueName" -ForegroundColor Yellow
    
    try {
        $output = aws sqs create-queue `
            --queue-name $QueueName `
            --endpoint-url $Endpoint `
            --region $Region 2>&1
        
        Write-Host "✓ Queue ready: $QueueName" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Queue may already exist or error occurred" -ForegroundColor Yellow
    }
}

# Create development buckets
Write-Host ""
Write-Host "Creating S3 Buckets..." -ForegroundColor Cyan
New-S3Bucket -BucketName "brd-episodes-dev" -Endpoint $EndpointUrl -Region $Region
New-S3Bucket -BucketName "brd-thumbnails-dev" -Endpoint $EndpointUrl -Region $Region
New-S3Bucket -BucketName "brd-temp-dev" -Endpoint $EndpointUrl -Region $Region

# Create SQS queues
Write-Host ""
Write-Host "Creating SQS Queues..." -ForegroundColor Cyan
New-SQSQueue -QueueName "brd-job-queue-dev" -Endpoint $EndpointUrl -Region $Region
New-SQSQueue -QueueName "brd-job-dlq-dev" -Endpoint $EndpointUrl -Region $Region

# List created resources
Write-Host ""
Write-Host "✅ LocalStack initialization complete!" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Available S3 Buckets:" -ForegroundColor Cyan
aws s3 ls --endpoint-url $EndpointUrl --region $Region

Write-Host ""
Write-Host "📬 Available SQS Queues:" -ForegroundColor Cyan
aws sqs list-queues --endpoint-url $EndpointUrl --region $Region 2>&1 | ConvertFrom-Json | ConvertTo-Json -Depth 2

Write-Host ""
Write-Host "✅ You're ready to start developing!" -ForegroundColor Green
Write-Host "Backend API: http://localhost:3002"
Write-Host "Frontend: http://localhost:5173"
