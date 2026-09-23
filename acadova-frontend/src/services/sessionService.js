import api from './api';

export const sessionService = {
  createSession: async ({ tutorId, subject, scheduledAt, creditAmount = 1 }) => {
    return api.post('/api/sessions', {
      tutorId,
      subject,
      scheduledAt: scheduledAt || undefined,
      creditAmount: Number(creditAmount) || 1,
    });
  },

  getMySessions: async () => {
    return api.get('/api/sessions');
  },

  updateSessionStatus: async (sessionId, status) => {
    return api.patch(`/api/sessions/${sessionId}/status`, { status });
  },
};

export default sessionService;

