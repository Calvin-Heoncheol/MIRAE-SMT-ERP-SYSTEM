@echo off
cd /d "%~dp0"
title Solder paste - scheduled task

echo.
echo ========================================
echo  Register auto sync every 3 minutes
echo  Administrator required
echo ========================================
echo.

if exist "%~dp0config.json" goto ADMIN
echo ERROR: config.json not found.
echo Run the setup bat (1-...) first.
echo.
pause
exit /b 1

:ADMIN
net session >nul 2>&1
if %errorlevel%==0 goto REGISTER
echo Restarting as Administrator...
powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:REGISTER
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0register-scheduled-task.ps1" -ConfigPath "%~dp0config.json"

echo.
echo You can still test with the send-log bat (2-...).
echo.
pause
