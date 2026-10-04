import api from './api';

export const authService = {
  register: async ({ name, email, password, policyAccepted }) => {
    return api.post('/api/auth/register', { name, email, password, policyAccepted });
  },

  login: async (email, password) => {
    return api.post('/api/auth/login', { email, password });
  },

  verifyEmail: async (token) => api.post('/api/auth/verify-email', { token }),
  resendVerification: async (email) => api.post('/api/auth/resend-verification', { email }),
  forgotPassword: async (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: async (token, password) => api.post('/api/auth/reset-password', { token, password }),
  googleLogin: async (credential, policyAccepted) => api.post('/api/auth/google',
    { credential, ...(policyAccepted ? { policyAccepted: true } : {}) }),

  getHealth: async () => {
    return api.get('/api/health');
  },
};

export default authService;
