# Script para detener backend y frontend
# Uso: .\stop-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

$projectRoot = $PSScriptRoot
$logsDir = Join-Path $projectRoot "logs"
$runtimeDir = Join-Path $logsDir "runtime"
$backendPidFile = Join-Path $runtimeDir "backend-shell.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend-shell.pid"

function Stop-ProcessByIdFile {
    param(
        [string]$PidFile
    )

    if (!(Test-Path $PidFile)) {
        return $false
    }

    $stopped = $false
    $pidValue = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pidValue) {
        try {
            Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
            $stopped = $true
        } catch {}
    }

    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return $stopped
}

function Stop-DepoProcess {
    param(
        [string]$CommandPattern
    )

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -in @("node.exe", "powershell.exe", "cmd.exe") -and
            $_.CommandLine -match [regex]::Escape($projectRoot) -and
            $_.CommandLine -match $CommandPattern
        } |
        ForEach-Object {
            try {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            } catch {}
        }
}

Write-Host "Deteniendo servicios de Depo..." -ForegroundColor Red
Write-Host ""

Write-Host "Deteniendo procesos del proyecto..." -ForegroundColor Yellow
[void](Stop-ProcessByIdFile -PidFile $backendPidFile)
[void](Stop-ProcessByIdFile -PidFile $frontendPidFile)

Stop-DepoProcess "backend/src/server.js"
Stop-DepoProcess "vite"

Start-Sleep -Seconds 1

$ports = @(4000, 5173, 5174, 5175, 5176)
Write-Host ""
Write-Host "Liberando puertos..." -ForegroundColor Yellow
foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "  Puerto $port liberado" -ForegroundColor Green
            }
        }
    } catch {}
}

Write-Host ""
Write-Host "Todos los servicios del proyecto han sido detenidos." -ForegroundColor Red
Write-Host "Puedes verificar con: Get-NetTCPConnection -LocalPort 4000,5173" -ForegroundColor Gray
