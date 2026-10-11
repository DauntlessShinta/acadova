import api from './api';

export const moderationService = {
  getRatings: async () => api.get('/api/moderator/ratings'),

  setRatingVisibility: async (id, hidden) => (
    api.patch(`/api/moderator/ratings/${id}/visibility`, { hidden })
  ),
  getDisputedSessions: async () => api.get('/api/moderator/sessions/disputed'),
  getResolvedSessions: async () => api.get('/api/moderator/sessions/resolved'),
  getSessionEvidence: async (id) => api.get(`/api/moderator/sessions/${id}/evidence`),
  requestClarification: async (id, reason, reviewVersion) => api.post(`/api/moderator/sessions/${id}/clarify`, { reason, reviewVersion }),
  resolveSession: async (id, resolution, resolutionNote, reviewVersion) => (
    api.post(`/api/moderator/sessions/${id}/resolve`, { resolution, resolutionNote, ...(reviewVersion != null ? { reviewVersion } : {}) })
  ),
};

export default moderationService;
