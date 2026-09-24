# Deletes ./data (database and JWT key), then seeds it through the real API:
#   - user "user" / "password" (the first user, so an admin)
#   - today's journal entry with one sub-entry and one append
# Stop the app first (dotnet run / docker compose down): a running backend locks the database file.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dataDirectory = Join-Path $root 'data'
$projectDirectory = Join-Path $root 'backend\Autograt.Api'
$baseUrl = 'http://localhost:5055' # A separate port, so it never talks to an already running dev server.

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [hashtable]$Headers = @{}
    )

    $json = $Body | ConvertTo-Json -Depth 5
    Invoke-RestMethod "$baseUrl$Path" -Method $Method -Headers $Headers -ContentType 'application/json' -Body $json
}

Write-Host '==> Deleting data' -ForegroundColor Cyan
if (Test-Path $dataDirectory) {
    try {
        Remove-Item $dataDirectory -Recurse -Force
    }
    catch {
        Write-Host "Could not delete $dataDirectory. Stop the running backend (or docker compose down) and retry." -ForegroundColor Red
        exit 1
    }
}

Write-Host '==> Building backend' -ForegroundColor Cyan
dotnet build $projectDirectory --nologo --verbosity quiet
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> Starting backend (applies migrations)' -ForegroundColor Cyan
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = $baseUrl
$assembly = Join-Path $projectDirectory 'bin\Debug\net8.0\Autograt.Api.dll'
$backend = Start-Process dotnet -ArgumentList "`"$assembly`"" -WorkingDirectory $projectDirectory -PassThru -WindowStyle Hidden

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30 -and -not $ready; $attempt++) {
        try {
            Invoke-RestMethod "$baseUrl/api/health" | Out-Null
            $ready = $true
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $ready) { throw 'The backend did not start within 30 seconds.' }

    Write-Host '==> Seeding' -ForegroundColor Cyan
    $credentials = @{ username = 'user'; password = 'password' }
    $user = Invoke-Api Post '/api/auth/register' $credentials
    $session = Invoke-Api Post '/api/auth/login' $credentials
    $auth = @{ Authorization = "Bearer $($session.token)" }

    $today = (Get-Date).ToString('yyyy-MM-dd')
    $entry = Invoke-Api Post '/api/journal/entries' -Headers $auth -Body @{
        entryDate  = $today
        dayRating  = 8
        subEntries = @(@{ category = 'Good'; content = 'Seeded the autograt database' })
    }
    $subEntryId = $entry.subEntries[0].id
    Invoke-Api Post "/api/journal/sub-entries/$subEntryId/appends" -Headers $auth -Body @{ content = 'Everything worked on the first try' } | Out-Null

    Write-Host "`nSeeded user '$($user.username)' (admin: $($user.isAdmin)) with an entry for $today." -ForegroundColor Green
}
finally {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Remove-Item Env:ASPNETCORE_ENVIRONMENT, Env:ASPNETCORE_URLS -ErrorAction SilentlyContinue
}
