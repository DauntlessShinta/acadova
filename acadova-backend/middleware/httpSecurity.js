const cors = require('cors');
const helmet = require('helmet');

// Keep Helmet's default policy. Local HTTP development must not be silently
// upgraded to HTTPS by the browser (notably Safari on localhost).
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
});

// The Vite development server proxies /api. Also support direct local API
// requests and one explicitly configured frontend origin, without a wildcard.
const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
if (process.env.FRONTEND_URL) {
  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL);
    if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
      throw new Error('Frontend URL must use HTTP or HTTPS');
    }
    allowedOrigins.add(frontendUrl.origin);
  } catch {
    console.error('Invalid FRONTEND_URL configuration');
  }
}

const corsMiddleware = cors({
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Authentication uses bearer JWTs, not cross-origin cookies.
  credentials: false,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const error = new Error('Origin not allowed');
    error.code = 'CORS_ORIGIN_DENIED';
    return callback(error);
  },
});

module.exports = { securityHeaders, corsMiddleware };
