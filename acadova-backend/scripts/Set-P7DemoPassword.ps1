# Run manually in a local terminal; input is masked and never written to disk.
$ErrorActionPreference = 'Stop'
if ($env:MONGO_URI -or $env:NODE_ENV -eq 'production') { throw 'Use a clean local shell' }
$privatePassword = Read-Host 'Choose a password for the five synthetic local P7 accounts' -AsSecureString
$passwordPointer = [IntPtr]::Zero
try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($privatePassword)
  $env:P7_DEMO_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  Push-Location (Split-Path $PSScriptRoot -Parent)
  try {
    node scripts/prepareP7Local.js --local-only --rotate-passwords
    if ($LASTEXITCODE -ne 0) { throw 'Local password setup failed' }
  } finally { Pop-Location }
} finally {
  Remove-Item Env:P7_DEMO_PASSWORD -ErrorAction SilentlyContinue
  if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
  $privatePassword.Dispose()
}
