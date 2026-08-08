# ============================================================================
# MIGRATION SCRIPT
# ============================================================================
# PowerShell script to run SQL migrations against Supabase
# ============================================================================

param(
    [string]$Migration,
    [switch]$CheckOnly,
    [switch]$Help
)

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

# Check environment
if (-not $env:NEXT_PUBLIC_SUPABASE_URL) {
    Write-Host "${Red}Error: NEXT_PUBLIC_SUPABASE_URL not set${Reset}"
    exit 1
}

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "${Red}Error: SUPABASE_SERVICE_ROLE_KEY not set${Reset}"
    exit 1
}

# Help
if ($Help) {
    Write-Host @"
Migration Script

Usage:
    .\scripts\migrate.ps1                     Run all migrations
    .\scripts\migrate.ps1 -Migration <file>  Run specific migration
    .\scripts\migrate.ps1 -CheckOnly          Check migration status

Examples:
    .\scripts\migrate.ps1
    .\scripts\migrate.ps1 -Migration "20250805_multi_tenant_platform.sql"
    .\scripts\migrate.ps1 -CheckOnly
"@
    exit 0
}

$migrationsDir = "supabase\migrations"

# List migrations
function Get-Migrations {
    if (Test-Path $migrationsDir) {
        return Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name
    }
    return @()
}

# Check only
if ($CheckOnly) {
    Write-Host "${Yellow}Available migrations:${Reset}"
    $migrations = Get-Migrations
    foreach ($m in $migrations) {
        Write-Host "  - $($m.Name)"
    }
    exit 0
}

# Run specific migration
if ($Migration) {
    $filePath = Join-Path $migrationsDir $Migration
    if (-not (Test-Path $filePath)) {
        Write-Host "${Red}Migration not found: $Migration${Reset}"
        exit 1
    }
    
    Write-Host "${Yellow}Running migration: $Migration${Reset}"
    $sql = Get-Content $filePath -Raw
    
    # Execute via Supabase REST API
    $body = @{ query = $sql } | ConvertTo-Json
    $headers = @{
        "apikey" = $env:SUPABASE_SERVICE_ROLE_KEY
        "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$env:NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" `
            -Method Post `
            -Headers $headers `
            -Body $body
        
        Write-Host "${Green}✓ Migration completed${Reset}"
    } catch {
        Write-Host "${Red}✗ Migration failed: $_${Reset}"
        exit 1
    }
    exit 0
}

# Run all migrations
Write-Host "${Yellow}Running all migrations...${Reset}"
$migrations = Get-Migrations

foreach ($m in $migrations) {
    Write-Host "  Running: $($m.Name)"
    $sql = Get-Content $m.FullName -Raw
    
    $body = @{ query = $sql } | ConvertTo-Json
    $headers = @{
        "apikey" = $env:SUPABASE_SERVICE_ROLE_KEY
        "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
        "Content-Type" = "application/json"
    }
    
    try {
        Invoke-RestMethod -Uri "$env:NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" `
            -Method Post `
            -Headers $headers `
            -Body $body | Out-Null
        
        Write-Host "${Green}  ✓ Completed${Reset}"
    } catch {
        Write-Host "${Red}  ✗ Failed: $_${Reset}"
        # Continue with next migration
    }
}

Write-Host "${Green}All migrations complete!${Reset}"
