Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

function Stop-ListenersOnPort {
  param([int]$Port)

  $pids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)

  foreach ($procId in $pids) {
    if ($procId) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-ListenersOnPort -Port 3001
Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host '[host] Stopped backend listeners on port 3001 and cloudflared processes.'
