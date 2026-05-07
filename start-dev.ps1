# Script para iniciar backend y frontend en desarrollo
# Uso: .\start-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Iniciando Depo en modo desarrollo..." -ForegroundColor Cyan
Write-Host ""

# Verificar si los puertos están ocupados y liberarlos si es necesario
$ports = @(4000, 4001, 5173, 5174, 5175, 5176)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "Liberando puerto $port..." -ForegroundColor Yellow
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

# Iniciar Backend
Write-Host "Iniciando Backend..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    Set-Location "c:\Users\leone\OneDrive\Desktop\Depo"
    npm run dev
} -Name "Depo-Backend"

# Esperar un poco para que el backend inicie
Start-Sleep -Seconds 3

# Iniciar Frontend
Write-Host "Iniciando Frontend..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "c:\Users\leone\OneDrive\Desktop\Depo\frontend"
    npm run dev
} -Name "Depo-Frontend"

Write-Host ""
Write-Host "Servicios iniciados:" -ForegroundColor Cyan
Write-Host "- Backend: http://localhost:4000" -ForegroundColor White
Write-Host "- Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Para ver logs: Get-Job | Receive-Job -Keep" -ForegroundColor Gray
Write-Host "Para detener: .\stop-dev.ps1" -ForegroundColor Gray
