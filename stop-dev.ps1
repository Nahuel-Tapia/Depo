# Script para detener backend y frontend
# Uso: .\stop-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Deteniendo servicios de Depo..." -ForegroundColor Red
Write-Host ""

# Detener jobs de PowerShell
$jobs = Get-Job -Name "Depo-*" -ErrorAction SilentlyContinue
if ($jobs) {
    Write-Host "Deteniendo jobs de PowerShell..." -ForegroundColor Yellow
    $jobs | Stop-Job -ErrorAction SilentlyContinue
    $jobs | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "Jobs detenidos: $($jobs.Count)" -ForegroundColor Green
}

# Detener procesos node.exe
Write-Host "Deteniendo procesos Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "Procesos detenidos: $($nodeProcesses.Count)" -ForegroundColor Green
} else {
    Write-Host "No hay procesos Node.js corriendo" -ForegroundColor Gray
}

# Liberar puertos comunes
$ports = @(4000, 4001, 5173, 5174, 5175, 5176)
Write-Host ""
Write-Host "Verificando puertos..." -ForegroundColor Yellow
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Puerto $port liberado" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Todos los servicios han sido detenidos." -ForegroundColor Red
