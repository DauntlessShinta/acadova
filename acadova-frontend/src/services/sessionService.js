import api from './api';

export const sessionService = {
  createSession: async ({ tutorId, subject, scheduledAt, meetingMethod, requestMessage, creditAmount = 1 }) => {
    return api.post('/api/sessions', {
      tutorId,
      subject,
      scheduledAt,
      meetingMethod,
      requestMessage,
      creditAmount: Number(creditAmount) || 1,
    });
  },

  getMySessions: async () => {
    return api.get('/api/sessions');
  },

  getSession: async (sessionId) => api.get(`/api/sessions/${sessionId}`),

  updateSessionStatus: async (sessionId, status) => {
    return api.patch(`/api/sessions/${sessionId}/status`, { status });
  },

  updateCoordination: async (sessionId, details) => (
    api.patch(`/api/sessions/${sessionId}/coordination`, details)
  ),

  confirmSession: async (sessionId) => api.post(`/api/sessions/${sessionId}/confirm`, {}),

  getMessages: async (sessionId) => api.get(`/api/sessions/${sessionId}/messages`),

  sendMessage: async (sessionId, body) => (
    api.post(`/api/sessions/${sessionId}/messages`, { body })
  ),
};

export default sessionService;
