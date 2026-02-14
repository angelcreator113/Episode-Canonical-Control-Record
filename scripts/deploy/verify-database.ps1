# Verify database connection and schema
# Run this after migrations to verify tables were created

param(
    [string]$Endpoint = $null,
    [string]$Port = "5432",
    [string]$Database = "episode_metadata",
    [string]$Username = "postgres",
    [string]$Password = $null
)

# If endpoint not provided, read from file
if (-not $Endpoint) {
    if (Test-Path "rds-endpoint-dev.txt") {
        $content = Get-Content "rds-endpoint-dev.txt"
        $lines = $content.Split("`n")
        $Endpoint = ($lines[1] -split ":")[0]
        Write-Host "Using endpoint from rds-endpoint-dev.txt: $Endpoint" -ForegroundColor Gray
    } else {
        Write-Host "Usage: powershell verify-database.ps1 -Endpoint <hostname> -Password <password>" -ForegroundColor Yellow
        exit 1
    }
}

# Try to get password from environment or .env
if (-not $Password) {
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" | Where-Object { $_ -match "^DB_PASSWORD=" }
        if ($envContent) {
            $Password = $envContent -replace "^DB_PASSWORD=", ""
        }
    }
}

if (-not $Password) {
    Write-Host "Password not found in .env. Please provide with -Password parameter" -ForegroundColor Red
    exit 1
}

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Database Verification                                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`nVerifying connection to: $Endpoint" -ForegroundColor Yellow

# Use Node.js to verify connection since psql might not be installed
$verifyScript = @"
const pg = require('pg');

const config = {
    host: '$Endpoint',
    port: $Port,
    database: '$Database',
    user: '$Username',
    password: '$Password',
    ssl: { rejectUnauthorized: false }
};

const pool = new pg.Pool(config);

async function verify() {
    try {
        const client = await pool.connect();
        
        // Check connection
        console.log('✓ Connected to database');
        
        // List tables
        const tables = await client.query(\`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        \`);
        
        if (tables.rows.length === 0) {
            console.log('✗ No tables found. Migrations may not have run.');
            client.release();
            process.exit(1);
        }
        
        console.log('✓ Found ' + tables.rows.length + ' tables:');
        tables.rows.forEach(row => {
            console.log('  - ' + row.table_name);
        });
        
        // Check for expected tables
        const expectedTables = ['episodes', 'metadata_storage', 'thumbnails', 'processing_queue', 'activity_logs'];
        const actualTables = tables.rows.map(r => r.table_name);
        
        const missing = expectedTables.filter(t => !actualTables.includes(t));
        if (missing.length > 0) {
            console.log('✗ Missing tables: ' + missing.join(', '));
            client.release();
            process.exit(1);
        }
        
        console.log('✓ All expected tables present');
        
        client.release();
        process.exit(0);
    } catch (err) {
        console.log('✗ Connection failed: ' + err.message);
        process.exit(1);
    }
}

verify();
"@

# Write temp script
$scriptPath = "verify-db-temp.js"
Set-Content -Path $scriptPath -Value $verifyScript

# Run it
Write-Host "`nConnecting to database..." -ForegroundColor Gray
node $scriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Database verification PASSED" -ForegroundColor Green
} else {
    Write-Host "`n✗ Database verification FAILED" -ForegroundColor Red
}

# Cleanup
Remove-Item $scriptPath -Force

exit $LASTEXITCODE
