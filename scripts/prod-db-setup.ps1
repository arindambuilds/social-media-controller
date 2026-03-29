param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,
    [Parameter(Mandatory = $false)]
    [string]$DirectUrl = ""
)

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    Write-Error "DatabaseUrl must not be empty."
    exit 1
}

$ErrorActionPreference = "Stop"
$env:DATABASE_URL = $DatabaseUrl.Trim()
$env:DIRECT_URL = if ([string]::IsNullOrWhiteSpace($DirectUrl)) { $env:DATABASE_URL } else { $DirectUrl.Trim() }
Write-Host "Running migrations..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Seeding database..."
npx prisma db seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done."
