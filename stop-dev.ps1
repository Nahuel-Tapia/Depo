# Script para detener backend y frontend
# Uso: .\stop-dev.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Deteniendo servicios de Depo..." -ForegroundColor Red
Write-Host ""

# Detener todos los procesos node.exe (backend y frontend)
Write-Host "Deteniendo procesos Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
$count = 0
foreach ($proc in $nodeProcesses) {
    try {
        $proc.Kill()
        $proc.WaitForExit(2000)
        $count++
    } catch {}
}
if ($count -gt 0) {
    Write-Host "Procesos Node.js detenidos: $count" -ForegroundColor Green
} else {
    Write-Host "No hay procesos Node.js corriendo" -ForegroundColor Gray
}

# Esperar un momento
Start-Sleep -Seconds 1

# Verificar y matar cualquier proceso que use los puertos
$ports = @(4000, 4001, 5173, 5174, 5175, 5176, 3000, 3001)
Write-Host ""
Write-Host "Liberando puertos..." -ForegroundColor Yellow
foreach ($port in $ports) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conn -and $conn.OwningProcess) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  Puerto $port liberado" -ForegroundColor Green
        }
    } catch {}
}

# Tambien buscar y cerrar ventanas de PowerShell con titulo especifico
Write-Host ""
Write-Host "Verificando ventanas de terminal..." -ForegroundColor Yellow
Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "npm|backend|frontend|depo"
} | ForEach-Object {
    try {
        $_.CloseMainWindow() | Out-Null
        Write-Host "  Ventana cerrada: $($_.MainWindowTitle)" -ForegroundColor Green
    } catch {}
}

Write-Host ""
Write-Host "Todos los servicios han sido detenidos." -ForegroundColor Red
Write-Host "Puedes verificar con: Get-Process node" -ForegroundColor Gray
