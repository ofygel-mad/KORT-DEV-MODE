$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$env:VITE_API_BASE_URL = '/api/v1'
$env:VITE_PROXY_TARGET = 'http://127.0.0.1:8001'

pnpm build | Out-Host
pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
