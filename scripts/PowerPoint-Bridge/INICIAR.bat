@echo off
title Shalom - Controle PowerPoint
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0bridge.ps1"
pause
