import api from './api';

export const moderationService = {
  getRatings: async () => api.get('/api/moderator/ratings'),

  setRatingVisibility: async (id, hidden) => (
    api.patch(`/api/moderator/ratings/${id}/visibility`, { hidden })
  ),
};

export default moderationService;
