$ErrorActionPreference = "Stop"
$bridge = Join-Path $PSScriptRoot "bridge.ps1"
if (-not (Test-Path -LiteralPath $bridge)) { throw "bridge.ps1 nao encontrado na mesma pasta." }
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "Shalom PowerPoint Bridge.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe")
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "' + $bridge + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = "Inicia o auxiliar local de controle do PowerPoint para o SPresenter"
$shortcut.WindowStyle = 7
$shortcut.Save()
# Inicia agora somente se o auxiliar ainda nao estiver ativo.
$alreadyRunning = $false
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:17843/health" -TimeoutSec 2
  $alreadyRunning = [bool]$health.connected
} catch { $alreadyRunning = $false }
if (-not $alreadyRunning) {
  Start-Process -FilePath $shortcut.TargetPath -ArgumentList $shortcut.Arguments -WindowStyle Hidden
}
Write-Host "Inicializacao automatica configurada para os proximos logins."
Write-Host "O auxiliar tambem foi iniciado nesta sessao."
Write-Host "Abra o SPresenter > Culto ao Vivo e carregue o PowerPoint."
Start-Sleep -Seconds 5
