# VS Code terminal commands:
#   .\run-bracket-validator.ps1
#   .\run-bracket-validator.ps1 main.js
#   .\run-bracket-validator.ps1 functions.js
#   node checkBrackets.js main.js
#   node checkBrackets.js functions.js

param(
  [string]$File = "main.js"
)

$scriptPath = Join-Path $PSScriptRoot "checkBrackets.js"
$targetPath = Join-Path $PSScriptRoot $File

if (-not (Test-Path $scriptPath)) {
  Write-Error "Missing checkBrackets.js in $PSScriptRoot"
  exit 1
}

if (-not (Test-Path $targetPath)) {
  Write-Error "Target file not found: $File"
  exit 1
}

node $scriptPath $targetPath
