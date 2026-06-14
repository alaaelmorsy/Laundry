@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0.."

set REPORT=%~dp0..\data\diagnose-report.txt
if not exist "%~dp0..\data" mkdir "%~dp0..\data"

echo ═══════════════════════════════════════════════════ > "%REPORT%"
echo PLUS Laundry - Diagnostic Report >> "%REPORT%"
echo Generated: %DATE% %TIME% >> "%REPORT%"
echo ═══════════════════════════════════════════════════ >> "%REPORT%"
echo. >> "%REPORT%"

echo [1] Install directory: %CD% >> "%REPORT%"
echo. >> "%REPORT%"

echo [2] Files check >> "%REPORT%"
if exist laundry-app.exe (echo   ✓ laundry-app.exe found >> "%REPORT%") else (echo   ✗ laundry-app.exe MISSING >> "%REPORT%")
if exist .env (echo   ✓ .env found >> "%REPORT%") else (echo   ✗ .env MISSING >> "%REPORT%")
if exist nssm.exe (echo   ✓ nssm.exe found >> "%REPORT%") else (echo   ✗ nssm.exe MISSING >> "%REPORT%")
if exist ssl\localhost-cert.pem (echo   ✓ SSL cert found >> "%REPORT%") else (echo   ✗ SSL cert MISSING >> "%REPORT%")
echo. >> "%REPORT%"

echo [3] Service status >> "%REPORT%"
sc query LaundryPlusApp >> "%REPORT%" 2>&1
echo. >> "%REPORT%"

echo [4] MySQL service status >> "%REPORT%"
sc query type= service state= all | findstr /I "MySQL" >> "%REPORT%" 2>&1
echo. >> "%REPORT%"

echo [5] Port 3306 (MySQL) listeners >> "%REPORT%"
netstat -an | findstr ":3306" >> "%REPORT%" 2>&1
echo. >> "%REPORT%"

echo [6] Port 3000 (App) listeners >> "%REPORT%"
netstat -an | findstr ":3000" >> "%REPORT%" 2>&1
echo. >> "%REPORT%"

echo [7] Port 3443 (HTTPS) listeners >> "%REPORT%"
netstat -an | findstr ":3443" >> "%REPORT%" 2>&1
echo. >> "%REPORT%"

echo [8] .env content >> "%REPORT%"
if exist .env (type .env >> "%REPORT%") else (echo   .env not found >> "%REPORT%")
echo. >> "%REPORT%"

echo [9] Last 50 lines of boot.log >> "%REPORT%"
if exist data\logs\boot.log (
  powershell -Command "Get-Content 'data\logs\boot.log' -Tail 50" >> "%REPORT%" 2>&1
) else (
  echo   boot.log not found >> "%REPORT%"
)
echo. >> "%REPORT%"

echo [10] Last 50 lines of service-stderr.log >> "%REPORT%"
if exist data\logs\service-stderr.log (
  powershell -Command "Get-Content 'data\logs\service-stderr.log' -Tail 50" >> "%REPORT%" 2>&1
) else (
  echo   service-stderr.log not found >> "%REPORT%"
)
echo. >> "%REPORT%"

echo [11] Last 30 lines of service-stdout.log >> "%REPORT%"
if exist data\logs\service-stdout.log (
  powershell -Command "Get-Content 'data\logs\service-stdout.log' -Tail 30" >> "%REPORT%" 2>&1
) else (
  echo   service-stdout.log not found >> "%REPORT%"
)
echo. >> "%REPORT%"

echo ═══════════════════════════════════════════════════ >> "%REPORT%"
echo Report complete. >> "%REPORT%"
echo ═══════════════════════════════════════════════════ >> "%REPORT%"

echo.
echo تم إنشاء التقرير في: %REPORT%
echo.
notepad "%REPORT%"
endlocal
