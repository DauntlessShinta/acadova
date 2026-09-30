require('dotenv').config();
const mongoose = require('mongoose');
const { runReminderScan } = require('../services/notificationReminderService');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'acadova', serverSelectionTimeoutMS: 5000 });
  try {
    const result = await runReminderScan();
    console.log('Notification reminder scan complete', result);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(() => {
  console.error('Notification reminder scan failed');
  process.exitCode = 1;
});

module.exports = { main };
