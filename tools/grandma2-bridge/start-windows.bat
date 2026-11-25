@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS e tente novamente.
  pause
  exit /b 1
)
echo Iniciando ponte local GrandMA2 em 127.0.0.1:17842
node server.mjs
pause
