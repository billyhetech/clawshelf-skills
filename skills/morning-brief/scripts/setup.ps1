# ClawShelf Morning Brief — One-click setup (Windows)
# Run in PowerShell:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\setup.ps1

$ErrorActionPreference = "Stop"
$gogDir    = "$env:USERPROFILE\bin"
$gogExe    = "$gogDir\gog.exe"
$configDir = "$env:USERPROFILE\.openclaw\clawshelf"
$envFile   = "$configDir\.env"

function Write-Step($msg) { Write-Host "`n$msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  v $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  > $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }

Clear-Host
Write-Host "======================================" -ForegroundColor DarkGray
Write-Host "  ClawShelf Morning Brief — Setup" -ForegroundColor White
Write-Host "======================================" -ForegroundColor DarkGray

# ── Step 1: Download gogcli ──────────────────────────────────────────────────

Write-Step "Step 1/4  Install gogcli"

if (Test-Path $gogExe) {
    $ver = & $gogExe --version 2>&1
    Write-OK "gogcli already installed: $ver"
} else {
    Write-Info "Fetching latest release from GitHub..."
    try {
        $release = Invoke-RestMethod "https://api.github.com/repos/steipete/gogcli/releases/latest"
        $asset   = $release.assets |
                   Where-Object { $_.name -match "windows.*amd64" -or $_.name -match "amd64.*windows" } |
                   Select-Object -First 1
        if (-not $asset) { throw "No Windows binary found in the latest release." }

        New-Item -ItemType Directory -Force -Path $gogDir | Out-Null
        Write-Info "Downloading: $($asset.name)"
        Invoke-WebRequest $asset.browser_download_url -OutFile $gogExe -UseBasicParsing
        Write-OK "Download complete"
    } catch {
        Write-Host ""
        Write-Host "  Auto-download failed: $_" -ForegroundColor Red
        Write-Host "  Please download manually:" -ForegroundColor Yellow
        Write-Host "  1. Open https://github.com/steipete/gogcli/releases" -ForegroundColor White
        Write-Host "  2. Download gogcli-windows-amd64.exe" -ForegroundColor White
        Write-Host "  3. Rename it to gog.exe and move it to: $gogDir" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter when done"
    }

    # Add to PATH (current session + permanent)
    $env:Path += ";$gogDir"
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$gogDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$gogDir", "User")
    }
    Write-OK "Added to PATH (restart terminal for global effect)"
}

# ── Step 2: Create Google OAuth credentials ──────────────────────────────────

Write-Step "Step 2/4  Create Google credentials (one-time, ~3 minutes)"
Write-Host ""
Write-Host "  A browser will open. Follow these 5 steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1  Click 'Select a project' (top) -> 'New Project' -> name it ClawShelf -> Create" -ForegroundColor White
Write-Host "  2  Left menu: APIs & Services -> Enable APIs" -ForegroundColor White
Write-Host "     Search and enable: Google Calendar API   and   Gmail API" -ForegroundColor White
Write-Host "  3  Left menu: OAuth consent screen -> External -> Create" -ForegroundColor White
Write-Host "     App name: ClawShelf -> Save and Continue (skip other pages)" -ForegroundColor White
Write-Host "     Test users page: add your Gmail address -> Save" -ForegroundColor White
Write-Host "  4  Left menu: Credentials -> Create Credentials -> OAuth client ID" -ForegroundColor White
Write-Host "     Application type: Desktop app -> Name: ClawShelf -> Create" -ForegroundColor White
Write-Host "  5  Click the download icon, save client_secret_xxx.json to your Desktop" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to open the browser..."
Start-Process "https://console.cloud.google.com/apis/credentials"

Write-Host ""
Write-Info "After completing the 5 steps, paste the path to client_secret_xxx.json here:"
Write-Info "(Example: C:\Users\billy\Desktop\client_secret_xxx.json)"
$secretInput = (Read-Host "  File path").Trim('"').Trim("'").Trim()

if (-not (Test-Path $secretInput)) { Write-Err "File not found: $secretInput" }
Write-OK "Credentials file found"

# ── Step 3: Authorize account ────────────────────────────────────────────────

Write-Step "Step 3/4  Authorize Google account (read-only)"

& $gogExe auth credentials $secretInput
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to import credentials" }
Write-OK "Credentials imported (you can delete client_secret.json now)"

Write-Host ""
$gmail = Read-Host "  Enter your Gmail address"
Write-Info "Opening browser for authorization..."
& $gogExe auth add $gmail --readonly
if ($LASTEXITCODE -ne 0) { Write-Err "Authorization failed — please try again" }
Write-OK "Authorized (read-only: cannot send or delete emails)"

# ── Step 4: Save config ──────────────────────────────────────────────────────

Write-Step "Step 4/4  Save config"

New-Item -ItemType Directory -Force -Path $configDir | Out-Null

@"
# ClawShelf Morning Brief config
# This file contains no passwords or tokens — safe to view

GOG_ACCOUNT=$gmail
GOG_JSON=true
"@ | Out-File -FilePath $envFile -Encoding utf8

Write-OK "Config saved to $envFile"

# ── Verify ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Info "Verifying connections..."

$calTest  = & $gogExe calendar events list --today --json 2>&1
$mailTest = & $gogExe gmail search 'is:unread newer_than:1d' --json --readonly 2>&1

if ($calTest  -notmatch "error") { Write-OK "Google Calendar — connected" }
else { Write-Host "  ! Calendar returned no data (may just be an empty calendar)" -ForegroundColor Yellow }

if ($mailTest -notmatch "error") { Write-OK "Gmail — connected (read-only)" }
else { Write-Host "  ! Gmail returned no data (check that authorization completed)" -ForegroundColor Yellow }

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "======================================" -ForegroundColor DarkGray
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Say 'good morning' to Claude to get your first real brief." -ForegroundColor White
Write-Host ""
Write-Host "  To disconnect:   gog auth remove $gmail" -ForegroundColor DarkGray
Write-Host "  To reset config: del `"$envFile`"" -ForegroundColor DarkGray
Write-Host "======================================" -ForegroundColor DarkGray
