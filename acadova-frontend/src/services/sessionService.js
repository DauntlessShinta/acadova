import api from './api';
import { toSessionInstant } from '../utils/sessionPresentation';
import { requireFutureStart } from '../utils/scheduling';

const legacyStatusActions = new Set(['accepted', 'scheduled', 'rejected', 'declined', 'completed', 'cancelled']);

export const sessionService = {
  createSession: async ({ tutorId, subject, scheduledAt, meetingMethod, requestMessage }) => {
    return api.post('/api/sessions', {
      tutorId,
      subject,
      scheduledAt: requireFutureStart(toSessionInstant(scheduledAt)),
      meetingMethod,
      requestMessage,
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

  generateGoogleMeet: async (sessionId, accessToken) => (
    api.post('/api/sessions/' + sessionId + '/google-meet', { accessToken })
  ),

  proposeReschedule: async (sessionId, scheduledAt, proposalId) => (
    api.post(`/api/sessions/${sessionId}/reschedule`, { scheduledAt: requireFutureStart(toSessionInstant(scheduledAt)), ...(proposalId ? { proposalId } : {}) })
  ),

  acceptReschedule: async (sessionId, proposalId) => (
    api.post(`/api/sessions/${sessionId}/reschedule/accept`, { proposalId })
  ),

  declineReschedule: async (sessionId, proposalId) => (
    api.post(`/api/sessions/${sessionId}/reschedule/decline`, { proposalId })
  ),
  withdrawReschedule: async (sessionId, proposalId) => (
    api.post(`/api/sessions/${sessionId}/reschedule/withdraw`, { proposalId })
  ),

  checkIn: async (sessionId, expectedScheduledAt) => api.post(`/api/sessions/${sessionId}/check-in`, expectedScheduledAt ? { expectedScheduledAt } : {}),
  submitEvidence: async (sessionId, evidence) => api.post(`/api/sessions/${sessionId}/evidence`, evidence),
  requestCompletionReview: async (sessionId, reason) => api.post(`/api/sessions/${sessionId}/review-request`, { reason }),

  finishSession: async (sessionId) => api.post(`/api/sessions/${sessionId}/finish`, {}),
  reportNoShow: async (sessionId) => api.post(`/api/sessions/${sessionId}/no-show`, {}),
  disputeSession: async (sessionId, reason) => api.post(`/api/sessions/${sessionId}/dispute`, { reason }),

  confirmSession: async (sessionId) => api.post(`/api/sessions/${sessionId}/confirm`, {}),

  getMessages: async (sessionId) => api.get(`/api/sessions/${sessionId}/messages`),

  sendMessage: async (sessionId, body) => (
    api.post(`/api/sessions/${sessionId}/messages`, { body })
  ),
};

export default sessionService;
