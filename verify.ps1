# Builds and tests the backend, frontend and Docker images. Exits non-zero on the first failure.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Invoke-Step {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [scriptblock]$Command
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAILED: $Name" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    }
    finally {
        Pop-Location
    }
}

Invoke-Step 'Backend build' "$root\backend" { dotnet build }
Invoke-Step 'Backend tests' "$root\backend" { dotnet test --no-build }
Invoke-Step 'Frontend install' "$root\frontend" { npm ci }
Invoke-Step 'Frontend build' "$root\frontend" { npm run build }
Invoke-Step 'Frontend tests' "$root\frontend" { npm run test }
Invoke-Step 'Frontend E2E' "$root\frontend" { npm run test:e2e }
Invoke-Step 'Docker images' $root { docker compose build }

Write-Host "`nAll checks passed." -ForegroundColor Green
