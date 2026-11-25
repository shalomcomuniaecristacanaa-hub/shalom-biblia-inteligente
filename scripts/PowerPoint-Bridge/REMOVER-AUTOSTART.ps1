$startup = [Environment]::GetFolderPath("Startup")
$link = Join-Path $startup "Shalom PowerPoint Bridge.lnk"
if (Test-Path -LiteralPath $link) {
  Remove-Item -LiteralPath $link -Force
  Write-Host "Inicializacao automatica removida."
} else {
  Write-Host "Atalho automatico nao encontrado."
}
Write-Host "Para parar a instancia atual, encerre o processo PowerShell do auxiliar no Gerenciador de Tarefas."
