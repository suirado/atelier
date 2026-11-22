# Atelier - a small web server for this folder, built into Windows (no Python needed).
# "Deschide Atelier.bat" starts it. Only this computer can open the site (localhost),
# not the rest of the Wi-Fi. Close its window to stop it.
param([int]$Port = 5500, [switch]$NoBrowser)

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$url = "http://localhost:$Port/"
$host.UI.RawUI.WindowTitle = "Atelier server"

$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".mjs" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"; ".svg" = "image/svg+xml"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".webp" = "image/webp"; ".gif" = "image/gif"
  ".ico" = "image/x-icon"; ".glb" = "model/gltf-binary"; ".gltf" = "model/gltf+json"; ".bin" = "application/octet-stream"
  ".hdr" = "application/octet-stream"; ".wasm" = "application/wasm"; ".mp4" = "video/mp4"; ".webm" = "video/webm"
  ".py" = "text/plain; charset=utf-8"; ".txt" = "text/plain; charset=utf-8"; ".md" = "text/plain; charset=utf-8"
  ".woff2" = "font/woff2"; ".woff" = "font/woff"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try {
  $listener.Start()
} catch {
  # Something already serves this address (an Atelier window left open, say): just open the site
  Write-Host "Port $Port is already in use, opening the site that is already running."
  if (-not $NoBrowser) { Start-Process $url }
  Start-Sleep -Seconds 3
  exit
}

Write-Host ""
Write-Host "  Atelier is running at $url"
Write-Host "  Keep this window open while you use the site. Close it to stop."
Write-Host ""
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
    if ($path -eq "" -or $path.EndsWith("/")) { $path += "index.html" }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    # never anything outside the site's folder
    if (-not $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("Not found")
      $res.ContentType = "text/plain; charset=utf-8"
      $res.OutputStream.Write($msg, 0, $msg.Length)
    } else {
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
      $res.AddHeader("Cache-Control", "no-cache")
      $stream = [IO.File]::OpenRead($file)
      try {
        $res.ContentLength64 = $stream.Length
        if ($ctx.Request.HttpMethod -ne "HEAD") { $stream.CopyTo($res.OutputStream) }
      } finally { $stream.Dispose() }
    }
  } catch {
    # the browser stopped waiting (a page left mid-load): nothing to do
  } finally {
    try { $res.OutputStream.Close() } catch {}
  }
}
