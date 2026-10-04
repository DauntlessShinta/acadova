const mongoose = require('mongoose');
const Assessment = require('../models/Assessment');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const LearningTopic = require('../models/LearningTopic');
const { assessmentReward } = require('../config/creditRules');
const { getEffectiveCreditRules } = require('../services/creditRuleService');
const { logSecurityEvent } = require('../utils/securityLogger');
const { ACTIONS, auditedContentChange } = require('../services/auditService');

const hasRewardIndex = (index) => index.name === 'uniq_assessment_reward_recipient_assessment'
  && index.unique === true && index.key?.toUser === 1 && index.key?.assessment === 1
  && index.key?.type === 1 && index.partialFilterExpression?.type === 'assessment_reward'
  && index.partialFilterExpression?.toUser?.$exists === true
  && index.partialFilterExpression?.assessment?.$exists === true;

const publicAssessment = (assessment) => ({
  id: String(assessment._id), title: assessment.title, topic: assessment.topic,
  questionCount: assessment.questions.length,
  questions: assessment.questions.map((question) => ({ prompt: question.prompt, options: question.options })),
});
const resultView = (attempt) => ({
  id: String(attempt._id), assessmentId: String(attempt.assessment),
  score: attempt.score, passed: attempt.passed, rewardIssued: attempt.rewardIssued,
  creditsAwarded: attempt.rewardIssued ? (attempt.rewardAmount ?? assessmentReward) : 0,
  submittedAt: attempt.submittedAt,
});

exports.listPublishedAssessments = async (req, res) => {
  try {
    const rows = await Assessment.find({ status: 'published' })
      .select('_id title topic questions').sort({ publishedAt: -1 }).limit(100).lean();
    res.json({ success: true, data: rows.map((row) => ({
      id: String(row._id), title: row.title, topic: row.topic, questionCount: row.questions.length,
    })) });
  } catch { res.status(500).json({ success: false, message: 'Assessments could not be loaded.' }); }
};

exports.getPublishedAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not available.' });
    return res.json({ success: true, data: publicAssessment(assessment) });
  } catch { return res.status(500).json({ success: false, message: 'Assessment could not be loaded.' }); }
};

exports.getOwnAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({ _id: req.params.id, student: req.user.id }).lean();
    if (!attempt) return res.status(404).json({ success: false, message: 'Result not found.' });
    return res.json({ success: true, data: resultView(attempt) });
  } catch { return res.status(500).json({ success: false, message: 'Result could not be loaded.' }); }
};

exports.submitAssessment = async (req, res) => {
  let dbSession;
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not available.' });
    const answers = req.body.answers;
    if (answers.length !== assessment.questions.length
      || answers.some((answer, index) => answer >= assessment.questions[index].options.length)) {
      return res.status(400).json({ success: false, message: 'Submit one valid option for each question.' });
    }
    const correct = answers.filter((answer, index) => answer === assessment.questions[index].correctIndex).length;
    const score = Math.round(correct * 100 / assessment.questions.length);
    const passed = correct * 100 >= assessment.passingScore * assessment.questions.length;
    const baseAttempt = { student: req.user.id, assessment: assessment._id, answers,
      score, passed, rewardIssued: false, submittedAt: new Date() };
    if (!passed) {
      const attempt = await AssessmentAttempt.create(baseAttempt);
      return res.json({ success: true, data: resultView(attempt) });
    }

    // Production must have the separately rolled-out unique ledger index.
    // The atomic User claim also protects one reward when requests race.
    if (process.env.NODE_ENV === 'production') {
      const indexes = await CreditTransaction.collection.indexes();
      if (!indexes.some(hasRewardIndex)) {
        return res.status(503).json({ success: false, message: 'Assessment rewards are temporarily unavailable.' });
      }
    }
    dbSession = await mongoose.startSession();
    let result;
    await dbSession.withTransaction(async () => {
      const rules = await getEffectiveCreditRules(dbSession);
      const claimed = await User.findOneAndUpdate(
        { _id: req.user.id, role: 'student', rewardedAssessments: { $ne: assessment._id } },
        { $addToSet: { rewardedAssessments: assessment._id }, $inc: { credits: rules.assessmentReward } },
        { session: dbSession, new: true },
      );
      const [attempt] = await AssessmentAttempt.create([{ ...baseAttempt, rewardIssued: Boolean(claimed),
        ...(claimed ? { rewardAmount: rules.assessmentReward } : {}) }],
        { session: dbSession });
      if (claimed) {
        await CreditTransaction.create([{
          type: 'assessment_reward', toUser: req.user.id, amount: rules.assessmentReward,
          assessment: assessment._id, result: attempt._id,
        }], { session: dbSession });
      }
      result = resultView(attempt);
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Assessment submission could not be completed.' });
  } finally {
    if (dbSession) await dbSession.endSession();
  }
};

exports.listStaffAssessments = async (req, res) => {
  try {
    const rows = await Assessment.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, data: rows.map((row) => ({
      id: String(row._id), title: row.title, topic: row.topic, status: row.status,
      questionCount: row.questions.length, createdAt: row.createdAt,
    })) });
  } catch { return res.status(500).json({ success: false, message: 'Assessments could not be loaded.' }); }
};

