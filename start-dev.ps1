# Script para iniciar backend y frontend en desarrollo
# Uso: .\start-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Iniciando Depo en modo desarrollo..." -ForegroundColor Cyan
Write-Host ""

# Primero detener cualquier proceso existente
Write-Host "Limpiando procesos anteriores..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Crear directorio para logs si no existe
$logDir = "$PSScriptRoot\logs"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Iniciar Backend en nueva ventana
Write-Host "Iniciando Backend..." -ForegroundColor Green
$backendLog = "$logDir\backend_$timestamp.log"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; npm run dev | Tee-Object '$backendLog'" -WindowStyle Normal

# Esperar para que el backend inicie
Start-Sleep -Seconds 4

# Iniciar Frontend en nueva ventana
Write-Host "Iniciando Frontend..." -ForegroundColor Green
$frontendLog = "$logDir\frontend_$timestamp.log"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev | Tee-Object '$frontendLog'" -WindowStyle Normal

Write-Host ""
Write-Host "Servicios iniciados:" -ForegroundColor Cyan
Write-Host "- Backend: http://localhost:4000" -ForegroundColor White
Write-Host "- Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Logs en: $logDir" -ForegroundColor Gray
Write-Host "Para detener: cierra las ventanas o ejecuta .\stop-dev.ps1" -ForegroundColor Gray
