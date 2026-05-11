$ErrorActionPreference = "Stop"

$workspace = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $workspace "backend"
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"

if (Test-Path -LiteralPath $venvPython) {
    $python = $venvPython
} else {
    $python = "python"
}

Push-Location $backendDir
try {
    & $python -m pytest
} finally {
    Pop-Location
}
