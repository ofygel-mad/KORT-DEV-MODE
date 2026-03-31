$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serverDir = Join-Path $repoRoot 'server'

Set-Location $repoRoot
docker compose up -d postgres | Out-Null

$dbExists = docker compose exec -T postgres psql -U kort -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'kort_db_test'"
if (-not ($dbExists | Select-String -Pattern '1' -Quiet)) {
  docker compose exec -T postgres psql -U kort -d postgres -c "CREATE DATABASE kort_db_test"
}

Set-Location $serverDir

$env:NODE_ENV = 'test'
$env:DATABASE_URL = 'postgresql://kort:kort_secret@localhost:5432/kort_db_test'
$env:JWT_ACCESS_SECRET = 'test-secret-access-32-chars-minimum'
$env:JWT_REFRESH_SECRET = 'test-secret-refresh-32-chars-minimum'
$env:JWT_ACCESS_TTL = '15m'
$env:JWT_REFRESH_TTL = '7d'
$env:PORT = '8001'
$env:HOST = '127.0.0.1'
$env:CORS_ORIGIN = 'http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:3000,http://localhost:3000'
$env:CONSOLE_SERVICE_PASSWORD = 'test1234'

pnpm db:deploy | Out-Host
pnpm db:seed | Out-Host
pnpm exec tsx src/index.ts
