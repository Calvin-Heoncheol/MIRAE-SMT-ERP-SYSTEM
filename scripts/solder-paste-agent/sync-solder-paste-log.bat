@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-solder-paste-log.ps1" -ConfigPath "%~dp0config.json"
exit /b %ERRORLEVEL%
