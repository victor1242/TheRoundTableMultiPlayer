# Check if ports are listening + owning process
$ports = 5500,3001
Get-NetTCPConnection -State Listen |
  Where-Object { $ports -contains $_.LocalPort } |
  Sort-Object LocalPort |
  Select-Object LocalAddress,LocalPort,OwningProcess,
    @{Name='ProcessName';Expression={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}}