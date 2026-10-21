const dns = require('dns');
// Force Node.js to use Google & Cloudflare public DNS
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const mongoSanitize = require('express-mongo-sanitize');
const { validateQuery, validationErrorHandler } = require('./middleware/validation');
require('dotenv').config();
const { securityHeaders, corsMiddleware } = require('./middleware/httpSecurity');
const { apiNotFound, notFound, unexpectedError } = require('./middleware/apiErrors');
const { apiIdentity } = require('./config/apiIdentity');
let studentDatabaseReady=false;

const app = express();
require('./utils/proxyTrust').configureProxyTrust(app);

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(require('./config/studentReleaseSafety').requestGuard);

// Fix express-mongo-sanitize for Express v5 read-only req.query
app.use((req, res, next) => {
  if (req.body) {
    req.body = mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  }
  if (req.params) {
    req.params = mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  }
  next();
});

// Serve static assets (CSS, JS, images) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
  dbName: "acadova",
  autoCreate: false,
  autoIndex: false,
  serverSelectionTimeoutMS: 5000,
  family: 4
})
  .then(async () => {
    if(require('./config/studentExperience').active())await require('./services/studentReleaseReadiness').verifyStudentIndexes(mongoose.connection.db);
    studentDatabaseReady=true;
    console.log('Acadova database connected; required Student indexes ready');
  })
  .catch(() => {
    console.error('DB Connection Error');
  });

// No mutating endpoint is admitted on an unverified new Student deployment.
app.use('/api',(req,res,next)=>{
  if(!require('./config/studentExperience').active()||studentDatabaseReady||req.path==='/health')return next();
  return res.status(503).json({success:false,code:'STUDENT_DATABASE_NOT_READY',message:'Acadova is preparing its learning services. Please try again shortly.'});
});
// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/credits', require('./routes/creditRoutes'));
app.use('/api/acadi', require('./routes/acadiRoutes'));
app.use('/api/growth', require('./routes/growthRoutes'));
app.use('/api/assessments', require('./routes/assessmentRoutes'));
app.use('/api/study-sets', require('./routes/studyRoutes'));
app.use('/api/ai-study', require('./routes/aiStudyRoutes'));
app.use('/api/study-circles', require('./routes/studyCircleRoutes'));
app.use('/api/study-sharing', require('./routes/studySharingRoutes'));
app.use('/api/academic', require('./routes/academicWorkspaceRoutes'));
app.use('/api/learning', require('./routes/learningRoutes'));
app.use('/api/moderator/study-sets', require('./routes/studyModerationRoutes'));
app.use('/api/moderator', require('./routes/moderatorRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Identity describes this code revision, not database/provider readiness.
app.get('/api/health', validateQuery(), (req, res) => res.status(studentDatabaseReady?200:503).json({...apiIdentity(),databaseReady:studentDatabaseReady,studentExperience:require('./config/studentExperience').capabilities()}));

// The Express service is API-only. The user-facing application is served by Vite.
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Acadova API' });
});

// Unmatched API routes get a real JSON 404 instead of falling through to the SPA page.
app.use('/api', apiNotFound);

// Keep non-API backend responses machine-readable instead of serving legacy HTML.
app.use(notFound);

// Centralized error handler: never leak stack traces or internals to clients.
app.use(validationErrorHandler);
app.use(unexpectedError);

// Inactive unless the separately reviewed economy cutover is enabled.
const growthTimer=setInterval(()=>{if(studentDatabaseReady)void require('./services/growthReplay').replayBatch().catch(()=>{});},60000);
growthTimer.unref();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Acadova Server running on: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
});