exports.getStaffAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id).lean();
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found.' });
    return res.json({ success: true, data: {
      id: String(assessment._id), title: assessment.title, topic: assessment.topic,
      status: assessment.status, passingScore: assessment.passingScore,
      learningTopic: assessment.learningTopic ? String(assessment.learningTopic) : null,
      questions: assessment.questions.map((question) => ({ prompt: question.prompt,
        options: question.options, correctIndex: question.correctIndex })),
    } });
  } catch { return res.status(500).json({ success: false, message: 'Assessment could not be loaded.' }); }
};

exports.createAssessment = async (req, res) => {
  try {
    let body = req.body;
    if (body.learningTopic) {
      const topic = await LearningTopic.findOne({ _id: body.learningTopic, status: 'published' }).lean();
      if (!topic) return res.status(400).json({ success: false, message: 'Select a published learning topic.' });
      body = { ...body, topic: topic.name };
    }
    const assessment = await auditedContentChange(req, ACTIONS.assessmentCreated, 'Assessment',
      'Assessment created', async (session) => (await Assessment.create([
        { ...body, createdBy: req.user.id, status: 'draft' }], { session }))[0]);
    logSecurityEvent('moderation.assessment_created', req, { assessmentId: String(assessment._id) });
    return res.status(201).json({ success: true, data: { id: String(assessment._id), status: 'draft' } });
  } catch { return res.status(500).json({ success: false, message: 'Assessment could not be created.' }); }
};

exports.updateAssessment = async (req, res) => {
  try {
    let body = req.body;
    if (body.learningTopic) {
      const topic = await LearningTopic.findOne({ _id: body.learningTopic, status: 'published' }).lean();
      if (!topic) return res.status(400).json({ success: false, message: 'Select a published learning topic.' });
      body = { ...body, topic: topic.name };
    }
    const assessment = await auditedContentChange(req, ACTIONS.assessmentUpdated, 'Assessment',
      'Assessment draft updated',
      (session) => Assessment.findOneAndUpdate({ _id: req.params.id, status: 'draft' },
        { $set: { title: body.title, topic: body.topic, passingScore: body.passingScore,
          questions: body.questions, ...(body.learningTopic ? { learningTopic: body.learningTopic } : {}) },
        ...(body.learningTopic ? {} : { $unset: { learningTopic: 1 } }) },
        { new: true, runValidators: true, session }));
    if (!assessment) return res.status(409).json({ success: false,
      message: 'Only a draft assessment can be edited.' });
    return res.json({ success: true, data: { id: String(assessment._id), status: 'draft' } });
  } catch { return res.status(500).json({ success: false, message: 'Assessment could not be updated.' }); }
};

exports.publishAssessment = async (req, res) => {
  try {
    const assessment = await auditedContentChange(req, ACTIONS.assessmentPublished, 'Assessment',
      'Assessment published', (session) => Assessment.findOneAndUpdate(
        { _id: req.params.id, status: 'draft' },
        { $set: { status: 'published', approvedBy: req.user.id, publishedAt: new Date() } },
        { new: true, session },
      ));
    if (!assessment) return res.status(409).json({ success: false, message: 'Only a draft assessment can be published.' });
    logSecurityEvent('moderation.assessment_published', req, { assessmentId: String(assessment._id) });
    return res.json({ success: true, data: { id: String(assessment._id), status: 'published' } });
  } catch { return res.status(500).json({ success: false, message: 'Assessment could not be published.' }); }
};
