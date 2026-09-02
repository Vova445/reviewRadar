$ErrorActionPreference = 'Stop'

$minimumVersion = [version]'22.13.0'
$bundledNode = 'C:\Users\Asus\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$systemNode = (Get-Command node -ErrorAction SilentlyContinue).Source

if (Test-Path -LiteralPath $bundledNode) {
  $nodeExecutable = $bundledNode
} elseif ($systemNode) {
  $detectedVersion = [version]((& $systemNode --version).TrimStart('v'))
  if ($detectedVersion -lt $minimumVersion) {
    throw "ReviewRadar requires Node.js $minimumVersion or newer. Current version: $detectedVersion. Install Node.js 22 LTS or newer, then run npm install."
  }
  $nodeExecutable = $systemNode
} else {
  throw 'Node.js was not found. Install Node.js 22 LTS or newer.'
}

$vinextCli = Join-Path $PSScriptRoot '..\node_modules\vinext\dist\cli.js'
if (-not (Test-Path -LiteralPath $vinextCli)) {
  throw 'Dependencies are missing. Run npm install first.'
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$viteCache = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'node_modules\.vite'))
if ((Test-Path -LiteralPath $viteCache) -and $viteCache.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  Remove-Item -LiteralPath $viteCache -Recurse -Force
}

& $nodeExecutable $vinextCli dev
exit $LASTEXITCODE
