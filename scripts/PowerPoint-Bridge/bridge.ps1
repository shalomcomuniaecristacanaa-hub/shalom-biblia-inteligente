# Shalom PowerPoint Bridge
# Executa no computador Windows com Microsoft PowerPoint instalado.
# Escuta somente em loopback; nao exponha esta porta na rede.
$ErrorActionPreference = "Stop"
$port = 17843
$uploadDir = Join-Path $env:TEMP "ShalomPowerPoint"
New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
$powerPoint = $null
$presentation = $null
$slideShow = $null
$blackScreen = $false

function Send-Json($context, $status, $data) {
  $json = $data | ConvertTo-Json -Depth 6 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $context.Response.StatusCode = $status
  $context.Response.ContentType = "application/json; charset=utf-8"
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.Close()
}
function Get-Status {
  $running = $false
  $current = 0
  $total = 0
  if ($null -ne $slideShow) {
    try {
      $current = [int]$slideShow.View.CurrentShowPosition
      $total = [int]$presentation.Slides.Count
      $running = $true
    } catch { $running = $false }
  }
  return @{ connected = $true; powerpoint = ($null -ne $powerPoint); presentationOpen = ($null -ne $presentation); running = $running; file = $(if ($presentation) { [string]$presentation.Name } else { "" }); slide = $current; total = $total; black = $blackScreen }
}
function Ensure-PowerPoint {
  if ($null -eq $powerPoint) {
    try { $script:powerPoint = New-Object -ComObject PowerPoint.Application }
    catch { throw "Microsoft PowerPoint nao encontrado. Instale o PowerPoint desktop e tente novamente. Detalhe: $($_.Exception.Message)" }
    $script:powerPoint.Visible = -1
  }
}
function Ensure-SlideShow {
  if ($null -eq $presentation) { throw "Nenhuma apresentacao foi aberta." }
  if ($null -eq $slideShow) {
    $script:slideShow = $script:presentation.SlideShowSettings.Run()
    Start-Sleep -Milliseconds 350
  }
}
Write-Host "Shalom PowerPoint Bridge ativo em http://127.0.0.1:$port/"
Write-Host "Mantenha esta janela aberta durante o culto. Ctrl+C encerra o auxiliar."
try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $request = $context.Request
      $response = $context.Response
      $response.Headers.Add("Access-Control-Allow-Origin", "*")
      $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-File-Name")
      if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 204
        $response.Close()
        continue
      }
      $route = $request.Url.AbsolutePath.TrimEnd("/")
      if ($request.HttpMethod -eq "GET" -and $route -eq "/health") {
        Send-Json $context 200 (Get-Status)
        continue
      }
      if ($request.HttpMethod -eq "GET" -and $route -eq "/status") {
        Send-Json $context 200 (Get-Status)
        continue
      }
      if ($request.HttpMethod -eq "POST" -and $route -eq "/upload") {
        $name = [System.Uri]::UnescapeDataString([string]$request.Headers["X-File-Name"])
        $name = [System.IO.Path]::GetFileName($name)
        $extension = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
        if ($extension -notin @(".ppt", ".pptx")) { throw "Selecione um arquivo .ppt ou .pptx." }
        if ($request.ContentLength64 -gt 209715200) { throw "O arquivo excede o limite de 200 MB." }
        $safeName = [guid]::NewGuid().ToString("N") + $extension
        $path = Join-Path $uploadDir $safeName
        $stream = [System.IO.File]::Create($path)
        try { $request.InputStream.CopyTo($stream) } finally { $stream.Dispose() }
        Send-Json $context 200 @{ uploaded = $true; path = $path; name = $name; bytes = (Get-Item $path).Length }
        continue
      }
      if ($request.HttpMethod -eq "POST") {
        $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
        try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $data = @{}
        if ($body) { $data = $body | ConvertFrom-Json }
        switch ($route) {
          "/open" {
            $path = [string]$data.path
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Arquivo enviado nao encontrado no computador." }
            if ([System.IO.Path]::GetExtension($path).ToLowerInvariant() -notin @(".ppt", ".pptx")) { throw "Formato nao suportado. Use .ppt ou .pptx." }
            Ensure-PowerPoint
            if ($null -ne $slideShow) { try { $slideShow.View.Exit() } catch {}; $script:slideShow = $null }
            if ($null -ne $presentation) { try { $presentation.Close() } catch {}; $script:presentation = $null }
            $script:presentation = $powerPoint.Presentations.Open($path, -1, 0, -1)
            $script:slideShow = $null
            $script:blackScreen = $false
            Send-Json $context 200 (Get-Status)
          }
          "/play" {
            Ensure-PowerPoint
            Ensure-SlideShow
            Send-Json $context 200 (Get-Status)
          }
          "/next" {
            Ensure-SlideShow
            $slideShow.View.Next()
            Send-Json $context 200 (Get-Status)
          }
          "/previous" {
            Ensure-SlideShow
            $slideShow.View.Previous()
            Send-Json $context 200 (Get-Status)
          }
          "/goto" {
            Ensure-SlideShow
            $number = [int]$data.slide
            if ($number -lt 1 -or $number -gt [int]$presentation.Slides.Count) { throw "Numero de slide fora do intervalo." }
            $slideShow.View.GotoSlide($number)
            Send-Json $context 200 (Get-Status)
          }
          "/black" {
            Ensure-SlideShow
            if ($blackScreen) { $slideShow.View.State = 1; $script:blackScreen = $false }
            else { $slideShow.View.State = 3; $script:blackScreen = $true }
            Send-Json $context 200 (Get-Status)
          }
          "/end" {
            if ($null -ne $slideShow) { try { $slideShow.View.Exit() } catch {}; $script:slideShow = $null }
            $script:blackScreen = $false
            Send-Json $context 200 (Get-Status)
          }
          "/close" {
            if ($null -ne $slideShow) { try { $slideShow.View.Exit() } catch {}; $script:slideShow = $null }
            if ($null -ne $presentation) { try { $presentation.Close() } catch {}; $script:presentation = $null }
            Send-Json $context 200 (Get-Status)
          }
          default { Send-Json $context 404 @{ error = "Comando nao reconhecido." } }
        }
        continue
      }
      Send-Json $context 404 @{ error = "Rota nao encontrada." }
    } catch {
      try { Send-Json $context 500 @{ error = $_.Exception.Message } } catch {}
    }
  }
} finally {
  try { $listener.Stop(); $listener.Close() } catch {}
  if ($null -ne $slideShow) { try { $slideShow.View.Exit() } catch {} }
  if ($null -ne $presentation) { try { $presentation.Close() } catch {} }
  if ($null -ne $powerPoint) { try { $powerPoint.Quit() } catch {} }
}
