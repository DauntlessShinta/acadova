import api from './api';

export const moderationService = {
  getRatings: async () => api.get('/api/moderator/ratings'),

  setRatingVisibility: async (id, hidden) => (
    api.patch(`/api/moderator/ratings/${id}/visibility`, { hidden })
  ),
  getDisputedSessions: async () => api.get('/api/moderator/sessions/disputed'),
  resolveSession: async (id, resolution, resolutionNote) => (
    api.post(`/api/moderator/sessions/${id}/resolve`, { resolution, resolutionNote })
  ),
};

export default moderationService;
