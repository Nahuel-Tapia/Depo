@echo off
chcp 65001 >nul
REM ============================================
REM CERRAR.bat - Detiene Backend y Frontend
REM ============================================

echo.
echo ============================================
echo  CERRANDO DEPO - Backend y Frontend
echo ============================================
echo.

REM ============================================
REM Cerrar terminales con titulo específico
REM ============================================
echo [1/3] Cerrando ventanas de terminales...
taskkill /F /FI "WINDOWTITLE eq DEPO - Backend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq DEPO - Frontend*" 2>nul
echo [OK] Ventanas cerradas
echo.

REM ============================================
REM Matar procesos Node.js
REM ============================================
echo [2/3] Deteniendo procesos Node.js...

REM Buscar y matar procesos node.exe que ejecuten npm o el proyecto
taskkill /F /IM node.exe 2>nul

REM Contar cuántos procesos quedan (para mostrar info)
for /f %%i in ('tasklist ^| find /c /i "node.exe"') do set NODE_COUNT=%%i

if %NODE_COUNT%==0 (
    echo [OK] Todos los procesos Node.js detenidos
) else (
    echo [!] Aún quedan %NODE_COUNT% procesos node.exe
)
echo.

REM ============================================
REM Liberar puertos comunes
REM ============================================
echo [3/3] Liberando puertos...

REM Puertos típicos usados por el proyecto
for %%p in (4000 4001 5173 5174 5175 5176) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p') do (
        taskkill /F /PID %%a 2>nul
        echo [OK] Puerto %%p liberado
    )
)

echo.
echo ============================================
echo  SERVICIOS DETENIDOS
echo ============================================
echo.
echo Puedes verificar con: tasklist ^| findstr node
echo.

pause
