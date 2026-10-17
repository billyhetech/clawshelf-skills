# ClawShelf Quick Reminder — One-click setup (Windows)
# Run in PowerShell:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\setup.ps1

$ErrorActionPreference = "Stop"

$openclawDir  = "$env:USERPROFILE\.openclaw"
$binDir       = "$openclawDir\bin"
$daemonSrc    = Join-Path $PSScriptRoot "remind-daemon.py"
$daemonDest   = "$binDir\remind-daemon.py"
$pidFile      = "$openclawDir\remind-daemon.pid"
$taskName     = "ClawShelf Reminder Daemon"

function Write-Step($msg) { Write-Host "`n$msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  v $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  > $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

Clear-Host
Write-Host "======================================" -ForegroundColor DarkGray
Write-Host "  ClawShelf Quick Reminder — Setup" -ForegroundColor White
Write-Host "======================================" -ForegroundColor DarkGray

# ── Step 1: Check Python 3 ───────────────────────────────────────────────────

Write-Step "Step 1/4  Check Python 3"

$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3") {
            $pythonCmd = $cmd
            Write-OK "Found $cmd ($ver)"
            break
        }
    } catch { }
}

if (-not $pythonCmd) {
    Write-Host ""
    Write-Host "  Python 3 not found. Install it first:" -ForegroundColor Red
    Write-Host "  Option A: winget install Python.Python.3" -ForegroundColor White
    Write-Host "  Option B: https://www.python.org/downloads/" -ForegroundColor White
    Write-Host "  Then re-run this script." -ForegroundColor Yellow
    exit 1
}

# Find pythonw.exe (windowless Python, no console flash)
$pythonwCmd = $null
try {
    $pythonPath = (Get-Command $pythonCmd).Source
    $pythonwPath = Join-Path (Split-Path $pythonPath) "pythonw.exe"
    if (Test-Path $pythonwPath) {
        $pythonwCmd = $pythonwPath
        Write-OK "Found pythonw.exe (windowless mode)"
    }
} catch { }

if (-not $pythonwCmd) {
    Write-Warn "pythonw.exe not found — daemon will show a brief console window at startup"
    $pythonwCmd = $pythonCmd
}

# ── Step 2: Install daemon ───────────────────────────────────────────────────

Write-Step "Step 2/4  Install daemon"

if (-not (Test-Path $daemonSrc)) {
    Write-Err "remind-daemon.py not found at: $daemonSrc
  Make sure you run setup.ps1 from the skills\quick-reminder\scripts\ directory."
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item $daemonSrc $daemonDest -Force
Write-OK "Daemon installed to $daemonDest"

# ── Step 3: Configure auto-start (Task Scheduler) ───────────────────────────

Write-Step "Step 3/4  Configure auto-start"

# Remove existing task if present
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
} catch { }

$action  = New-ScheduledTaskAction -Execute $pythonwCmd -Argument "`"$daemonDest`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Limited `
    -Force | Out-Null

Write-OK "Task Scheduler entry created: '$taskName' (starts at each login)"

# ── Step 4: Start daemon now + verify ────────────────────────────────────────

Write-Step "Step 4/4  Start daemon and verify"

# Kill any existing instance
if (Test-Path $pidFile) {
    try {
        $oldPid = [int](Get-Content $pidFile)
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    } catch { }
}

Write-Info "Starting daemon now..."
Start-Process -FilePath $pythonwCmd -ArgumentList "`"$daemonDest`"" -WindowStyle Hidden
Start-Sleep -Seconds 3

# Confirm it's running
$running = $false
if (Test-Path $pidFile) {
    try {
        $pid = [int](Get-Content $pidFile)
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-OK "Daemon is running (PID $pid)"
            $running = $true
        }
    } catch { }
}

if (-not $running) {
    Write-Warn "Could not confirm daemon status — check $openclawDir\remind-daemon.log"
}

# Send test notification
Write-Info "Sending test notification..."
$testScript = @'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$template = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>⏰ ClawShelf</text>
      <text>Reminder daemon is running!</text>
    </binding>
  </visual>
</toast>
"@

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('ClawShelf').Show($toast)
'@

try {
    $null = Invoke-Expression $testScript
    Write-OK "Test notification sent — check your notification tray"
} catch {
    Write-Warn "Could not send toast notification: $_"
    Write-Warn "You may need to enable notifications for PowerShell in Windows Settings > Notifications"
}

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "======================================" -ForegroundColor DarkGray
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Reminders written by any agent to" -ForegroundColor White
Write-Host "  $openclawDir\reminders.json" -ForegroundColor White
Write-Host "  will now be delivered as Windows" -ForegroundColor White
Write-Host "  toast notifications." -ForegroundColor White
Write-Host ""
Write-Host "  Daemon log:   $openclawDir\remind-daemon.log" -ForegroundColor DarkGray
Write-Host "  Stop daemon:  Stop-Process -Id (Get-Content '$pidFile')" -ForegroundColor DarkGray
Write-Host "  Restart:      Start-ScheduledTask '$taskName'" -ForegroundColor DarkGray
Write-Host "======================================" -ForegroundColor DarkGray
