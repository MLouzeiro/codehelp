# Start Evolution API with Docker Compose
# Run this script to start Evolution API + PostgreSQL + Redis

Write-Host "Starting Evolution API stack..." -ForegroundColor Cyan

# Check if Docker is running
try {
    $dockerVersion = & "C:\Program Files\Docker\Docker\resources\bin\docker.exe" --version 2>$null
    if (-not $dockerVersion) {
        Write-Host "Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Docker not found. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Start Evolution API stack
Write-Host "Starting Evolution API, PostgreSQL, and Redis..." -ForegroundColor Yellow
& "C:\Program Files\Docker\Docker\resources\bin\docker-compose.exe" -f docker-compose.evolution.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "Evolution API stack started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services:" -ForegroundColor Cyan
    Write-Host "  - Evolution API: http://localhost:8080" -ForegroundColor White
    Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor White
    Write-Host "  - Redis: localhost:6379" -ForegroundColor White
    Write-Host ""
    Write-Host "API Key: your-api-key-here-change-me" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To stop: docker-compose -f docker-compose.evolution.yml down" -ForegroundColor Gray
} else {
    Write-Host "Failed to start Evolution API stack" -ForegroundColor Red
}