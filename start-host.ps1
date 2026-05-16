param(
  [switch]$SkipTunnel,
  [switch]$KeepExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

function Stop-ListenersOnPort {
  param([int]$Port)

  $pids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)

  foreach ($procId in $pids) {
    if ($procId) {
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
      } catch {
        Write-Warning "Could not stop PID $procId on port ${Port}: $($_.Exception.Message)"
      }
    }
  }
}

if (-not $KeepExisting) {
  # Ensure clean startup for backend host port.
  Stop-ListenersOnPort -Port 3001

  # Stop existing cloudflared processes so one tunnel/session is active.
  Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      Stop-Process -Id $_.Id -Force -ErrorAction Stop
    } catch {
      Write-Warning "Could not stop cloudflared PID $($_.Id): $($_.Exception.Message)"
    }
  }
}

$serverCmd = "Set-Location '$PSScriptRoot'; npm run server:start"
Start-Process -FilePath 'pwsh' -ArgumentList @('-NoExit', '-Command', $serverCmd) -WindowStyle Normal | Out-Null

Write-Host '[host] Waiting for backend on http://localhost:3001/health ...'
$ready = $false
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Milliseconds 400
  try {
    $resp = Invoke-WebRequest -UseBasicParsing http://localhost:3001/health -TimeoutSec 2
    if ($resp.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    # keep waiting
  }
}

if (-not $ready) {
  Write-Warning '[host] Backend did not report healthy in time. Check the new server window.'
} else {
  Write-Host '[host] Backend is up.'
}

Write-Host '[host] Local URL: http://localhost:3001/multiplayer.html'

if ($SkipTunnel) {
  Write-Host '[host] SkipTunnel enabled. Start cloudflared manually when ready:'
  Write-Host '       cloudflared tunnel --url http://localhost:3001'
  exit 0
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  Write-Error "cloudflared not found in PATH. Install Cloudflare Tunnel and re-run."
  exit 1
}

Write-Host '[host] Starting Cloudflare tunnel now...'
Write-Host '[host] Share URL format: https://<your-trycloudflare-domain>/multiplayer.html'

# Keep this terminal open; tunnel URL is printed by cloudflared.
cloudflared tunnel --url http://localhost:3001
