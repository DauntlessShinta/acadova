# Small live smoke against the explicit disposable QA service. No .env, remote URI or real account.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$state = Get-Content -LiteralPath (Join-Path $repoRoot 'docs/manual-qa-evidence/current-run.json') -Raw | ConvertFrom-Json
$base = 'http://127.0.0.1:5002/api'
$health = Invoke-RestMethod ($base + '/health') -TimeoutSec 5
if (!$health.manualAllRoles -or $health.database -notmatch '^acadova_manual_qa_[a-f0-9]{32}$' -or $health.expActive -or $health.providers -ne 'mock-only') { throw 'Not the isolated all-role QA service. No login attempted.' }
$credential = Import-Clixml -LiteralPath (Join-Path $state.runDir 'credentials.clixml')
$password = $credential.GetNetworkCredential().Password
$results = @()
function Call-Qa($path, $method='GET', $body=$null, $token=$null, $expected=200) {
  $qaRequest = @{Uri=($base+$path);Method=$method;ContentType='application/json';TimeoutSec=20;UseBasicParsing=$true;ErrorAction='Stop'}
  if ($null -ne $body) { $qaRequest.Body=$body | ConvertTo-Json -Compress }
  if ($token) { $qaRequest.Headers=@{Authorization=('Bearer '+$token)} }
  $status=0; $data=$null
  try { $r=Invoke-WebRequest @qaRequest; $status=[int]$r.StatusCode; $data=$r.Content | ConvertFrom-Json } catch { if ($_.Exception.Response) { $status=[int]$_.Exception.Response.StatusCode } }
  $script:results += @{path=$path;method=$method;expected=$expected;status=$status;passed=($status -eq $expected)}
  if ($status -ne $expected) { throw "QA smoke mismatch: $method $path HTTP $status (expected $expected). Credentials and responses omitted." }
  return $data
}
try {
  $tokens=@{}
  foreach ($role in @('student','moderator','admin')) {
    $r=Call-Qa '/auth/login' 'POST' @{email=('qa-'+$role+'@example.test');password=$password}
    if (!$r.data.token -or $r.data.user.role -ne $role) { throw 'Role authentication evidence mismatch.' }
    $tokens[$role]=$r.data.token
    $null=Call-Qa '/users/me' 'GET' $null $tokens[$role]
  }
  $null=Call-Qa '/auth/login' 'POST' @{email='qa-student@example.test';password='IntentionallyWrongQa1!'} $null 401
  $null=Call-Qa '/auth/login' 'POST' @{email='qa-student@example.test';password=$password}
  foreach ($p in @('/academic/state','/academic/plans','/study-sets','/study-circles','/study-circles/volunteers','/ai-study/status','/ai-study/sets','/credits/mine','/growth','/notifications')) { $null=Call-Qa $p 'GET' $null $tokens.student }
  $growth=Call-Qa '/growth' 'GET' $null $tokens.student
  if ($growth.data.active -or $null -ne $growth.data.totalExp) { throw 'EXP must remain inactive.' }
  foreach ($p in @('/moderator/overview','/moderator/sessions/disputed','/moderator/study-sets','/study-circles/moderation')) { $null=Call-Qa $p 'GET' $null $tokens.moderator }
  foreach ($p in @('/admin/overview','/admin/operations','/admin/users','/admin/sessions','/admin/audit-logs','/admin/credits/rules','/admin/credits/activity','/admin/security')) { $null=Call-Qa $p 'GET' $null $tokens.admin }
  $null=Call-Qa '/admin/users' 'GET' $null $tokens.student 403
  $null=Call-Qa '/admin/users' 'GET' $null $tokens.moderator 403
  $null=Call-Qa '/academic/state' 'GET' $null $tokens.moderator 403
  $web=Invoke-WebRequest 'http://127.0.0.1:5174/login' -UseBasicParsing -TimeoutSec 10
  if ($web.StatusCode -ne 200) { throw 'QA frontend unavailable.' }
  Write-Output 'PASS: real local login for Student/Moderator/Admin, navigation APIs, invalid-password recovery, role boundaries and inactive EXP. No original login-500 cause inferred.'
} finally {
  $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $repoRoot 'docs/manual-qa-evidence/api-smoke.json') -Encoding utf8
  $tokens=$null; $password=$null; $credential=$null
}
