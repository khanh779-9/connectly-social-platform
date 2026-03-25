<#
.SYNOPSIS
    Connectly Backend - Run All Services (hidden / background)
.DESCRIPTION
    Starts Identity, Social, Chat, Notification and Gateway as HIDDEN processes.
    - No visible windows open.
    - stdout/stderr of each service is written to backend\logs\<service>.log
    - PIDs are saved to backend\.run\pids.json (used by stop-all.ps1)
    - Waits until each port is actually listening before returning.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File run-all.ps1
#>

$ErrorActionPreference = "Continue"

# Resolve script dir = backend folder
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $BackendDir "logs"
$RunDir = Join-Path $BackendDir ".run"
$PidFile = Join-Path $RunDir "pids.json"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

# Ports come from backend\.env, the same source of truth the services read.
$EnvFile = Join-Path $BackendDir ".env"
$EnvValues = @{}
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        $trimmed = $line.Trim()
        if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
        $eq = $trimmed.IndexOf("=")
        if ($eq -le 0) { continue }
        $EnvValues[$trimmed.Substring(0, $eq).Trim()] = $trimmed.Substring($eq + 1).Trim()
    }
}

function Get-EnvPort([string]$name, [int]$fallback) {
    if ($EnvValues.ContainsKey($name)) {
        $parsed = 0
        if ([int]::TryParse($EnvValues[$name], [ref]$parsed)) { return $parsed }
    }
    return $fallback
}


$Services = @(
    @{ Name = "Identity";     Dir = "src\Services\Identity\Identity.API";     Exe = "Identity.API.exe";      Port = (Get-EnvPort "IDENTITY_HTTP_PORT" 5201) }
    @{ Name = "Social";       Dir = "src\Services\Social\Social.API";         Exe = "Social.API.exe";        Port = (Get-EnvPort "SOCIAL_HTTP_PORT" 5202) }
    @{ Name = "Chat";         Dir = "src\Services\Chat\Chat.API";             Exe = "Chat.API.exe";          Port = (Get-EnvPort "CHAT_HTTP_PORT" 5203) }
    @{ Name = "Notification"; Dir = "src\Services\Notification\Notification.API"; Exe = "Notification.API.exe"; Port = (Get-EnvPort "NOTIFICATION_HTTP_PORT" 5204) }
    @{ Name = "Gateway";      Dir = "src\ApiGateways\YarpApiGateway";         Exe = "YarpApiGateway.exe";    Port = (Get-EnvPort "GATEWAY_PORT" 5000) }
)

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host " Connectly Backend - starting 5 services (hidden)" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

