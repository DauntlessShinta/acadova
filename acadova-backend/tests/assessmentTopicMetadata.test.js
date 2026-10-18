const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const User = require('../models/User');
const controller = require('../controllers/assessmentController');
const res = () => ({ json(body) { this.body = body; return this; }, status() { return this; } });
test('published assessment metadata preserves governed ID and legacy absence without answer keys', async (t) => {
  const oldFind = Assessment.find, oldOne = Assessment.findOne, oldUser = User.findById;
  t.after(() => { Assessment.find = oldFind; Assessment.findOne = oldOne; User.findById = oldUser; });
  const topic = new mongoose.Types.ObjectId();
  const rows = [{ _id: new mongoose.Types.ObjectId(), title: 'Quiz', topic: 'Previous Topic name', learningTopic: topic,
    questions: [{ prompt: 'Private answer key test', options: ['A','B'], correctIndex: 1 }] },
    { _id: new mongoose.Types.ObjectId(), title: 'Legacy', topic: 'Legacy topic', questions: [] }];
  Assessment.find = () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => rows });
  Assessment.findOne = () => ({ lean: async () => rows[0] });
  User.findById = () => ({ select() { return this; }, lean: async () => ({ role: 'student', rewardedAssessments: [] }) });
  const list = res(), detail = res();
  await controller.listPublishedAssessments({}, list);
  await controller.getPublishedAssessment({ params: { id: String(rows[0]._id) }, user: { id: '507f1f77bcf86cd799439011' } }, detail);
  assert.equal(list.body.data[0].learningTopic, String(topic));
  assert.equal(detail.body.data.learningTopic, String(topic));
  assert.equal(Object.hasOwn(list.body.data[1], 'learningTopic'), false);
  assert.equal(JSON.stringify(detail.body).includes('correctIndex'), false);
  assert.equal(JSON.stringify(list.body).includes('questions'), false);
});
