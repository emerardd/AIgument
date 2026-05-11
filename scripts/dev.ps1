param(
    [int]$BackendPort = 5000,
    [int]$FrontendPort = 3000,
    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

function Resolve-Python {
    $candidates = @(
        (Join-Path $backendDir "venv\Scripts\python.exe"),
        (Join-Path $root "venv\Scripts\python.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        return $python.Source
    }

    throw "Python not found. Create a virtual environment or make python available on PATH."
}

function Resolve-Npm {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
    }
    if ($npm) {
        return $npm.Source
    }

    throw "npm not found. Install Node.js dependencies before starting the frontend."
}

function Stop-ProcessTree {
    param([System.Diagnostics.Process]$Process)

    if ($Process -and -not $Process.HasExited) {
        taskkill.exe /PID $Process.Id /T /F | Out-Null
    }
}

$pythonPath = Resolve-Python
$npmPath = Resolve-Npm

$backendProcess = $null
$frontendProcess = $null

try {
    Write-Host "Starting backend:  http://$HostAddress`:$BackendPort"
    $backendProcess = Start-Process `
        -FilePath $pythonPath `
        -ArgumentList @("-m", "uvicorn", "main:app", "--host", $HostAddress, "--port", [string]$BackendPort, "--reload") `
        -WorkingDirectory $backendDir `
        -NoNewWindow `
        -PassThru

    Write-Host "Starting frontend: http://$HostAddress`:$FrontendPort"
    $frontendProcess = Start-Process `
        -FilePath $npmPath `
        -ArgumentList @("run", "dev", "--", "--host", $HostAddress, "--port", [string]$FrontendPort) `
        -WorkingDirectory $frontendDir `
        -NoNewWindow `
        -PassThru

    Write-Host "Press Ctrl+C to stop both servers."

    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) {
        Start-Sleep -Milliseconds 500
    }

    if ($backendProcess.HasExited) {
        throw "Backend exited with code $($backendProcess.ExitCode)."
    }
    if ($frontendProcess.HasExited) {
        throw "Frontend exited with code $($frontendProcess.ExitCode)."
    }
}
finally {
    Write-Host "Stopping dev servers..."
    Stop-ProcessTree -Process $frontendProcess
    Stop-ProcessTree -Process $backendProcess
}
