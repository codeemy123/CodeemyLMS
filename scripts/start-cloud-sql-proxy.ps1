param(
  [int]$Port = 5433,
  [string]$Instance = 'my-project-8521codeemy-lms:asia-south1:codeemy-lms-db'
)

$proxyPath = Join-Path $PSScriptRoot '..\cloud-sql-proxy.exe'

if (-not (Test-Path $proxyPath)) {
  throw "Cloud SQL Auth Proxy was not found at $proxyPath. Download it, or update this script with its location."
}

Write-Host "Starting Cloud SQL Auth Proxy for $Instance on 127.0.0.1:$Port"
Write-Host 'Keep this terminal open while running Prisma migrations in a second terminal.'
& $proxyPath --address 127.0.0.1 --port $Port $Instance
