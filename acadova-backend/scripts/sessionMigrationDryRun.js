#!/usr/bin/env node

// Manual, read-only inventory. This script intentionally never loads .env.
const { MongoClient } = require('mongoose').mongo;
const { runDryRun } = require('../utils/sessionMigrationDryRun');

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--dry-run') {
    throw new Error('Usage: node scripts/sessionMigrationDryRun.js --dry-run');
  }
  const uri = process.env.ACADOVA_DRY_RUN_MONGO_URI;
  if (!uri) throw new Error('ACADOVA_DRY_RUN_MONGO_URI must contain a dedicated read-only connection.');

  const client = new MongoClient(uri, {
    appName: 'acadova-session-migration-dry-run',
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
      throw new Error('The connection must have only the built-in read role on acadova.');
    }
    const report = await runDryRun(db);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(() => {
    // Driver errors may include a connection string. Never print the exception.
    process.stderr.write('Dry-run stopped. Verify the dedicated read-only URI and database access; no migration writes were attempted.\n');
    process.exitCode = 1;
  });
}

module.exports = { main };
