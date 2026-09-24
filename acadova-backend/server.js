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

const app = express();

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));

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
  serverSelectionTimeoutMS: 5000,
  family: 4
})
  .then(() => console.log('Acadova DB Connected via MongoDB Atlas'))
  .catch(() => {
    console.error('DB Connection Error');
  });

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/credits', require('./routes/creditRoutes'));
app.use('/api/moderator', require('./routes/moderatorRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', validateQuery(), (req, res) => res.json({ status: 'Acadova API Running' }));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Acadova Server running on: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
});
