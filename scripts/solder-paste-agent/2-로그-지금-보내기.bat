@echo off
cd /d "%~dp0"
title Solder paste - send log now

echo.
echo ========================================
echo  Solder paste log -^> ERP
echo ========================================
echo.

if exist "%~dp0config.json" goto SEND
echo ERROR: config.json not found.
echo Run the setup bat (1-...) first.
echo.
pause
exit /b 1

:SEND
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-solder-paste-log.ps1" -ConfigPath "%~dp0config.json"

echo.
echo ----------------------------------------
echo Check OK / SKIP / ERR above.
echo ERP: Production 1 - Solder paste
echo ----------------------------------------
echo.
pause
