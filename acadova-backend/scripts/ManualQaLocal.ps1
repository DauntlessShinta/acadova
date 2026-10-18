param([ValidateSet('Start','Stop','Status')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stateFile = Join-Path $repoRoot 'docs/manual-qa-evidence/current-run.json'
function Read-State { if (Test-Path -LiteralPath $stateFile) { Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json } }
function Owned-Process($row) {
  $p = Get-Process -Id $row.pid -ErrorAction SilentlyContinue
  if ($p -and $p.StartTime.ToUniversalTime().Ticks.ToString() -eq $row.startedTicks -and $p.ProcessName -eq $row.name) { return $p }
  return $null
}
function Stop-Owned($state) {
  if (!$state) { return }
  foreach ($row in @($state.processes | Sort-Object order -Descending)) {
    $p = Owned-Process $row
    if ($p) { Stop-Process -Id $p.Id; $p.WaitForExit() }
  }
}
if ($Action -eq 'Stop') {
  Stop-Owned (Read-State)
  Write-Output 'Owned QA processes stopped. Synthetic database files and encrypted credentials retained. No other service stopped.'
  exit
}
if ($Action -eq 'Status') {
  $state = Read-State
  if (!$state) { Write-Output 'No manual QA run has been created.'; exit }
  foreach ($row in $state.processes) { Write-Output ($row.label + ': ' + [bool](Owned-Process $row)) }
  Write-Output ('Frontend: http://127.0.0.1:5174/ ; run directory: ' + $state.runDir)
  exit
}
if ($env:NODE_ENV -eq 'production') { throw 'Refusing production mode.' }
$previous = Read-State
if ($previous -and @($previous.processes | Where-Object { Owned-Process $_ }).Count -gt 0) { throw 'A QA process from the last run is still active. Use Status or Stop first; no data overwritten.' }
foreach ($port in @(27031,5002,5174)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port occupied. Refusing to reuse or stop an existing service." }
}
$memory = Get-CimInstance Win32_OperatingSystem
if ($memory.FreeVirtualMemory -lt 1572864) { throw 'Less than 1.5 GB free Windows commit capacity. No process launched.' }
$mongoExe = 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe'
if (!(Test-Path -LiteralPath $mongoExe)) { throw 'Installed local MongoDB 8.3 is required.' }
$runDir = Join-Path ([IO.Path]::GetTempPath()) ('acadova-manual-qa-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$dataRoot = Join-Path $runDir 'mongo-data'
New-Item -ItemType Directory -Path $dataRoot | Out-Null
$bytes = New-Object byte[] 24
$rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose()
$password = 'Qa1!' + [Convert]::ToBase64String($bytes)
$credential = New-Object System.Management.Automation.PSCredential('Synthetic Acadova QA only', (ConvertTo-SecureString -String $password -AsPlainText -Force))
$credential | Export-Clixml -LiteralPath (Join-Path $runDir 'credentials.clixml')
$state = @{runDir=$runDir; frontend='http://127.0.0.1:5174/'; backend='http://127.0.0.1:5002'; createdUtc=[DateTime]::UtcNow.ToString('o'); processes=@()}
function Record-Process($p, $label, $order) {
  $state.processes += @{pid=$p.Id;name=$p.ProcessName;startedTicks=$p.StartTime.ToUniversalTime().Ticks.ToString();label=$label;order=$order}
  $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $stateFile -Encoding utf8
}
$oldPassword = $env:ACADOVA_BUNDLE_C_QA_PASSWORD
$oldRun = $env:ACADOVA_MANUAL_QA_RUN
try {
  $mongo = Start-Process -FilePath $mongoExe -ArgumentList @('--dbpath', ('"'+$dataRoot+'"'), '--bind_ip','127.0.0.1','--port','27031','--replSet','acadovaAiQA','--wiredTigerCacheSizeGB','0.25','--logpath',('"'+(Join-Path $runDir 'mongod.log')+'"')) -WindowStyle Hidden -PassThru
  Record-Process $mongo 'MongoDB' 1
  $env:ACADOVA_BUNDLE_C_QA_PASSWORD = $password
  $env:ACADOVA_MANUAL_QA_RUN = $runDir
  $api = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('--max-old-space-size=192','scripts/bundleCqaLocal.cjs','--serve','--manual-all-roles') -WorkingDirectory (Join-Path $repoRoot 'acadova-backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDir 'api.out.txt') -RedirectStandardError (Join-Path $runDir 'api.err.txt') -PassThru
  Record-Process $api 'API' 2
  $env:ACADOVA_BUNDLE_C_QA_PASSWORD = $oldPassword
  $env:ACADOVA_MANUAL_QA_RUN = $oldRun
  $password = $null
  $ready = $false
  for ($i=0; $i -lt 100; $i++) {
    if ($api.HasExited -or $mongo.HasExited) { throw 'QA startup failed. Inspect the private run directory logs; no configured database was used.' }
    try { $health = Invoke-RestMethod 'http://127.0.0.1:5002/api/health' -TimeoutSec 1; if ($health.manualAllRoles -and $health.database -match '^acadova_manual_qa_[a-f0-9]{32}$' -and !$health.expActive) { $ready=$true;break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw 'QA API did not become ready; owned processes will stop.' }
  $web = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('--max-old-space-size=256','node_modules/vite/bin/vite.js','--config','vite.bundle-c-qa.config.js') -WorkingDirectory (Join-Path $repoRoot 'acadova-frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDir 'web.out.txt') -RedirectStandardError (Join-Path $runDir 'web.err.txt') -PassThru
  Record-Process $web 'Frontend' 3
  $ready = $false
  for ($i=0; $i -lt 40; $i++) {
    if ($web.HasExited) { throw 'QA frontend failed; inspect private logs.' }
    try { $page=Invoke-WebRequest 'http://127.0.0.1:5174/' -UseBasicParsing -TimeoutSec 1; if ($page.StatusCode -eq 200) { $ready=$true;break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw 'QA frontend did not become ready.' }
  Write-Output 'Ready: http://127.0.0.1:5174/ (use 100% browser zoom).'
  Write-Output ('Encrypted credentials, mock mailbox, synthetic PPTX and private logs: ' + $runDir)
  Write-Output 'Accounts: qa-student@example.test ; qa-moderator@example.test ; qa-admin@example.test ; optional qa-peer@example.test'
} catch {
  Stop-Owned $state
  throw
} finally {
  $env:ACADOVA_BUNDLE_C_QA_PASSWORD = $oldPassword
  $env:ACADOVA_MANUAL_QA_RUN = $oldRun
  $password=$null; $credential=$null
}
