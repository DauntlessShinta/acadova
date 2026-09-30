require('dotenv').config();
const mongoose = require('mongoose');
const { runReminderScan } = require('../services/notificationReminderService');
const { configureDnsServers } = require('./configureDnsServers');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  configureDnsServers(process.env.DNS_SERVERS);
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'acadova', serverSelectionTimeoutMS: 5000 });
  try {
    const result = await runReminderScan();
    console.log('Notification reminder scan complete', result);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch((error) => {
  // Only emit constrained diagnostic fields; connection errors can contain credentials.
  const name = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error?.name || '') ? error.name : 'Error';
  const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(error?.code || '') ? error.code : 'UNKNOWN';
  const dnsMessage = /^querySrv [A-Z_]+ _mongodb\._tcp\.[A-Za-z0-9.-]+$/.test(error?.message || '')
    ? ` ${error.message}` : '';
  console.error(`Notification reminder scan failed: ${name} ${code}${dnsMessage}`);
  process.exitCode = 1;
});

module.exports = { main };
