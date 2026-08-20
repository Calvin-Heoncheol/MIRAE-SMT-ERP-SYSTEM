@echo off
cd /d "%~dp0"
title Solder paste - make config

echo.
echo ========================================
echo  Solder paste ERP - config
echo ========================================
echo.

if exist "%~dp0config.json" goto EDIT
copy /Y "%~dp0config.example.json" "%~dp0config.json" >nul
echo Created config.json
echo Set ingestKey to the same value as Vercel SOLDER_PASTE_INGEST_KEY.
echo.

:EDIT
notepad "%~dp0config.json"

echo.
echo Next: run the send-log bat (2-...).
echo.
pause