# --- 1. Free the ports if something is still bound (leftovers from old runs) ---
foreach ($svc in $Services) {
    $port = $svc.Port
    $svcName = $svc.Name
    netstat -ano | Select-String (":" + $port + " ") | ForEach-Object {
        $parts = ($_ -split '\s+') | Where-Object { $_ -ne "" }
        $procId = $parts[$parts.Length - 1]
        if ($procId -match '^\d+$' -and $procId -ne "0") {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

# --- 2. Make sure the binaries exist; build once if they don't ---
$missing = @()
foreach ($svc in $Services) {
    $exe = Join-Path (Join-Path $BackendDir $svc.Dir) ("bin\Debug\net10.0\" + $svc.Exe)
    $svc.ExePath = $exe
    if (-not (Test-Path $exe)) { $missing += $svc }
}
if ($missing.Count -gt 0) {
    Write-Host " Some binaries missing, building solution first (one-time)..." -ForegroundColor Yellow
    Push-Location $BackendDir
    dotnet build Connectly.Backend.slnx -c Debug --nologo -v q
    Pop-Location
}

# --- 3. Launch each service hidden, redirect logs, remember PID ---
# .env (backend\.env) is found automatically via CWD walk-up, so no env vars needed.
# Only ASPNETCORE_ENVIRONMENT is pinned for predictable behavior.
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:DOTNET_ENVIRONMENT = "Development"

$pidRecords = @()
foreach ($svc in $Services) {
    $projectDir = Join-Path $BackendDir $svc.Dir
    $outLog = Join-Path $LogDir ($svc.Name.ToLower() + ".out.log")
    $errLog = Join-Path $LogDir ($svc.Name.ToLower() + ".err.log")

    # rotate old log so it always contains only the latest run
    if (Test-Path $outLog) { Remove-Item $outLog -Force -ErrorAction SilentlyContinue }
    if (Test-Path $errLog) { Remove-Item $errLog -Force -ErrorAction SilentlyContinue }

    # Launch via WMI (Win32_Process) so the process is owned by the WMI service
    # and fully detached from this console session - it survives after the
    # launching shell exits, which is what makes the truly "hidden background"
    # mode work (plain Start-Process children get killed with the session).
    $quotedExe = '"' + $svc.ExePath + '"'
    $quotedOut = '"' + $outLog + '"'
    $quotedErr = '"' + $errLog + '"'
    $exeName = $svc.Exe
    $commandLine = "cmd.exe /s /c `"$quotedExe > $quotedOut 2> $quotedErr`""

    try {
        $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
            CommandLine       = $commandLine
            CurrentDirectory  = $projectDir
        }
        if ($result.ReturnValue -ne 0) {
            throw ("WMI create failed with code " + $result.ReturnValue)
        }
        $pidRecords += [pscustomobject]@{ Name = $svc.Name; Port = $svc.Port; PID = 0 }
        Write-Host ("  {0,-13} launched -> http://localhost:{1}" -f $svc.Name, $svc.Port) -ForegroundColor Green
    }
    catch {
        $msg = $_.Exception.Message
        Write-Host ("  {0,-13} FAILED to launch: {1}" -f $svc.Name, $msg) -ForegroundColor Red
    }
}

# --- 5. Wait until every port is really listening ---
Write-Host ""
Write-Host " Waiting for ports to open..." -ForegroundColor Yellow
$deadline = (Get-Date).AddSeconds(90)
$pending = @($pidRecords)
while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 1500
    $listening = netstat -ano -p tcp | Out-String
    $still = @()
    foreach ($rec in $pending) {
        $listenLine = netstat -ano -p tcp | Select-String (":{0} .*LISTENING" -f $rec.Port) | Select-Object -First 1
        if ($listenLine) {
            $parts = ($listenLine -split '\s+') | Where-Object { $_ -ne "" }
            $procId = $parts[$parts.Length - 1]
            if ($procId -match '^\d+$') {
                $rec.PID = [int]$procId
            }
            Write-Host ("  {0,-13} OK  http://localhost:{1}" -f $rec.Name, $rec.Port) -ForegroundColor Green
        } else {
            $still += $rec
        }
    }
    $pending = $still
}

# --- 6. Persist PID file for stop-all.ps1 ---
$pidRecords | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

# --- 7. Report any service that failed to come up ---
foreach ($rec in $pending) {
    $svcInfo = $Services | Where-Object { $_.Name -eq $rec.Name }
    Write-Host ("  {0,-13} NOT READY on port {1} - check logs\{2}.err.log" -f $rec.Name, $rec.Port, $rec.Name.ToLower()) -ForegroundColor Red
    $errLog = Join-Path $LogDir ($rec.Name.ToLower() + ".err.log")
    if (Test-Path $errLog) {
        Get-Content $errLog -Tail 5 | ForEach-Object { Write-Host ("    " + $_) -ForegroundColor DarkYellow }
    }
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
$gatewayPort = ($Services | Where-Object { $_.Name -eq "Gateway" }).Port
Write-Host (" Gateway : http://localhost:{0}        (routes: /identity /social /chat /notification)" -f $gatewayPort) -ForegroundColor Cyan
Write-Host (" Login   : POST http://localhost:{0}/identity/api/v1/auth/login" -f $gatewayPort) -ForegroundColor Cyan
Write-Host " Logs    : backend\logs\*.log          Helpers: stop-all.bat" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

if ($pending.Count -gt 0) { exit 1 } else { exit 0 }
