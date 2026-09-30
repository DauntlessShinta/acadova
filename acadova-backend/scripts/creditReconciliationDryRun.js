#!/usr/bin/env node

// Manual, read-only credit inventory. No dotenv, startup models, or automatic repairs.
const { MongoClient } = require('mongoose').mongo;
const { runDryRun } = require('../utils/creditReconciliationDryRun');

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--dry-run') {
    throw new Error('Usage: node scripts/creditReconciliationDryRun.js --dry-run');
  }
  const uri = process.env.ACADOVA_CREDIT_DRY_RUN_MONGO_URI;
  if (!uri) throw new Error('ACADOVA_CREDIT_DRY_RUN_MONGO_URI must be explicitly set to a read-only URI.');

  const client = new MongoClient(uri, {
    appName: 'acadova-credit-reconciliation-dry-run',
    readPreference: 'secondaryPreferred',
    readConcern: { level: 'majority' },
    retryWrites: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db('acadova');
    const state = await db.admin().command({ connectionStatus: 1, showPrivileges: false });
    const roles = state.authInfo?.authenticatedUserRoles || [];
    if (roles.length === 0 || !roles.every((role) => role.role === 'read' && role.db === 'acadova')) {
      throw new Error('Use an account with only the read role on acadova.');
    }
    process.stdout.write(`${JSON.stringify(await runDryRun(db), null, 2)}\n`);
  } finally { await client.close(); }
}

if (require.main === module) {
  main().catch(() => {
    // Driver exceptions can contain connection strings; never print them.
    process.stderr.write('Credit dry-run stopped. Verify the dedicated read-only URI and access; no writes were attempted.\n');
    process.exitCode = 1;
  });
}

module.exports = { main };
