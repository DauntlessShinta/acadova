import api from './api';

export const authService = {
  register: async ({ name, email, password }) => {
    return api.post('/api/auth/register', { name, email, password });
  },

  login: async (email, password) => {
    return api.post('/api/auth/login', { email, password });
  },

  verifyEmail: async (token) => api.post('/api/auth/verify-email', { token }),
  resendVerification: async (email) => api.post('/api/auth/resend-verification', { email }),

  getHealth: async () => {
    return api.get('/api/health');
  },
};

export default authService;
