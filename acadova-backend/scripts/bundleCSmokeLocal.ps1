$ErrorActionPreference = 'Stop'
$qaRoot = 'http://127.0.0.1:5002/api'
if (-not $env:ACADOVA_BUNDLE_C_QA_PASSWORD) { throw 'Set the synthetic ACADOVA_BUNDLE_C_QA_PASSWORD used by bundleCqaLocal.cjs.' }
$health = Invoke-RestMethod ($qaRoot + '/health') -TimeoutSec 5
if (-not $health.localQa -or $health.database -notmatch '^acadova_bundle_c_manual_[0-9]+_[0-9]+$') { throw 'Not the dedicated disposable Bundle C QA service.' }
function Call-Qa($path, $method = 'GET', $body = $null, $headers = @{}) {
  $qaArgs = @{ Uri = ($qaRoot + '/' + $path); Method = $method; Headers = $headers; ContentType = 'application/json'; TimeoutSec = 15 }
  if ($null -ne $body) { $qaArgs.Body = ($body | ConvertTo-Json -Depth 12 -Compress) }
  Invoke-RestMethod @qaArgs
}
function Check-Qa($condition, $label) { if (-not $condition) { throw $label }; Write-Output ('PASS: ' + $label) }
function Denied-Qa($path, $method, $body, $headers, $status) {
  try { $ignored = Call-Qa $path $method $body $headers; throw 'Expected request denial.' }
  catch { if ([int]$_.Exception.Response.StatusCode -ne $status) { throw }; Write-Output ('PASS: HTTP ' + $status + ' for ' + $path) }
}
function Login-Qa($label) { $r = Call-Qa 'auth/login' 'POST' @{ email = ('bundle-c-' + $label + '@example.test'); password = $env:ACADOVA_BUNDLE_C_QA_PASSWORD }; @{ Authorization = ('Bearer ' + $r.data.token) } }
$a = Login-Qa 'a'; $b = Login-Qa 'b'; $c = Login-Qa 'c'; $staff = Login-Qa 'staff'
$before = Call-Qa 'credits/mine' 'GET' $null $a | ConvertTo-Json -Depth 12 -Compress
$draft = @{ title = 'Manual synthetic circle'; description = 'Loopback QA only'; startsAt = [DateTime]::UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'"); endsAt = [DateTime]::UtcNow.AddDays(1).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'"); timezone = 'Asia/Manila'; capacity = 1; tags = @('Math'); meetingUrl = 'https://meet.google.com/abc-defg-hij' }
$circle = (Call-Qa 'study-circles' 'POST' $draft $a).data
Check-Qa (-not (Call-Qa ('study-circles/' + $circle.id) 'GET' $null $c).data.meetingUrl) 'Unenrolled student cannot retrieve meeting URL'
$joined = (Call-Qa ('study-circles/' + $circle.id + '/join') 'POST' @{} $b).data
Check-Qa ([bool]$joined.meetingUrl) 'Enrolled student receives meeting bookmark'
Denied-Qa ('study-circles/' + $circle.id + '/join') 'POST' @{} $c 409
$ignored = Call-Qa ('study-circles/' + $circle.id + '/leave') 'POST' @{} $b
$ignored = Call-Qa ('study-circles/' + $circle.id + '/join') 'POST' @{} $b
$ignored = Call-Qa ('study-circles/' + $circle.id + '/report') 'POST' @{ reason = 'Synthetic manual moderator concern' } $b
$review = @((Call-Qa 'study-circles/moderation' 'GET' $null $staff).data | Where-Object { $_.id -eq $circle.id })[0]
$ignored = Call-Qa ('study-circles/moderation/' + $review.id) 'POST' @{ version = $review.version; outcome = 'cancel'; reason = 'Synthetic manual staff cancellation' } $staff
Check-Qa (-not (Call-Qa ('study-circles/' + $circle.id) 'GET' $null $b).data.meetingUrl) 'Moderator cancellation revokes meeting access'
$circle = (Call-Qa 'study-circles' 'POST' $draft $a).data
$ignored = Call-Qa ('study-circles/' + $circle.id + '/cancel') 'POST' @{ version = $circle.version } $a
$set = (Call-Qa 'study-sets' 'POST' @{ title = 'Manual authored synthetic set'; subject = 'Math'; questions = @(@{ prompt = 'What is two plus two?'; options = @('Four', 'Five'); correctIndex = 0; explanation = 'Synthetic addition.' }); flashcards = @(@{ front = 'Sum'; back = 'Result of addition' }) } $a).data
Denied-Qa ('study-sets/' + $set.id) 'GET' $null $c 404
$share = (Call-Qa ('study-sharing/' + $set.id) 'PUT' @{ version = $set.version; visibility = 'unlisted'; rightsAcknowledged = $true } $a).data
$opened = (Call-Qa ('study-sharing/' + $set.id + '/open') 'POST' @{ token = $share.token } $b).data
Check-Qa ($opened.readOnly -and $opened.flashcards.Count -eq 1 -and -not $opened.subjectId) 'Unlisted quiz and flashcards are read-only with no private academic IDs'
$revoke = (Call-Qa ('study-sharing/' + $set.id) 'PUT' @{ version = $share.version; visibility = 'private' } $a).data
Denied-Qa ('study-sharing/' + $set.id + '/open') 'POST' @{ token = $share.token } $b 404
$share = (Call-Qa ('study-sharing/' + $set.id) 'PUT' @{ version = $revoke.version; visibility = 'unlisted'; rightsAcknowledged = $true } $a).data
$ignored = Call-Qa ('study-sharing/' + $set.id + '/report') 'POST' @{ token = $share.token; reason = 'Synthetic manual content review request' } $b
$review = (Call-Qa ('moderator/study-sets/' + $set.id) 'GET' $null $staff).data
$ignored = Call-Qa ('moderator/study-sets/' + $set.id + '/decision') 'POST' @{ version = $review.version; outcome = 'remove'; reason = 'Synthetic manual unlisted takedown' } $staff
Denied-Qa ('study-sharing/' + $set.id + '/open') 'POST' @{ token = $share.token } $b 404
$after = Call-Qa 'credits/mine' 'GET' $null $a | ConvertTo-Json -Depth 12 -Compress
Check-Qa ($before -ceq $after) 'Actual legacy credit API balance/history unchanged after free circles and sharing'
Check-Qa ((Call-Qa 'study-sets/shared' 'GET' $null $b).data.Count -eq 0) 'Unlisted or removed sets absent from approved public discovery'
Check-Qa ((Call-Qa 'ai-study/status' 'GET' $null $a).data.enabled -eq $false) 'AI provider generation remains disabled in disposable QA'
