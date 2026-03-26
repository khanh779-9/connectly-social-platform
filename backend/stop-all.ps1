<#
.SYNOPSIS
    Connectly Backend - Stop All Services
.DESCRIPTION
    Stops the hidden background services started by run-all.ps1:
    1. Kills the exact PIDs recorded in backend\.run\pids.json
    2. Falls back to killing anything still bound to ports 5000 / 5201-5204
#>

$ErrorActionPreference = "Continue"
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path (Join-Path $BackendDir ".run") "pids.json"
$AlphabeticalPIDMap = @{}

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host " Connectly Backend - stopping all services" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

# --- 1. Kill recorded PIDs ---
if (Test-Path $PidFile) {
    try {
        $records = Get-Content $PidFile -Raw | ConvertFrom-Json
        foreach ($rec in $records) {
            $proc = Get-Process -Id $rec.PID -ErrorAction SilentlyContinue
            if ($proc) {
                Stop-Process -Id $rec.PID -Force -ErrorAction SilentlyContinue
                Write-Host ("  {0,-13} stopped (PID {1})" -f $rec.Name, $rec.PID) -ForegroundColor Green
            } else {
                Write-Host ("  {0,-13} not running" -f $rec.Name) -ForegroundColor DarkGray
            }
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    } catch {
        $msg = $_.Exception.Message
        Write-Host ("  Could not read PID file: {0}" -f $msg) -ForegroundColor Yellow
    }
} else {
    Write-Host "  No PID file (services probably not started by run-all.ps1)" -ForegroundColor DarkGray
}

# --- 2. Fallback: free the ports ---
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

$ports = @(
    (Get-EnvPort "GATEWAY_PORT" 5000),
    (Get-EnvPort "IDENTITY_HTTP_PORT" 5201),
    (Get-EnvPort "SOCIAL_HTTP_PORT" 5202),
    (Get-EnvPort "CHAT_HTTP_PORT" 5203),
    (Get-EnvPort "NOTIFICATION_HTTP_PORT" 5204)
)
foreach ($port in $ports) {
    netstat -ano | Select-String (":" + $port + " ") | ForEach-Object {
        $parts = ($_ -split '\s+') | Where-Object { $_ -ne "" }
        $procId = $parts[$parts.Length - 1]
        if ($procId -match '^\d+$' -and $procId -ne "0") {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host ("  Freed port {0} (killed PID {1})" -f $port, $procId) -ForegroundColor Green
            }
        }
    }
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host " All Connectly services stopped." -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
