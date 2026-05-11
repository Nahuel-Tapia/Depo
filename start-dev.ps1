# Script para iniciar backend y frontend en desarrollo
# Uso: .\start-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

$projectRoot = $PSScriptRoot
$logsDir = Join-Path $projectRoot "logs"
$runtimeDir = Join-Path $logsDir "runtime"
$backendPidFile = Join-Path $runtimeDir "backend-shell.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend-shell.pid"

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

Write-Host "Iniciando Depo en modo desarrollo..." -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

if (!(Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

Write-Host "Limpiando procesos anteriores del proyecto..." -ForegroundColor Yellow
Stop-DepoProcess "backend/src/server.js"
Stop-DepoProcess "vite"

foreach ($pidFile in @($backendPidFile, $frontendPidFile)) {
    if (Test-Path $pidFile) {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "Iniciando Backend..." -ForegroundColor Green
$backendLog = Join-Path $logsDir "backend_$timestamp.log"
$backendProc = Start-Process powershell `
    -ArgumentList "-NoExit", "-Command", "Set-Location '$projectRoot'; npm run dev | Tee-Object '$backendLog'" `
    -WindowStyle Normal `
    -PassThru
$backendProc.Id | Set-Content $backendPidFile

Start-Sleep -Seconds 4

Write-Host "Iniciando Frontend..." -ForegroundColor Green
$frontendLog = Join-Path $logsDir "frontend_$timestamp.log"
$frontendProc = Start-Process powershell `
    -ArgumentList "-NoExit", "-Command", "Set-Location '$projectRoot\frontend'; npm run dev | Tee-Object '$frontendLog'" `
    -WindowStyle Normal `
    -PassThru
$frontendProc.Id | Set-Content $frontendPidFile

Write-Host ""
Write-Host "Servicios iniciados:" -ForegroundColor Cyan
Write-Host "- Backend: http://localhost:4000" -ForegroundColor White
Write-Host "- Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Logs en: $logsDir" -ForegroundColor Gray
Write-Host "Para detener: cierra las ventanas o ejecuta .\stop-dev.ps1" -ForegroundColor Gray
