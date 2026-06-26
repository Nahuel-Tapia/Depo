@echo off
chcp 65001 >nul
setlocal

REM ============================================
REM INICIAR.bat - Inicia Backend y Frontend
REM ============================================

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo ============================================
echo  INICIANDO DEPO - Backend y Frontend
echo ============================================
echo.

if not exist "%ROOT%\package.json" (
    echo [ERROR] No se encuentra package.json en la raiz del proyecto
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%\frontend\package.json" (
    echo [ERROR] No se encuentra frontend\package.json
    echo.
    pause
    exit /b 1
)

echo [0/3] Liberando puertos 4000 y 5173...
for %%p in (4000 5173 5174 5175 5176) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%%p "') do (
        taskkill /F /PID %%a 2>nul
    )
)
echo [OK] Puertos revisados
echo.

echo [1/3] Iniciando BACKEND en puerto 4000...
start "DEPO - Backend" cmd /k ""cd /d "%ROOT%" && echo. && echo ============================================ && echo  BACKEND - npm run dev && echo ============================================ && echo. && npm run dev"

ping -n 4 127.0.0.1 >nul

echo [2/3] Iniciando FRONTEND en puerto 5173...
start "DEPO - Frontend" cmd /k ""cd /d "%ROOT%\frontend" && echo. && echo ============================================ && echo  FRONTEND - npm run dev && echo ============================================ && echo. && npm run dev"

echo.
echo [3/3] Servicios lanzados
echo.
echo Backend:  http://localhost:4000
echo Frontend: http://localhost:5173
echo.
echo Para cerrar: haz doble click en CERRAR.bat
echo.

timeout /t 3 /nobreak >nul
endlocal
