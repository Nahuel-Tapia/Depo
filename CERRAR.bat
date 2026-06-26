@echo off
chcp 65001 >nul
setlocal

REM ============================================
REM CERRAR.bat - Detiene Backend y Frontend
REM ============================================

echo.
echo ============================================
echo  CERRANDO DEPO - Backend y Frontend
echo ============================================
echo.

echo [1/3] Cerrando ventanas del proyecto...
taskkill /F /FI "WINDOWTITLE eq DEPO - Backend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq DEPO - Frontend*" 2>nul
echo [OK] Ventanas revisadas
echo.

echo [2/3] Liberando puertos del proyecto...
for %%p in (4000 5173 5174 5175 5176) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%%p "') do (
        taskkill /F /PID %%a 2>nul
        echo [OK] Puerto %%p liberado
    )
)
echo.

echo [3/3] Cierre completo
echo.
echo Si abriste servicios por PowerShell, tambien puedes ejecutar .\stop-dev.ps1
echo.

pause
endlocal
