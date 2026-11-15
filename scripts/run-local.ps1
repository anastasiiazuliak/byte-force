# Run from any directory; prefer this checkout's Python and optional portable Node.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonCandidates = @(
    (Join-Path $projectRoot '.venv\Scripts\python.exe'),
    (Join-Path $projectRoot '.validation\python\python.exe')
)
$pythonExecutable = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $pythonExecutable) {
    throw 'Create .venv and install the Python requirements as described in README.md.'
}
$portableNodeRoot = Join-Path $projectRoot '.validation\node'
if (Test-Path -LiteralPath $portableNodeRoot) {
    $portableNode = Get-ChildItem -LiteralPath $portableNodeRoot -Filter node.exe -Recurse | Select-Object -First 1
    if ($portableNode) {
        $env:Path = $portableNode.DirectoryName + ';' + $env:Path
    }
}
& $pythonExecutable (Join-Path $PSScriptRoot 'run-local.py') @args
exit $LASTEXITCODE
