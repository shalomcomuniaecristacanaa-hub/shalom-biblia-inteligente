@echo off
title Shalom - Configurar inicio automatico do PowerPoint
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0INSTALAR-AUTOSTART.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel configurar o inicio automatico.
  pause
  exit /b 1
)
echo.
echo Configuracao concluida. O auxiliar iniciara automaticamente no login do Windows.
pause
