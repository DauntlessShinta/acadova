// Explicit local demo tool. Never imported by the API; never loads dotenv.
const topics = require('./starterTopics.json');

function checkInvocation(argv, env) {
  if (argv.length !== 1 || argv[0] !== '--local-only') throw new Error('Use --local-only.');
  if (String(env.NODE_ENV || '').toLowerCase() === 'production' || env.MONGO_URI) {
    throw new Error('Use a clean local shell without production mode or MONGO_URI.');
  }
}

async function seedTopics(Topic, actorId) {
  // A unique slug index is required for concurrent/repeated runs.
  await Topic.init();
  await Topic.collection.createIndex({ slug: 1 }, { unique: true, name: 'uniq_learning_topic_slug' });
  for (const topic of topics) {
    await Topic.updateOne({ slug: topic.slug }, { $setOnInsert: { ...topic, status: 'draft', createdBy: actorId } }, { upsert: true, runValidators: true });
  }
}

async function main(argv = process.argv.slice(2)) {
  checkInvocation(argv, process.env);
  process.env.NODE_ENV = 'development';
  const mongoose = require('mongoose');
  const Topic = require('../models/LearningTopic');
  const User = require('../models/User');
  try {
    // Fixed isolated P7 local target: no URI or database-name override accepted.
    await mongoose.connect('mongodb://127.0.0.1:27027/acadova?replicaSet=acadovaP7', { serverSelectionTimeoutMS: 5000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.setName !== 'acadovaP7' || !hello.isWritablePrimary) throw new Error('Isolated local P7 replica set required.');
    const actor = await User.findOne({ email: 'p7-moderator@example.test', role: 'moderator', suspendedAt: null });
    if (!actor) throw new Error('Prepare the existing local P7 Moderator fixture first.');
    await seedTopics(Topic, actor._id);
    console.log('Five starter-topic slugs ensured. Existing records preserved. Review and publish drafts through Learning Management.');
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { checkInvocation, seedTopics };
