import api from './api';
import { toSessionInstant } from '../utils/sessionPresentation';

const legacyStatusActions = new Set(['accepted', 'rejected', 'completed', 'cancelled']);

export const sessionService = {
  createSession: async ({ tutorId, subject, scheduledAt, meetingMethod, requestMessage, creditAmount = 1 }) => {
    return api.post('/api/sessions', {
      tutorId,
      subject,
      scheduledAt: toSessionInstant(scheduledAt),
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
    if (!legacyStatusActions.has(status)) throw new Error('This session action is not available yet.');
    return api.patch(`/api/sessions/${sessionId}/status`, { status });
  },

  updateCoordination: async (sessionId, details) => (
    api.patch(`/api/sessions/${sessionId}/coordination`, details)
  ),

  proposeReschedule: async (sessionId, scheduledAt) => (
    api.post(`/api/sessions/${sessionId}/reschedule`, { scheduledAt: toSessionInstant(scheduledAt) })
  ),

  acceptReschedule: async (sessionId, proposalId) => (
    api.post(`/api/sessions/${sessionId}/reschedule/accept`, { proposalId })
  ),

  declineReschedule: async (sessionId, proposalId) => (
    api.post(`/api/sessions/${sessionId}/reschedule/decline`, { proposalId })
  ),

  checkIn: async (sessionId) => api.post(`/api/sessions/${sessionId}/check-in`, {}),

  finishSession: async (sessionId) => api.post(`/api/sessions/${sessionId}/finish`, {}),

  confirmSession: async (sessionId) => api.post(`/api/sessions/${sessionId}/confirm`, {}),

  getMessages: async (sessionId) => api.get(`/api/sessions/${sessionId}/messages`),

  sendMessage: async (sessionId, body) => (
    api.post(`/api/sessions/${sessionId}/messages`, { body })
  ),
};

export default sessionService;
