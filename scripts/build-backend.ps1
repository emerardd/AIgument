$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$DistDir = Join-Path $ProjectRoot "dist\backend"
$WorkDir = Join-Path $ProjectRoot "build\pyinstaller"
$PackageDir = Join-Path $DistDir "AIgumentBackend"

$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

$PyInstallerCheck = & $PythonExe -m PyInstaller --version 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not installed for $PythonExe. Run `"$PythonExe -m pip install pyinstaller`" first."
}

$Arguments = @(
    "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onedir",
    "--name", "AIgumentBackend",
    "--distpath", $DistDir,
    "--workpath", $WorkDir,
    "--specpath", $WorkDir,
    "--add-data", "$BackendDir\prompts.yaml;backend",
    "--add-data", "$BackendDir\.env.example;backend",
    "$BackendDir\main.py"
)

& $PythonExe @Arguments

if (-not (Test-Path (Join-Path $PackageDir "AIgumentBackend.exe"))) {
    throw "Backend package was not created successfully."
}
