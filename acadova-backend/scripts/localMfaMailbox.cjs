// Local Windows-user mailbox for synthetic MFA QA. No HTTP endpoint or plaintext file.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function target(run, role) {
  if (!['admin', 'moderator'].includes(role)) throw new Error('Synthetic staff role required.');
  return path.join(run, 'mailbox-' + role);
}
function powershell(script, options = {}) {
  const child = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 65536, ...options,
  });
  if (child.status !== 0 || child.error) throw new Error('Local secure mailbox unavailable.');
  return child.stdout.trim();
}
function deliver(run, role, code) {
  if (!/^[0-9]{6}$/.test(code)) throw new Error('Synthetic code required.');
  const file = target(run, role);
  // The plaintext travels through child stdin only, never arguments/logs/files.
  const encrypted = powershell('$ErrorActionPreference="Stop";$value=[Console]::In.ReadToEnd();$secure=ConvertTo-SecureString -String $value -AsPlainText -Force;[Console]::Write(($secure|ConvertFrom-SecureString))', { input: code });
  fs.writeFileSync(file + '.dpapi', encrypted, { encoding: 'utf8' });
  fs.writeFileSync(file + '.json', JSON.stringify({ role, sentAt: new Date().toISOString(), needsFreshLogin: false }));
}
function read(run, role) {
  const file = target(run, role);
  const metadata = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  if (metadata.needsFreshLogin) throw new Error('Request a new code on the sign-in screen first.');
  const code = powershell('$ErrorActionPreference="Stop";$secure=ConvertTo-SecureString (Get-Content -LiteralPath $env:ACADOVA_MFA_CODE_FILE -Raw);$credential=New-Object Management.Automation.PSCredential("Synthetic OTP",$secure);[Console]::Write($credential.GetNetworkCredential().Password)', {
    env: { ...process.env, ACADOVA_MFA_CODE_FILE: file + '.dpapi' },
  });
  if (!/^[0-9]{6}$/.test(code)) throw new Error('Invalid secure mailbox payload.');
  return code;
}
function requireFreshLogin(run, role) {
  const file = target(run, role) + '.json';
  if (fs.existsSync(file)) {
    const metadata = JSON.parse(fs.readFileSync(file, 'utf8')); metadata.needsFreshLogin = true;
    fs.writeFileSync(file, JSON.stringify(metadata));
  }
}
module.exports = { deliver, read, requireFreshLogin };
