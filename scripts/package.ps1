$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $root "manifest.json") | ConvertFrom-Json
$releaseDir = Join-Path $root "release"
$stagingDir = Join-Path $releaseDir "staging"
$zipPath = Join-Path $releaseDir ("mermaid-plantuml-selection-preview-{0}.zip" -f $manifest.version)

Push-Location $root
try {
  npm run assets
  npm run build
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force $releaseDir | Out-Null
Remove-Item -Recurse -Force $stagingDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stagingDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "dist\*") $stagingDir
Remove-Item -Force (Join-Path $stagingDir "overlay-host.html") -ErrorAction SilentlyContinue
Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $stagingDir

Write-Host "Created Chrome Web Store package: $zipPath"
