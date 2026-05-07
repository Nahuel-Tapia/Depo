@echo off
chcp 65001 >nul
REM ============================================
REM INICIAR.bat - Inicia Backend y Frontend
REM ============================================

echo.
echo ============================================
echo  INICIANDO DEPO - Backend y Frontend
echo ============================================
echo.

REM ============================================
REM Liberar puerto 4000 si está ocupado
REM ============================================
echo [0/3] Liberando puerto 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000') do (
    taskkill /F /PID %%a 2>nul
    echo [OK] Proceso en puerto 4000 detenido
)
echo.

REM Verificar que exista la carpeta backend
if not exist "backend\" (
    echo [ERROR] No se encuentra la carpeta 'backend'
    echo.
    pause
    exit /b 1
)

REM Verificar que exista la carpeta frontend
if not exist "frontend\" (
    echo [ERROR] No se encuentra la carpeta 'frontend'
    echo.
    pause
    exit /b 1
)

echo [OK] Carpetas verificadas
echo.

REM ============================================
REM Iniciar Backend en nueva terminal (puerto 4000)
REM ============================================
echo [1/3] Iniciando BACKEND en puerto 4000...
start "DEPO - Backend" cmd /k "cd /d "%CD%\backend" && echo. && echo ============================================ && echo  BACKEND - npm run dev && echo ============================================ && echo. && npm run dev"

REM Esperar 3 segundos para que el backend inicie
ping -n 4 127.0.0.1 >nul

REM ============================================
REM Iniciar Frontend en nueva terminal (puerto 5173)
REM ============================================
echo [2/3] Iniciando FRONTEND...
start "DEPO - Frontend" cmd /k "cd /d "%CD%\frontend" && echo. && echo ============================================ && echo  FRONTEND - npm run dev && echo ============================================ && echo. && npm run dev"

echo.
echo [3/3] Verificando servicios...
echo.
echo ============================================
echo  SERVICIOS INICIADOS
echo ============================================
echo.
echo Backend:  http://localhost:4000
echo Frontend: http://localhost:5173
echo.
echo Para cerrar: haz doble click en CERRAR.bat
echo.

REM Mantener ventana abierta un momento para ver el mensaje
timeout /t 3 /nobreak >nul
